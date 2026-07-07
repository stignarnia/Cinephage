<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { HardDrive, RefreshCw } from 'lucide-svelte';
	import { SettingsPage } from '$lib/components/ui/settings';
	import { StorageDashboard } from '$lib/components/storage';
	import { layoutState } from '$lib/layout.svelte';
	import { toasts } from '$lib/stores/toast.svelte';
	import { scanLibrary } from '$lib/api/library.js';
	import { syncMediaServerStats } from '$lib/api/settings.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type ScanSuccess = { message: string; unmatchedCount: number };

	// One-shot feedback for the most recent user-triggered action. Ongoing
	// scan/sync state lives in layoutState so it survives sub-page navigation;
	// these flags are only for transient messages tied to this dashboard view.
	let scanError = $state<string | null>(null);
	let scanSuccess = $state<ScanSuccess | null>(null);

	function resetScanState() {
		scanError = null;
		scanSuccess = null;
	}

	async function triggerLibraryScan(rootFolderId?: string) {
		resetScanState();
		try {
			await scanLibrary(rootFolderId ? { rootFolderId } : { fullScan: true });
		} catch (error) {
			scanError = error instanceof Error ? error.message : m.settings_general_failedToStartScan();
		}
	}

	async function triggerServerSync() {
		// Just kick off the sync. The layout's /api/media-server-stats/sync/status
		// SSE drives layoutState.mediaServerSyncing and calls invalidateAll() on
		// completion (after the reconcile -> insights chain fires).
		try {
			await syncMediaServerStats();
		} catch (error) {
			toasts.error(error instanceof Error ? error.message : 'Sync failed');
		}
	}
</script>

<svelte:head>
	<title>{m.nav_storageMaintenance()}</title>
</svelte:head>

<SettingsPage
	title={m.nav_storageMaintenance()}
	subtitle="Storage health, library maintenance, and media server analytics"
>
	{#snippet actions()}
		<div class="flex gap-2">
			<button
				type="button"
				class="btn btn-sm btn-primary gap-2"
				onclick={() => void triggerLibraryScan()}
				disabled={layoutState.scanInProgress || data.rootFolders.length === 0}
			>
				{#if layoutState.scanInProgress}
					<RefreshCw class="h-4 w-4 animate-spin" />
					{m.settings_general_scanning()}
				{:else}
					<HardDrive class="h-4 w-4" />
					{m.settings_general_scanLibraries()}
				{/if}
			</button>
			{#if data.servers?.length > 0}
				<button
					type="button"
					class="btn btn-outline btn-sm gap-2"
					onclick={() => void triggerServerSync()}
					disabled={layoutState.mediaServerSyncing}
				>
					<RefreshCw class="h-4 w-4 {layoutState.mediaServerSyncing ? 'animate-spin' : ''}" />
					Sync Servers
				</button>
			{/if}
		</div>
	{/snippet}

	<StorageDashboard
		storage={data.storage}
		libraryBreakdown={data.storage.libraryBreakdown}
		rootFolderBreakdown={data.storage.rootFolderBreakdown}
		insights={data.insights}
		mediaServerStats={data.mediaServerStats}
		topItems={data.topItems}
		largestItems={data.largestItems}
		{scanError}
		{scanSuccess}
		serverStatuses={data.serverStatuses}
	/>
</SettingsPage>
