import type { PageServerLoad } from './$types';
import { getLibraryEntityService } from '$lib/server/library/LibraryEntityService.js';

export const load: PageServerLoad = async () => {
	const libraryService = getLibraryEntityService();
	const libraries = await libraryService.listLibraries();
	return { libraries };
};
