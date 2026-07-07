import { storageItems, movies, series } from '$lib/server/db/schema';
import { and, count, eq, notInArray, inArray } from 'drizzle-orm';
import type { InsightItemResolver } from './types.js';

export const untrackedByCinephageResolver: InsightItemResolver = async ({ db, page, limit }) => {
	const total =
		db
			.select({ count: count() })
			.from(storageItems)
			.where(
				and(
					eq(storageItems.sourceSystem, 'server'),
					notInArray(storageItems.itemType, ['series', 'season'])
				)
			)
			.get()?.count ?? 0;
	if (total === 0) return { items: [], total: 0 };

	const rows = db
		.select({
			id: storageItems.id,
			title: storageItems.title,
			tmdbId: storageItems.tmdbId,
			itemType: storageItems.itemType
		})
		.from(storageItems)
		.where(
			and(
				eq(storageItems.sourceSystem, 'server'),
				notInArray(storageItems.itemType, ['series', 'season'])
			)
		)
		.limit(limit)
		.offset((page - 1) * limit)
		.all();

	const movieTmdbIds = rows.filter((r) => r.itemType === 'movie' && r.tmdbId).map((r) => r.tmdbId!);
	const seriesTmdbIds = rows
		.filter((r) => r.itemType !== 'movie' && r.tmdbId)
		.map((r) => r.tmdbId!);
	const movieMap = new Map<number, string>();
	const seriesMap = new Map<number, string>();
	if (movieTmdbIds.length > 0) {
		const mr = db
			.select({ id: movies.id, tmdbId: movies.tmdbId })
			.from(movies)
			.where(inArray(movies.tmdbId, movieTmdbIds))
			.all();
		for (const r of mr) movieMap.set(r.tmdbId, r.id);
	}
	if (seriesTmdbIds.length > 0) {
		const sr = db
			.select({ id: series.id, tmdbId: series.tmdbId })
			.from(series)
			.where(inArray(series.tmdbId, seriesTmdbIds))
			.all();
		for (const r of sr) seriesMap.set(r.tmdbId, r.id);
	}

	return {
		items: rows.map((row) => ({
			id: `ut-${row.id}`,
			kind: row.itemType === 'movie' ? ('movie' as const) : ('episode' as const),
			title: row.title,
			badges: [{ label: 'Not tracked', tone: 'info' as const }],
			href: row.tmdbId
				? movieMap.has(row.tmdbId)
					? `/library/movie/${movieMap.get(row.tmdbId)}`
					: seriesMap.has(row.tmdbId)
						? `/library/tv/${seriesMap.get(row.tmdbId)}`
						: undefined
				: undefined
		})),
		total
	};
};
