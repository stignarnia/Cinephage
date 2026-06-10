import type { ReleaseDatesResponse } from '$lib/types/tmdb';

export interface ExtractedReleaseDates {
	theatricalDate: string | null;
	digitalReleaseDate: string | null;
	physicalReleaseDate: string | null;
}

export function extractReleaseDates(
	releaseDates: ReleaseDatesResponse | undefined | null,
	region: string
): ExtractedReleaseDates {
	const empty: ExtractedReleaseDates = {
		theatricalDate: null,
		digitalReleaseDate: null,
		physicalReleaseDate: null
	};

	if (!releaseDates?.results || releaseDates.results.length === 0) return empty;

	const regionData = releaseDates.results.find(
		(r) => r.iso_3166_1.toUpperCase() === region.toUpperCase()
	);

	const entries = regionData?.release_dates ?? flattenAll(releaseDates.results);

	let theatrical: string | null = null;
	let digital: string | null = null;
	let physical: string | null = null;

	for (const rd of entries) {
		const dateStr = rd.release_date?.substring(0, 10);
		if (!dateStr || Number.isNaN(new Date(dateStr).getTime())) continue;

		if ((rd.type === 2 || rd.type === 3) && (!theatrical || dateStr < theatrical)) {
			theatrical = dateStr;
		} else if (rd.type === 4 && (!digital || dateStr < digital)) {
			digital = dateStr;
		} else if (rd.type === 5 && (!physical || dateStr < physical)) {
			physical = dateStr;
		}
	}

	return {
		theatricalDate: theatrical,
		digitalReleaseDate: digital,
		physicalReleaseDate: physical
	};
}

function flattenAll(
	results: ReleaseDatesResponse['results']
): Array<{ type: number; release_date: string }> {
	const flattened: Array<{ type: number; release_date: string }> = [];
	for (const country of results) {
		for (const rd of country.release_dates) {
			flattened.push({ type: rd.type, release_date: rd.release_date });
		}
	}
	return flattened;
}
