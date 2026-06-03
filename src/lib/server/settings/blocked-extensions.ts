import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createChildLogger } from '$lib/logging';
import {
	blockedSearchExtensionsSchema,
	type BlockedSearchExtensions
} from '$lib/validation/schemas.js';

const logger = createChildLogger({ module: 'BlockedExtensions' });
const SETTINGS_KEY = 'blocked_search_extensions';

let cached: BlockedSearchExtensions | null = null;

export async function getBlockedExtensions(): Promise<BlockedSearchExtensions> {
	if (cached) return cached;

	const row = await db.query.settings.findFirst({ where: eq(settings.key, SETTINGS_KEY) });

	if (row?.value) {
		try {
			const parsed = blockedSearchExtensionsSchema.parse(JSON.parse(row.value));
			cached = parsed;
			return parsed;
		} catch {
			logger.warn('Failed to parse blocked extensions, using defaults');
		}
	}

	const defaults = blockedSearchExtensionsSchema.parse({});
	cached = defaults;
	return defaults;
}

export async function setBlockedExtensions(
	data: BlockedSearchExtensions
): Promise<BlockedSearchExtensions> {
	await db
		.insert(settings)
		.values({ key: SETTINGS_KEY, value: JSON.stringify(data) })
		.onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(data) } });

	cached = data;
	return data;
}

export function invalidateBlockedExtensionsCache(): void {
	cached = null;
}
