import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import {
	createTestDb,
	destroyTestDb,
	clearTestDb,
	type TestDatabase
} from '../../../../../test/db-helper.js';
import { movies, movieFiles } from '$lib/server/db/schema';

const testDb: TestDatabase = createTestDb();

vi.mock('$lib/server/db', () => ({
	get db() {
		return testDb.db;
	},
	get sqlite() {
		return testDb.sqlite;
	},
	initializeDatabase: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/db/index.js', () => ({
	get db() {
		return testDb.db;
	},
	get sqlite() {
		return testDb.sqlite;
	},
	initializeDatabase: vi.fn().mockResolvedValue(undefined)
}));

import { DuplicateItemsRule } from './DuplicateItemsRule.js';
import type { RuleContext } from '../types.js';
import { createMovie, createMovieFile } from '../../../../../test/fixtures/index.js';

describe('DuplicateItemsRule', () => {
	const rule = new DuplicateItemsRule();

	afterAll(() => destroyTestDb(testDb));
	beforeEach(async () => {
		await clearTestDb(testDb);
	});

	it('has type "duplicate-items"', () => {
		expect(rule.type).toBe('duplicate-items');
	});

	it('detects movies with multiple files for the same tmdbId', async () => {
		await testDb.db
			.insert(movies)
			.values(createMovie({ id: 'm-1', tmdbId: 100, title: 'Duplicate Movie' }));
		await testDb.db.insert(movieFiles).values([
			createMovieFile({
				id: 'mf-1',
				movieId: 'm-1',
				relativePath: 'version-a.mkv',
				size: 1000
			}) as typeof movieFiles.$inferInsert,
			createMovieFile({
				id: 'mf-2',
				movieId: 'm-1',
				relativePath: 'version-b.mkv',
				size: 2000
			}) as typeof movieFiles.$inferInsert
		]);

		const findings = await rule.evaluate({
			db: testDb.db as RuleContext['db'],
			now: '2026-07-01T00:00:00.000Z'
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].itemCount).toBe(1);
		expect(findings[0].severity).toBe('warning');
		expect(findings[0].title).toContain('duplicate');
	});

	it('returns zero findings when no duplicates exist', async () => {
		await testDb.db
			.insert(movies)
			.values(createMovie({ id: 'm-2', tmdbId: 200, title: 'Single File' }));
		await testDb.db
			.insert(movieFiles)
			.values(
				createMovieFile({
					id: 'mf-3',
					movieId: 'm-2',
					size: 1000
				}) as typeof movieFiles.$inferInsert
			);

		const findings = await rule.evaluate({
			db: testDb.db as RuleContext['db'],
			now: '2026-07-01T00:00:00.000Z'
		});
		expect(findings).toHaveLength(0);
	});
});
