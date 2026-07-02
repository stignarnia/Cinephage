import { sql } from 'drizzle-orm';
import { movieFiles, movies, scoringProfiles } from '$lib/server/db/schema';
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
 * Finds movies whose stored quality.resolution is below their scoring profile's
 * minResolution. These are candidates for upgrade searches.
 *
 * NOTE: The monitoring system's CutoffUnmetSpecification was softened to always
 * accept (hard cutoffs removed). This rule is the NEW logic that surfaces
 * below-cutoff items for display purposes — it does NOT trigger automatic
 * upgrades.
 */
export class QualityBelowCutoffRule implements StorageInsightRule {
	readonly type = 'quality-below-cutoff' as const;

	async evaluate(ctx: RuleContext): Promise<InsightFinding[]> {
		// Load movies with their files and profiles
		const rows = ctx.db
			.select({
				movieId: movies.id,
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

		const belowCutoff = rows.filter((row) => {
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
				summary: `${belowCutoff.length} movie${belowCutoff.length === 1 ? '' : 's'} have a resolution below their profile's minimum. These are candidates for upgrade searches.`,
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
