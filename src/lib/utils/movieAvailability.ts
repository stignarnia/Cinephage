export type MovieAvailabilityLevel = 'announced' | 'inCinemas' | 'released';

export interface ReleaseStageInfo {
	/** Human-readable stage name: 'digital', 'physical', 'tv' */
	type: 'digital' | 'physical' | 'tv';
	/** ISO date string of the earliest past release */
	date: string;
	/** Whether this date is in the past (release is available now) */
	isPast: boolean;
}

interface MovieAvailabilityInput {
	year: number | null | undefined;
	added: string | null | undefined;
	tmdbStatus?: string | null | undefined;
	releaseDate?: string | null | undefined;
	/** Flattened release dates from TMDB release_dates response */
	releaseDates?: Array<{ type: number; release_date: string }> | null | undefined;
}

const DOWNLOADABLE_TYPES = new Set([4, 5, 6]);

const TYPE_NAME: Record<number, 'digital' | 'physical' | 'tv'> = {
	4: 'digital',
	5: 'physical',
	6: 'tv'
};

/**
 * Extract the earliest downloadable release stage from TMDB release_dates data.
 * Returns the earliest Digital (4), Physical (5), or TV (6) release.
 * If multiple types exist, returns the one with the earliest date.
 */
export function getReleaseStageInfo(
	releaseDates?: Array<{ type: number; release_date: string }> | null,
	now: Date = new Date()
): ReleaseStageInfo | null {
	if (!releaseDates || releaseDates.length === 0) return null;

	let earliest: ReleaseStageInfo | null = null;

	for (const rd of releaseDates) {
		if (!DOWNLOADABLE_TYPES.has(rd.type)) continue;

		const dateStr = rd.release_date?.substring(0, 10);
		if (!dateStr) continue;

		const ts = new Date(dateStr).getTime();
		if (Number.isNaN(ts)) continue;

		if (!earliest || ts < new Date(earliest.date).getTime()) {
			earliest = {
				type: TYPE_NAME[rd.type] ?? 'digital',
				date: dateStr,
				isPast: ts <= now.getTime()
			};
		}
	}

	return earliest;
}

/**
 * Determine movie availability using TMDB status/date when available.
 * Falls back to year/added heuristics when TMDB metadata is unavailable.
 *
 * A movie is considered 'released' when it has a past Digital (4),
 * Physical (5), or TV (6) release date. Being in theaters alone
 * (TMDB status "Released" with only theatrical dates) results in 'inCinemas'.
 */
export function getMovieAvailabilityLevel(
	movie: MovieAvailabilityInput,
	now: Date = new Date()
): MovieAvailabilityLevel {
	const releaseDates = movie.releaseDates;

	// If we have typed release_dates data, use it to determine downloadable status.
	if (releaseDates && releaseDates.length > 0) {
		// Check for any past Digital/Physical/TV release
		const hasPastDownloadable = releaseDates.some((rd) => {
			if (!DOWNLOADABLE_TYPES.has(rd.type)) return false;
			const dateStr = rd.release_date?.substring(0, 10);
			if (!dateStr) return false;
			const ts = new Date(dateStr).getTime();
			return !Number.isNaN(ts) && ts <= now.getTime();
		});

		if (hasPastDownloadable) return 'released';

		// Has release_dates but no past downloadable → check if it's at least in theaters
		const status = movie.tmdbStatus?.trim().toLowerCase();
		const releaseTimestamp = movie.releaseDate ? new Date(movie.releaseDate).getTime() : Number.NaN;
		const hasValidReleaseDate = !Number.isNaN(releaseTimestamp);

		if (status === 'released') return 'inCinemas';
		if (status === 'post production') {
			if (hasValidReleaseDate && releaseTimestamp <= now.getTime()) return 'inCinemas';
			return 'inCinemas';
		}
		if (status === 'in production' || status === 'planned' || status === 'rumored') {
			return 'announced';
		}
		if (status === 'canceled') {
			return 'announced';
		}

		// Fall through to date heuristics for unknown statuses
		if (hasValidReleaseDate) {
			return releaseTimestamp <= now.getTime() ? 'inCinemas' : 'announced';
		}
	}

	// === Legacy heuristics (no release_dates data) ===

	const status = movie.tmdbStatus?.trim().toLowerCase();
	const releaseTimestamp = movie.releaseDate ? new Date(movie.releaseDate).getTime() : Number.NaN;
	const hasValidReleaseDate = !Number.isNaN(releaseTimestamp);

	if (status === 'released') return 'released';
	if (status === 'post production') {
		if (hasValidReleaseDate && releaseTimestamp <= now.getTime()) return 'released';
		return 'inCinemas';
	}
	if (status === 'in production' || status === 'planned' || status === 'rumored') {
		return 'announced';
	}
	if (status === 'canceled') {
		return 'announced';
	}

	// Use explicit TMDB release date when status is unavailable/unknown.
	if (hasValidReleaseDate) {
		return releaseTimestamp <= now.getTime() ? 'released' : 'announced';
	}

	const currentYear = now.getFullYear();
	const movieYear = movie.year;

	if (!movieYear) return 'announced';
	if (movieYear > currentYear) return 'announced';
	if (movieYear < currentYear) return 'released';

	// Current-year movies are unreleased by default and only considered released
	// after they have been in-library for a sustained period.
	const addedTimestamp = movie.added ? new Date(movie.added).getTime() : Number.NaN;
	if (Number.isNaN(addedTimestamp)) return 'inCinemas';

	const daysSinceAdded = (now.getTime() - addedTimestamp) / (1000 * 60 * 60 * 24);
	if (daysSinceAdded > 120) return 'released';
	return 'inCinemas';
}
