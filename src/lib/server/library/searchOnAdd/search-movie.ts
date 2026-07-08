import { eq } from 'drizzle-orm';
import { logger } from '$lib/logging/index.js';
import { db } from '$lib/server/db/index.js';
import { movieFiles } from '$lib/server/db/schema.js';
import { grabService } from '$lib/server/downloads/GrabService.js';
import { getIndexerManager } from '$lib/server/indexers/IndexerManager.js';
import { evaluateIndexerSearchAvailability } from '$lib/server/indexers/search/availability';
import type { SearchCriteria } from '$lib/server/indexers/types';
import { AUTO_GRAB_MIN_SCORE } from './search-utils.js';
import type { AltTitleRefresher } from './alt-titles.js';
import type { SearchForMovieParams, GrabResult } from './types.js';

export async function searchForMovie(
	params: SearchForMovieParams,
	altTitles: AltTitleRefresher
): Promise<GrabResult> {
	const { movieId, tmdbId, imdbId, title, year, scoringProfileId, onProgress } = params;

	logger.info({ movieId, tmdbId, title, year }, '[SearchOnAdd] Starting movie search');

	// Report initial progress
	onProgress?.('initializing', `Starting search for "${title}"...`, { current: 0, total: 100 });

	try {
		// Check if movie already has a file
		onProgress?.('checking', 'Checking existing files...', { current: 5, total: 100 });

		const existingFile = await db.query.movieFiles.findFirst({
			where: eq(movieFiles.movieId, movieId)
		});

		const hasExistingFile = !!existingFile;
		logger.debug({ movieId, hasExistingFile }, '[SearchOnAdd] Movie file status');

		const indexerManager = await getIndexerManager();
		const searchSource: 'interactive' | 'automatic' = 'automatic';
		const indexerAvailability = evaluateIndexerSearchAvailability(
			await indexerManager.getIndexers(),
			{
				searchType: 'movie',
				searchSource,
				scoringProfileId,
				getDefinitionCapabilities: (definitionId) =>
					indexerManager.getDefinitionCapabilities(definitionId)
			}
		);

		if (!indexerAvailability.ok) {
			const errorMessage = indexerAvailability.message || 'No indexers are available';
			logger.info(
				{
					movieId,
					code: indexerAvailability.code,
					message: errorMessage
				},
				'[SearchOnAdd] Movie search blocked by indexer availability'
			);
			onProgress?.('error', errorMessage, { current: 100, total: 100 });
			return { success: false, error: errorMessage };
		}

		// Build search criteria
		const movieSearchTitles = await altTitles.getMovieSearchTitlesWithRefresh(movieId, tmdbId);
		const criteria: SearchCriteria = {
			searchType: 'movie',
			query: title,
			tmdbId,
			imdbId: imdbId ?? undefined,
			year,
			searchTitles: movieSearchTitles.length > 0 ? movieSearchTitles : [title]
		};

		// Perform enriched search to get scored releases (automatic - on add)
		onProgress?.('searching', 'Querying indexers for releases...', { current: 10, total: 100 });

		const searchResult = await indexerManager.searchEnhanced(criteria, {
			searchSource,
			enrichment: {
				scoringProfileId,
				filterRejected: true,
				minScore: AUTO_GRAB_MIN_SCORE
			}
		});

		logger.info(
			{
				movieId,
				totalResults: searchResult.releases.length,
				rejectedCount: searchResult.rejectedCount
			},
			'[SearchOnAdd] Movie search completed'
		);

		// Log the top releases for debugging
		if (searchResult.releases.length > 0) {
			const topReleases = searchResult.releases.slice(0, 5).map((r) => ({
				title: r.title,
				totalScore: r.totalScore,
				resolution: r.parsed.resolution,
				source: r.parsed.source,
				codec: r.parsed.codec,
				size: r.size ? Math.round((r.size / 1024 / 1024 / 1024) * 10) / 10 + 'GB' : 'unknown'
			}));
			logger.info({ movieId, topReleases }, '[SearchOnAdd] Top 5 releases by score');
		}

		if (searchResult.releases.length === 0) {
			logger.info({ movieId, title }, '[SearchOnAdd] No suitable releases found for movie');
			onProgress?.('complete', 'No suitable releases found', { current: 100, total: 100 });
			return { success: false, error: 'No suitable releases found' };
		}

		onProgress?.('evaluating', `Found ${searchResult.releases.length} releases, evaluating...`, {
			current: 50,
			total: 100
		});

		// If movie has existing file, filter to only upgrades
		if (hasExistingFile) {
			logger.info({ movieId }, '[SearchOnAdd] Movie has existing file, checking for upgrades');
			onProgress?.('evaluating', 'Checking for upgrade releases...', { current: 60, total: 100 });

			// Find the first release that qualifies as an upgrade
			for (let i = 0; i < searchResult.releases.length; i++) {
				const release = searchResult.releases[i];

				onProgress?.('grabbing', `Grabbing: ${release.title.substring(0, 50)}...`, {
					current: 85,
					total: 100
				});

				const grabResult = await grabService.grab({
					release: {
						title: release.title,
						infoHash: release.infoHash,
						magnetUrl: release.magnetUrl,
						downloadUrl: release.downloadUrl,
						indexerId: release.indexerId,
						indexerName: release.indexerName,
						size: release.size,
						protocol: release.protocol as 'torrent' | 'usenet' | 'streaming' | undefined
					},
					target: { type: 'movie' as const, movieId },
					options: {
						force: false,
						skipBlocklist: false,
						allowSidegrade: false,
						isAutomatic: true,
						isUpgrade: true
					}
				});

				if (grabResult.success) {
					onProgress?.('complete', `✓ Grabbed: ${release.title}`, {
						current: 100,
						total: 100
					});

					return {
						success: true,
						releaseName: release.title,
						queueItemId: grabResult.download?.queueId
					};
				}

				const grabError = grabResult.error ?? grabResult.decision?.reason ?? 'Unknown error';
				onProgress?.('error', `Failed to grab: ${grabError}`, {
					current: 100,
					total: 100
				});

				return {
					success: false,
					error: grabError
				};
			}

			logger.info({ movieId }, '[SearchOnAdd] No upgrades found for movie with existing file');
			onProgress?.('complete', 'No upgrades found - existing file quality is sufficient', {
				current: 100,
				total: 100
			});
			return { success: false, error: 'No upgrades found - existing file quality is sufficient' };
		}

		// No existing file - grab the top-ranked release
		const bestRelease = searchResult.releases[0];
		onProgress?.('grabbing', `Grabbing best release: ${bestRelease.title.substring(0, 50)}...`, {
			current: 85,
			total: 100
		});

		const grabResult = await grabService.grab({
			release: {
				title: bestRelease.title,
				infoHash: bestRelease.infoHash,
				magnetUrl: bestRelease.magnetUrl,
				downloadUrl: bestRelease.downloadUrl,
				indexerId: bestRelease.indexerId,
				indexerName: bestRelease.indexerName,
				size: bestRelease.size,
				protocol: bestRelease.protocol as 'torrent' | 'usenet' | 'streaming' | undefined
			},
			target: { type: 'movie' as const, movieId },
			options: {
				force: false,
				skipBlocklist: false,
				allowSidegrade: false,
				isAutomatic: true,
				isUpgrade: false
			}
		});

		if (grabResult.success) {
			onProgress?.('complete', `✓ Grabbed: ${bestRelease.title}`, {
				current: 100,
				total: 100
			});
		} else {
			const grabError = grabResult.error ?? grabResult.decision?.reason ?? 'Unknown error';
			onProgress?.('error', `Failed to grab: ${grabError}`, {
				current: 100,
				total: 100
			});
		}

		return {
			success: grabResult.success,
			releaseName: grabResult.success ? bestRelease.title : undefined,
			queueItemId: grabResult.download?.queueId,
			error: grabResult.error ?? (grabResult.success ? undefined : grabResult.decision?.reason)
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		logger.error({ movieId, err: error }, '[SearchOnAdd] Movie search failed');
		onProgress?.('error', `Search failed: ${message}`, { current: 100, total: 100 });
		return { success: false, error: message };
	}
}
