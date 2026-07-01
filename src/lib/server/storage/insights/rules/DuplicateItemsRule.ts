import { count, sql } from 'drizzle-orm';
import { movieFiles, movies } from '$lib/server/db/schema';
import type { StorageInsightRule, RuleContext, InsightFinding } from '../types.js';

/**
 * Detects movies with multiple movie_files rows pointing to the same tmdbId.
 * These are likely duplicate downloads or different cuts/editions the user
 * may want to clean up. Queries movie_files directly since storage_items
 * collapses to one row per logical item.
 */
export class DuplicateItemsRule implements StorageInsightRule {
	readonly type = 'duplicate-items' as const;

	async evaluate(ctx: RuleContext): Promise<InsightFinding[]> {
		const duplicates = ctx.db
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

		if (duplicates.length === 0) return [];

		const totalDupes = duplicates.length;
		return [
			{
				type: this.type,
				severity: 'warning',
				scope: 'global',
				title: `${totalDupes} duplicate item${totalDupes === 1 ? '' : 's'}`,
				summary: `${totalDupes} movie${totalDupes === 1 ? ' has' : 's have'} multiple files. You may want to remove duplicates to reclaim space.`,
				details: {
					items: duplicates.map((d) => ({
						tmdbId: d.tmdbId,
						title: d.title,
						fileCount: d.fileCount
					}))
				},
				itemCount: totalDupes
			}
		];
	}
}
