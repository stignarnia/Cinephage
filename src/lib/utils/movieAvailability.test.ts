import { describe, it, expect } from 'vitest';
import { getMovieAvailabilityLevel, getReleaseStageInfo } from './movieAvailability';

describe('getMovieAvailabilityLevel', () => {
	const now = new Date('2026-06-10T00:00:00.000Z');

	describe('with typed release_dates data', () => {
		it('returns released when past Digital date exists', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 4, release_date: '2026-05-19T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('released');
		});

		it('returns released when past Physical date exists', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 5, release_date: '2026-06-01T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('released');
		});

		it('returns released when past TV date exists', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 6, release_date: '2026-06-05T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('released');
		});

		it('returns inCinemas when only theatrical dates exist (status Released)', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-22',
					releaseDates: [
						{ type: 1, release_date: '2026-05-14T00:00:00.000Z' },
						{ type: 3, release_date: '2026-05-22T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('inCinemas');
		});

		it('returns inCinemas when Digital date is in the future', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 4, release_date: '2026-07-15T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('inCinemas');
		});

		it('returns announced when status is planned and no downloadable dates', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2027,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Planned',
					releaseDates: []
				},
				now
			);
			expect(availability).toBe('announced');
		});
	});

	describe('without release_dates data (backward compatibility)', () => {
		it('uses TMDB released status when available', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z',
					tmdbStatus: 'Released'
				},
				now
			);

			expect(availability).toBe('released');
		});

		it('uses TMDB pre-release statuses as announced', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z',
					tmdbStatus: 'In Production'
				},
				now
			);

			expect(availability).toBe('announced');
		});

		it('uses release date when status is unknown', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z',
					releaseDate: '2026-01-27'
				},
				now
			);

			expect(availability).toBe('released');
		});

		it('falls back to legacy heuristics when TMDB metadata is missing', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z'
				},
				now
			);

			expect(availability).toBe('inCinemas');
		});
	});
});

describe('getReleaseStageInfo', () => {
	const now = new Date('2026-06-10T00:00:00.000Z');

	it('returns null when no release dates provided', () => {
		expect(getReleaseStageInfo(null, now)).toBeNull();
		expect(getReleaseStageInfo([], now)).toBeNull();
	});

	it('returns null when only theatrical dates exist', () => {
		const result = getReleaseStageInfo(
			[
				{ type: 1, release_date: '2026-05-14T00:00:00.000Z' },
				{ type: 3, release_date: '2026-05-22T00:00:00.000Z' }
			],
			now
		);
		expect(result).toBeNull();
	});

	it('returns earliest past digital release', () => {
		const result = getReleaseStageInfo(
			[
				{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
				{ type: 4, release_date: '2026-05-19T00:00:00.000Z' },
				{ type: 5, release_date: '2026-06-15T00:00:00.000Z' }
			],
			now
		);
		expect(result).toEqual({
			type: 'digital',
			date: '2026-05-19',
			isPast: true
		});
	});

	it('returns future digital release with isPast false', () => {
		const result = getReleaseStageInfo(
			[
				{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
				{ type: 4, release_date: '2026-07-15T00:00:00.000Z' }
			],
			now
		);
		expect(result).toEqual({
			type: 'digital',
			date: '2026-07-15',
			isPast: false
		});
	});

	it('returns earliest type when multiple downloadable types exist', () => {
		const result = getReleaseStageInfo(
			[
				{ type: 4, release_date: '2026-06-20T00:00:00.000Z' },
				{ type: 5, release_date: '2026-06-01T00:00:00.000Z' }
			],
			now
		);
		expect(result).toEqual({
			type: 'physical',
			date: '2026-06-01',
			isPast: true
		});
	});
});
