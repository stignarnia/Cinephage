import { sql } from 'drizzle-orm';
import { episodeFiles, movieFiles, movies, scoringProfiles, series } from '$lib/server/db/schema';
import type { StorageInsightRule, RuleContext, InsightFinding } from '../types.js';

/**
 * Resolution ordinal scale (higher = better). Matches RESOLUTION_ORDER
 * from src/lib/server/indexers/parser/types.ts but inlined here to avoid
 * a cross-domain import dependency.
 */
const RESOLUTION_ORDER: Record<string, number> = {
	'2160p': 4,
	'1080p': 3,
	'720p': 2,
	'480p': 1,
	unknown: 0
};

/**
 * Finds media whose stored quality.resolution is below their scoring profile's
 * minResolution. Covers both movies and episodes. These are candidates for
 * upgrade searches.
 *
 * NOTE: The monitoring system's CutoffUnmetSpecification was softened to always
 * accept (hard cutoffs removed). This rule is the NEW logic that surfaces
 * below-cutoff items for display purposes — it does NOT trigger automatic
 * upgrades.
 */
export class QualityBelowCutoffRule implements StorageInsightRule {
	readonly type = 'quality-below-cutoff' as const;

	async evaluate(ctx: RuleContext): Promise<InsightFinding[]> {
		// Movies: join movies → movie_files → scoring_profiles
		const movieRows = ctx.db
			.select({
				title: movies.title,
				tmdbId: movies.tmdbId,
				quality: movieFiles.quality,
				minResolution: scoringProfiles.minResolution,
				profileName: scoringProfiles.name
			})
			.from(movies)
			.innerJoin(movieFiles, sql`${movieFiles.movieId} = ${movies.id}`)
			.leftJoin(scoringProfiles, sql`${scoringProfiles.id} = ${movies.scoringProfileId}`)
			.where(sql`${movies.tmdbId} IS NOT NULL`)
			.all();

		// Episodes: join series → episode_files → scoring_profiles
		const episodeRows = ctx.db
			.select({
				title: series.title,
				tmdbId: series.tmdbId,
				quality: episodeFiles.quality,
				minResolution: scoringProfiles.minResolution,
				profileName: scoringProfiles.name
			})
			.from(series)
			.innerJoin(episodeFiles, sql`${episodeFiles.seriesId} = ${series.id}`)
			.leftJoin(scoringProfiles, sql`${scoringProfiles.id} = ${series.scoringProfileId}`)
			.where(sql`${series.tmdbId} IS NOT NULL`)
			.all();

		const allRows = [...movieRows, ...episodeRows];

		const belowCutoff = allRows.filter((row) => {
			if (!row.minResolution) return false;
			const fileRes = (row.quality as { resolution?: string } | null)?.resolution ?? 'unknown';
			const fileOrdinal = RESOLUTION_ORDER[fileRes] ?? 0;
			const cutoffOrdinal = RESOLUTION_ORDER[row.minResolution] ?? 0;
			return fileOrdinal < cutoffOrdinal;
		});

		if (belowCutoff.length === 0) return [];

		return [
			{
				type: this.type,
				severity: 'info',
				scope: 'global',
				title: `Items below quality cutoff`,
				summary: `${belowCutoff.length} item${belowCutoff.length === 1 ? '' : 's'} ${belowCutoff.length === 1 ? 'has' : 'have'} a resolution below ${belowCutoff.length === 1 ? 'its' : 'their'} profile's minimum. These are candidates for upgrade searches.`,
				details: {
					items: belowCutoff.map((r) => ({
						tmdbId: r.tmdbId,
						title: r.title,
						currentResolution:
							(r.quality as { resolution?: string } | null)?.resolution ?? 'unknown',
						minResolution: r.minResolution
					}))
				},
				itemCount: belowCutoff.length
			}
		];
	}
}
