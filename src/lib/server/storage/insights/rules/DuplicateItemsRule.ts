import { count, sql } from 'drizzle-orm';
import { episodeFiles, movieFiles, movies, series } from '$lib/server/db/schema';
import type { StorageInsightRule, RuleContext, InsightFinding } from '../types.js';

/**
 * Detects items with multiple file rows — movies with multiple movie_files,
 * or series with unusually many episode_files in a season. These are likely
 * duplicate downloads or different cuts/editions the user may want to clean up.
 */
export class DuplicateItemsRule implements StorageInsightRule {
	readonly type = 'duplicate-items' as const;

	async evaluate(ctx: RuleContext): Promise<InsightFinding[]> {
		// Movie duplicates: same movie with multiple movie_files rows
		const movieDupes = ctx.db
			.select({
				tmdbId: movies.tmdbId,
				title: movies.title,
				fileCount: count()
			})
			.from(movies)
			.innerJoin(movieFiles, sql`${movieFiles.movieId} = ${movies.id}`)
			.where(sql`${movies.tmdbId} IS NOT NULL`)
			.groupBy(movies.id)
			.having(sql`count(*) > 1`)
			.all();

		// Episode duplicates: series+season with unusually many episode_files
		// (most seasons are 10-13 episodes; 20+ in a season suggests duplicates)
		const episodeDupes = ctx.db
			.select({
				tmdbId: series.tmdbId,
				title: series.title,
				seasonNumber: episodeFiles.seasonNumber,
				fileCount: count()
			})
			.from(series)
			.innerJoin(episodeFiles, sql`${episodeFiles.seriesId} = ${series.id}`)
			.where(sql`${series.tmdbId} IS NOT NULL`)
			.groupBy(series.id, episodeFiles.seasonNumber)
			.having(sql`count(*) > 20`)
			.all();

		const totalDupes = movieDupes.length + episodeDupes.length;
		if (totalDupes === 0) return [];

		const allDetails: Array<{
			type: string;
			tmdbId: string;
			title: string;
			seasonNumber?: number;
			fileCount: number;
		}> = [
			...movieDupes.map((d) => ({
				type: 'movie' as const,
				tmdbId: String(d.tmdbId),
				title: d.title,
				fileCount: d.fileCount
			})),
			...episodeDupes.map((d) => ({
				type: 'tv' as const,
				tmdbId: String(d.tmdbId),
				title: d.title,
				seasonNumber: d.seasonNumber,
				fileCount: d.fileCount
			}))
		];

		return [
			{
				type: this.type,
				severity: 'warning',
				scope: 'global',
				title: `Duplicate items`,
				summary: `${totalDupes} item${totalDupes === 1 ? '' : 's'} ${totalDupes === 1 ? 'has' : 'have'} multiple files. You may want to remove duplicates to reclaim space.`,
				details: { items: allDetails },
				itemCount: totalDupes
			}
		];
	}
}
