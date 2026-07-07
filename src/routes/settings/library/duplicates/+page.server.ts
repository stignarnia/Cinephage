import type { PageServerLoad } from './$types';
import { getLibraryEntityService } from '$lib/server/library/LibraryEntityService.js';

export const load: PageServerLoad = async () => {
	return { libraries: await getLibraryEntityService().listLibraries() };
};
