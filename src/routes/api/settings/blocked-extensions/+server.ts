import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/authorization.js';
import { blockedSearchExtensionsSchema } from '$lib/validation/schemas.js';
import { parseBody } from '$lib/server/api/validate.js';
import {
	getBlockedExtensions,
	setBlockedExtensions,
	invalidateBlockedExtensionsCache
} from '$lib/server/settings/blocked-extensions.js';

export const GET: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const data = await getBlockedExtensions();
	return json({ success: true, ...data });
};

export const PUT: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const result = await parseBody(event.request, blockedSearchExtensionsSchema);

	await setBlockedExtensions(result);

	invalidateBlockedExtensionsCache();

	return json({ success: true, ...result });
};
