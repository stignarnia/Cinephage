<script lang="ts">
	import { SettingsPage } from '$lib/components/ui/settings';
	import { ArrowLeft } from 'lucide-svelte';
	import LibraryOverview from '$lib/components/storage/LibraryOverview.svelte';
	import { LibraryEditModal } from '$lib/components/libraries';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let libraryModalOpen = $state(false);
	let editingLibraryId = $state<string | null>(null);

	function openEditLibrary(libraryId: string) {
		editingLibraryId = libraryId;
		libraryModalOpen = true;
	}

	function closeLibraryModal() {
		libraryModalOpen = false;
		editingLibraryId = null;
	}
</script>

<svelte:head>
	<title>Libraries</title>
</svelte:head>

<SettingsPage title="Libraries" subtitle="Manage your media libraries and their root folders">
	{#snippet actions()}
		<a href="/settings/monitoring/status" class="btn btn-ghost btn-sm gap-2">
			<ArrowLeft class="h-4 w-4" />
			Dashboard
		</a>
	{/snippet}

	<LibraryOverview libraries={data.storage.libraryBreakdown} onEditLibrary={openEditLibrary} />
</SettingsPage>

{#if libraryModalOpen}
	<LibraryEditModal
		open={libraryModalOpen}
		libraryId={editingLibraryId}
		libraries={data.libraries}
		rootFolders={data.rootFolders}
		onClose={closeLibraryModal}
	/>
{/if}
