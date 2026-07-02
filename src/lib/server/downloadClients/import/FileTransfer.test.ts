/**
 * FileTransfer.moveFile() Safety Tests
 *
 * Validates all safety guards: no-op for identical paths, parent-path
 * collision detection, source-first verification, and filesystem operations
 * against real temp directory files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { moveFile, fileExists } from './FileTransfer';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stat } from 'node:fs/promises';

describe('moveFile safety guards', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), 'cinephage-movefile-test-'));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	async function createFile(name: string, content = 'test content'): Promise<string> {
		const path = join(tmpDir, name);
		await writeFile(path, content);
		return path;
	}

	describe('source === destination (no-op guard)', () => {
		it('returns success without deleting the file', async () => {
			const file = await createFile('movie.mkv', 'hello world');

			const result = await moveFile(file, file);

			expect(result.success).toBe(true);
			expect(result.mode).toBe('move');

			// File must still exist and have its original content.
			const stillExists = await fileExists(file);
			expect(stillExists).toBe(true);
			const s = await stat(file);
			expect(s.size).toBe(11);
		});

		it('returns success when paths differ syntactically but resolve identically', async () => {
			const file = await createFile('movie.mkv', 'hello world');
			// path/../path/movie.mkv resolves to path/movie.mkv
			const aliasedPath = join(tmpDir, '..', tmpDir.split('/').pop()!, 'movie.mkv');

			const result = await moveFile(file, aliasedPath);

			expect(result.success).toBe(true);
			const stillExists = await fileExists(file);
			expect(stillExists).toBe(true);
		});

		it('fails when source does not exist even when paths match', async () => {
			const nonexistent = join(tmpDir, 'does-not-exist.mkv');

			const result = await moveFile(nonexistent, nonexistent);

			expect(result.success).toBe(false);
			expect(result.error).toContain('does not exist');
		});
	});

	describe('source existence verification', () => {
		it('fails before deleting destination when source is missing', async () => {
			const dest = await createFile('existing-dest.mkv', 'dest content');
			const source = join(tmpDir, 'missing-source.mkv');

			const result = await moveFile(source, dest);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Source file not found');

			// Destination must be untouched.
			const destStillExists = await fileExists(dest);
			expect(destStillExists).toBe(true);
			const s = await stat(dest);
			expect(s.size).toBe(12);
		});
	});

	describe('parent-path collision guard', () => {
		it('refuses to move a file into its own descendant directory', async () => {
			const file = await createFile('movie.mkv', 'content');

			// Pretend file IS the directory we're trying to move into.
			// The collision check is: dest starts with source + '/'
			const destPath = join(file, 'nested', 'file.mkv');

			const result = await moveFile(file, destPath);

			expect(result.success).toBe(false);
			expect(result.error).toContain('child of the source path');
		});

		it('allows moves to unrelated directories', async () => {
			const source = await createFile('movie.mkv', 'content');
			const dest = join(tmpDir, 'other-dir', 'movie.mkv');

			const result = await moveFile(source, dest);

			expect(result.success).toBe(true);
			const stillExists = await fileExists(dest);
			expect(stillExists).toBe(true);
			const srcExists = await fileExists(source);
			expect(srcExists).toBe(false);
		});
	});

	describe('actual file move', () => {
		it('moves a file to a new path and removes source', async () => {
			const source = await createFile('source.mkv', 'hello world');
			const dest = join(tmpDir, 'sub', 'dest.mkv');

			const result = await moveFile(source, dest);

			expect(result.success).toBe(true);
			expect(result.mode).toBe('move');

			const destExists = await fileExists(dest);
			expect(destExists).toBe(true);
			const srcExists = await fileExists(source);
			expect(srcExists).toBe(false);

			const s = await stat(dest);
			expect(s.size).toBe(11);
		});

		it('overwrites an existing destination when moving', async () => {
			const source = await createFile('source.mkv', 'new content');
			const dest = await createFile('dest.mkv', 'old content');

			const result = await moveFile(source, dest);

			expect(result.success).toBe(true);

			const destExists = await fileExists(dest);
			expect(destExists).toBe(true);
			const s = await stat(dest);
			expect(s.size).toBe(11); // new content
		});
	});

	describe('case-insensitive rename safety (Radarr pattern)', () => {
		it('handles case-only renames without data loss', async () => {
			const source = await createFile('Movie.mkv', 'case test content');
			// Same directory, different case
			const dest = join(tmpDir, 'movie.mkv');

			const result = await moveFile(source, dest);

			expect(result.success).toBe(true);

			// Because we're on a case-sensitive filesystem (Linux),
			// both can coexist as separate files. Verify the move worked.
			const destExists = await fileExists(dest);
			expect(destExists).toBe(true);

			const s = await stat(dest);
			expect(s.size).toBe(17);
		});
	});
});
