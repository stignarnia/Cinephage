import { and, eq, inArray, sql } from 'drizzle-orm';
import type { ServiceStatus, BackgroundService } from '$lib/server/services/background-service.js';
import { db } from '$lib/server/db';
import {
	episodeFiles,
	mediaServerSyncedItems,
	movies,
	movieFiles,
	series,
	storageItemServerLinks,
	storageItems
} from '$lib/server/db/schema';
import { createChildLogger } from '$lib/logging';
import { logicalKey } from './matchers.js';
import type { ReconcileResult } from '../types.js';

const logger = createChildLogger({ logDomain: 'system' as const });

/**
 * Internal shape used during reconciliation to represent a local source row.
 */
type SourceRow = {
	itemType: 'movie' | 'episode';
	tmdbId: number | null;
	title: string;
	year: number | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	movieFileId: string | null;
	episodeFileId: string | null;
	rootFolderId: string | null;
	libraryId: string | null;
};

class ReconciliationService implements BackgroundService {
	readonly name = 'ReconciliationService';
	private _status: ServiceStatus = 'pending';
	private _error?: Error;
	private reconcileLock = false;
	private listenersAttached = false;

	get status(): ServiceStatus {
		return this._status;
	}

	get error(): Error | undefined {
		return this._error;
	}

	start(): void {
		if (this._status !== 'pending') return;
		this._status = 'starting';
		setImmediate(() => {
			try {
				this.attachListeners();
				this._status = 'ready';
				logger.info('[ReconciliationService] ready; will run on scan/sync events');
				// Trigger an initial reconcile (backfill) shortly after startup,
				// delayed so we don't compete with other services' startup work.
				setTimeout(() => {
					this.reconcile().catch((err) => {
						logger.error('[ReconciliationService] initial reconcile failed', err);
					});
				}, 5000);
			} catch (e) {
				this._error = e instanceof Error ? e : new Error(String(e));
				this._status = 'error';
				logger.error('[ReconciliationService] startup failed', this._error);
			}
		});
	}

	async stop(): Promise<void> {
		this.detachListeners();
		this._status = 'pending';
	}

	private attachListeners(): void {
		if (this.listenersAttached) return;
		this.listenersAttached = true;
		// Lazy-import to avoid circular deps at module load time
		void import('$lib/server/library/library-scheduler.js').then(({ getLibraryScheduler }) => {
			getLibraryScheduler().on('scanComplete', this.handleTrigger);
		});
		void import('$lib/server/mediaServerStats/MediaServerStatsSyncService.js').then(
			({ getMediaServerStatsSyncService }) => {
				getMediaServerStatsSyncService().on('syncComplete', this.handleTrigger);
			}
		);
	}

	private detachListeners(): void {
		if (!this.listenersAttached) return;
		this.listenersAttached = false;
		void import('$lib/server/library/library-scheduler.js').then(({ getLibraryScheduler }) => {
			getLibraryScheduler().off('scanComplete', this.handleTrigger);
		});
		void import('$lib/server/mediaServerStats/MediaServerStatsSyncService.js').then(
			({ getMediaServerStatsSyncService }) => {
				getMediaServerStatsSyncService().off('syncComplete', this.handleTrigger);
			}
		);
	}

	private handleTrigger = (): void => {
		this.reconcile().catch((err) => {
			logger.error('[ReconciliationService] reconcile failed after trigger', err);
		});
	};

	/**
	 * Run a full reconciliation pass. Idempotent; safe to call repeatedly.
	 * Acquires a lock so concurrent triggers coalesce into one run.
	 */
	async reconcile(): Promise<ReconcileResult> {
		const start = Date.now();
		if (this.reconcileLock) {
			logger.debug('[ReconciliationService] reconcile already in progress; skipping');
			return {
				itemsUpserted: 0,
				itemsInserted: 0,
				itemsUpdated: 0,
				itemsDeleted: 0,
				linksUpserted: 0,
				durationMs: 0,
				skipped: true
			};
		}
		this.reconcileLock = true;
		try {
			const [localRows, serverItemRows, existingItems, existingLinks] = await Promise.all([
				this.loadLocalRows(),
				this.loadServerItems(),
				db.select().from(storageItems),
				db.select().from(storageItemServerLinks)
			]);

			// Desired state from local sources: Map<logicalKey, SourceRow>
			const desired = new Map<string, SourceRow>();
			for (const row of localRows) {
				if (row.tmdbId === null) continue;
				const key = logicalKey(row.itemType, row.tmdbId, row.seasonNumber, row.episodeNumber);
				if (!desired.has(key)) desired.set(key, row); // first row wins (matches existing dedup)
			}

			// Server items: Map<logicalKey, serverItem[]>
			const serverByKey = new Map<string, Array<typeof mediaServerSyncedItems.$inferSelect>>();
			for (const s of serverItemRows) {
				const key = logicalKey(
					s.itemType as 'movie' | 'episode',
					s.tmdbId,
					s.seasonNumber,
					s.episodeNumber
				);
				if (!serverByKey.has(key)) serverByKey.set(key, []);
				serverByKey.get(key)!.push(s);
			}

			// Existing rows indexed by logical key
			const existingByKey = new Map<string, typeof storageItems.$inferSelect>();
			for (const item of existingItems) {
				const key = logicalKey(
					item.itemType as 'movie' | 'episode',
					item.tmdbId,
					item.seasonNumber,
					item.episodeNumber
				);
				existingByKey.set(key, item);
			}
			const existingLinkIds = new Set(existingLinks.map((l) => `${l.storageItemId}:${l.serverId}`));

			const keepItemIds = new Set<string>();
			let itemsInserted = 0;
			let itemsUpdated = 0;
			let linksUpserted = 0;
			const now = new Date().toISOString();

			const allKeys = new Set<string>([...desired.keys(), ...serverByKey.keys()]);

			for (const key of allKeys) {
				const localRow = desired.get(key) ?? null;
				const serverItems = serverByKey.get(key) ?? [];
				const existing = existingByKey.get(key);

				const hasLocal = localRow !== null;
				const hasServer = serverItems.length > 0;
				const sourceSystem = hasLocal && hasServer ? 'both' : hasLocal ? 'local' : 'server';
				const matchConfidence = hasLocal ? 'exact' : 'id';

				const title = localRow?.title ?? serverItems[0]?.title ?? 'Unknown';
				const year = localRow?.year ?? serverItems[0]?.year ?? null;
				const seriesName = serverItems[0]?.seriesName ?? null;
				const itemType = (localRow?.itemType ?? serverItems[0]?.itemType ?? 'movie') as
					| 'movie'
					| 'episode'
					| 'series'
					| 'season';
				const tmdbId = localRow?.tmdbId ?? serverItems[0]?.tmdbId ?? null;
				const tvdbId = serverItems[0]?.tvdbId ?? null;
				const imdbId = serverItems[0]?.imdbId ?? null;
				const seasonNumber = localRow?.seasonNumber ?? serverItems[0]?.seasonNumber ?? null;
				const episodeNumber = localRow?.episodeNumber ?? serverItems[0]?.episodeNumber ?? null;

				let itemId: string;
				if (existing) {
					itemId = existing.id;
					await db
						.update(storageItems)
						.set({
							title,
							year,
							seriesName,
							itemType,
							tmdbId,
							tvdbId,
							imdbId,
							seasonNumber,
							episodeNumber,
							movieFileId: localRow?.movieFileId ?? null,
							episodeFileId: localRow?.episodeFileId ?? null,
							rootFolderId: localRow?.rootFolderId ?? null,
							libraryId: localRow?.libraryId ?? null,
							sourceSystem,
							matchConfidence,
							lastReconciledAt: now
						})
						.where(eq(storageItems.id, existing.id));
					itemsUpdated++;
				} else {
					const [inserted] = await db
						.insert(storageItems)
						.values({
							itemType,
							tmdbId,
							tvdbId,
							imdbId,
							title,
							year,
							seriesName,
							seasonNumber,
							episodeNumber,
							movieFileId: localRow?.movieFileId ?? null,
							episodeFileId: localRow?.episodeFileId ?? null,
							rootFolderId: localRow?.rootFolderId ?? null,
							libraryId: localRow?.libraryId ?? null,
							sourceSystem,
							matchConfidence,
							firstSeenAt: now,
							lastReconciledAt: now
						})
						.returning({ id: storageItems.id });
					itemId = inserted.id;
					itemsInserted++;
				}
				keepItemIds.add(itemId);

				// Upsert server links
				for (const s of serverItems) {
					const linkKey = `${itemId}:${s.serverId}`;
					if (!existingLinkIds.has(linkKey)) {
						await db
							.insert(storageItemServerLinks)
							.values({
								storageItemId: itemId,
								serverId: s.serverId,
								syncedItemId: s.id,
								lastSeenAt: now
							})
							.onConflictDoNothing();
						linksUpserted++;
					} else {
						await db
							.update(storageItemServerLinks)
							.set({ lastSeenAt: now, syncedItemId: s.id })
							.where(
								and(
									eq(storageItemServerLinks.storageItemId, itemId),
									eq(storageItemServerLinks.serverId, s.serverId)
								)
							);
					}
				}
			}

			// Stale cleanup: remove rows no longer present in any source
			let itemsDeleted = 0;
			const staleIds = existingItems.filter((i) => !keepItemIds.has(i.id)).map((i) => i.id);
			if (staleIds.length > 0) {
				await db.delete(storageItems).where(inArray(storageItems.id, staleIds));
				itemsDeleted = staleIds.length;
			}

			const result: ReconcileResult = {
				itemsUpserted: itemsInserted + itemsUpdated,
				itemsInserted,
				itemsUpdated,
				itemsDeleted,
				linksUpserted,
				durationMs: Date.now() - start,
				skipped: false
			};
			logger.info(
				`[ReconciliationService] reconcile complete: ${result.itemsInserted} new, ${result.itemsUpdated} updated, ${result.itemsDeleted} removed, ${result.linksUpserted} links in ${result.durationMs}ms`
			);
			return result;
		} catch (e) {
			this._error = e instanceof Error ? e : new Error(String(e));
			logger.error('[ReconciliationService] reconcile threw', this._error);
			throw e;
		} finally {
			this.reconcileLock = false;
		}
	}

	private async loadLocalRows(): Promise<SourceRow[]> {
		const [movieFileRows, episodeFileRows] = await Promise.all([
			db
				.select({
					movieId: movies.id,
					movieFileId: movieFiles.id,
					tmdbId: movies.tmdbId,
					title: movies.title,
					year: movies.year,
					libraryId: movies.libraryId,
					rootFolderId: movies.rootFolderId
				})
				.from(movies)
				.leftJoin(movieFiles, eq(movieFiles.movieId, movies.id)),
			db
				.select({
					seriesId: series.id,
					episodeFileId: episodeFiles.id,
					tmdbId: series.tmdbId,
					title: series.title,
					year: series.year,
					libraryId: series.libraryId,
					rootFolderId: series.rootFolderId,
					seasonNumber: episodeFiles.seasonNumber
				})
				.from(series)
				.innerJoin(episodeFiles, eq(episodeFiles.seriesId, series.id))
		]);

		const movieRows: SourceRow[] = movieFileRows
			.filter((r) => r.tmdbId !== null && r.movieFileId !== null)
			.map((r) => ({
				itemType: 'movie' as const,
				tmdbId: r.tmdbId,
				title: r.title,
				year: r.year ?? null,
				seasonNumber: null,
				episodeNumber: null,
				movieFileId: r.movieFileId,
				episodeFileId: null,
				rootFolderId: r.rootFolderId ?? null,
				libraryId: r.libraryId ?? null
			}));

		const epRows: SourceRow[] = episodeFileRows
			.filter((r) => r.tmdbId !== null)
			.map((r) => ({
				itemType: 'episode' as const,
				tmdbId: r.tmdbId,
				title: r.title,
				year: r.year ?? null,
				seasonNumber: r.seasonNumber,
				episodeNumber: null, // episode files can be multi-episode; simplified for v1
				movieFileId: null,
				episodeFileId: r.episodeFileId,
				rootFolderId: r.rootFolderId ?? null,
				libraryId: r.libraryId ?? null
			}));

		return [...movieRows, ...epRows];
	}

	private async loadServerItems(): Promise<Array<typeof mediaServerSyncedItems.$inferSelect>> {
		return db
			.select()
			.from(mediaServerSyncedItems)
			.where(sql`${mediaServerSyncedItems.tmdbId} IS NOT NULL`);
	}
}

let instance: ReconciliationService | null = null;

export function getReconciliationService(): ReconciliationService {
	if (!instance) instance = new ReconciliationService();
	return instance;
}

/** Test-only: reset the singleton between tests. */
export function __resetReconciliationServiceForTests(): void {
	instance = null;
}
