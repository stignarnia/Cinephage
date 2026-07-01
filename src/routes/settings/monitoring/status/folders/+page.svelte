<script lang="ts">
	import { SettingsPage } from '$lib/components/ui/settings';
	import { ArrowLeft } from 'lucide-svelte';
	import RootFolderOverview from '$lib/components/storage/RootFolderOverview.svelte';
	import { RootFolderModal } from '$lib/components/rootFolders';
	import { validateRootFolder, updateRootFolder } from '$lib/api/settings.js';
	import { scanLibrary } from '$lib/api/library.js';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toast.svelte';
	import type {
		RootFolder,
		RootFolderFormData,
		PathValidationResult
	} from '$lib/types/downloadClient';
	import type { RootFolderUpdate } from '$lib/validation/schemas.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let folderModalOpen = $state(false);
	let editingFolder = $state<RootFolder | null>(null);
	let folderSaving = $state(false);
	let folderSaveError = $state<string | null>(null);

	function openEditFolder(rootFolderId: string) {
		const folder = data.rootFolders.find((f) => f.id === rootFolderId);
		if (!folder) {
			toasts.error('Root folder not found');
			return;
		}
		editingFolder = folder;
		folderSaveError = null;
		folderModalOpen = true;
	}

	function closeFolderModal() {
		folderModalOpen = false;
		editingFolder = null;
		folderSaveError = null;
	}

	async function handleValidatePath(
		path: string,
		_readOnly = false,
		folderId?: string
	): Promise<PathValidationResult> {
		try {
			const payload = await validateRootFolder(path, undefined, folderId);
			return payload as unknown as PathValidationResult;
		} catch (error) {
			return {
				valid: false,
				exists: false,
				writable: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	async function handleFolderSave(formData: RootFolderFormData) {
		if (!editingFolder) return;
		folderSaving = true;
		folderSaveError = null;
		try {
			await updateRootFolder(editingFolder.id, formData as RootFolderUpdate);
			await invalidateAll();
			closeFolderModal();
			toasts.success('Root folder updated');
		} catch (error) {
			folderSaveError = error instanceof Error ? error.message : 'Failed to save root folder';
		} finally {
			folderSaving = false;
		}
	}

	async function handleScanRootFolder(rootFolderId: string) {
		try {
			await scanLibrary({ rootFolderId });
			toasts.success('Scan started');
		} catch (error) {
			toasts.error(error instanceof Error ? error.message : 'Failed to start scan');
		}
	}
</script>

<svelte:head>
	<title>Root Folders</title>
</svelte:head>

<SettingsPage title="Root Folders" subtitle="Manage disk paths, capacity, and scan status">
	{#snippet actions()}
		<a href="/settings/monitoring/status" class="btn btn-ghost btn-sm gap-2">
			<ArrowLeft class="h-4 w-4" />
			Dashboard
		</a>
	{/snippet}

	<RootFolderOverview
		rootFolders={data.storage.rootFolderBreakdown}
		onEditRootFolder={openEditFolder}
		onScanRootFolder={handleScanRootFolder}
	/>
</SettingsPage>

<RootFolderModal
	open={folderModalOpen}
	mode="edit"
	folder={editingFolder}
	saving={folderSaving}
	error={folderSaveError}
	onClose={closeFolderModal}
	lockScroll={false}
	onSave={handleFolderSave}
	onValidatePath={handleValidatePath}
/>
