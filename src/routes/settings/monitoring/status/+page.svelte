<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { HardDrive, RefreshCw } from 'lucide-svelte';
	import { SettingsPage } from '$lib/components/ui/settings';
	import { StorageDashboard } from '$lib/components/storage';
	import { layoutState } from '$lib/layout.svelte';
	import { toasts } from '$lib/stores/toast.svelte';
	import { scanLibrary } from '$lib/api/library.js';
	import { syncMediaServerStats } from '$lib/api/settings.js';
	import {
		getHistoryRetention,
		saveHistoryRetention,
		getStorageForecast,
		type HistoryRetentionSettings,
		type StorageForecast
	} from '$lib/api/history-retention.js';
	import { formatBytes } from '$lib/utils/format.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type ScanSuccess = { message: string; unmatchedCount: number };

	// One-shot feedback for the most recent user-triggered action. Ongoing
	// scan/sync state lives in layoutState so it survives sub-page navigation;
	// these flags are only for transient messages tied to this dashboard view.
	let scanError = $state<string | null>(null);
	let scanSuccess = $state<ScanSuccess | null>(null);

	let retention = $state<HistoryRetentionSettings | null>(null);
	let forecast = $state<StorageForecast | null>(null);
	let retentionSaving = $state(false);
	let retentionOpen = $state(false);

	$effect(() => {
		void (async () => {
			try {
				[retention, forecast] = await Promise.all([getHistoryRetention(), getStorageForecast()]);
			} catch {
				/* silent */
			}
		})();
	});

	async function handleSaveRetention() {
		if (!retention) return;
		retentionSaving = true;
		try {
			await saveHistoryRetention(retention);
			toasts.success(m.settings_history_saved());
			forecast = await getStorageForecast();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : m.settings_history_failed());
		} finally {
			retentionSaving = false;
		}
	}

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
			toasts.error(error instanceof Error ? error.message : m.status_sync_failed());
		}
	}
</script>

<svelte:head>
	<title>{m.nav_storageMaintenance()}</title>
</svelte:head>

<SettingsPage title={m.nav_storageMaintenance()} subtitle={m.status_dashboard_subtitle()}>
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
<details class="mt-4" bind:open={retentionOpen}>
	<summary class="cursor-pointer text-sm font-medium text-base-content/60 hover:text-base-content"
		>History Retention</summary
	>
	<div class="mt-3 rounded-lg border bg-base-200 p-4">
		{#if retention}
			<div class="flex flex-wrap items-end gap-4">
				<div class="form-control">
					<label class="label py-0 text-xs" for="h-file">File history</label>
					<input
						id="h-file"
						type="number"
						class="input input-bordered input-xs w-20"
						bind:value={retention.fileHistoryDays}
						min="0"
						max="3650"
					/> <span class="text-xs text-base-content/50">days</span>
				</div>
				<div class="form-control">
					<label class="label py-0 text-xs" for="h-lib">Library history</label>
					<input
						id="h-lib"
						type="number"
						class="input input-bordered input-xs w-20"
						bind:value={retention.libraryHistoryDays}
						min="0"
						max="3650"
					/> <span class="text-xs text-base-content/50">days</span>
				</div>
				<div class="form-control">
					<label class="label py-0 text-xs" for="h-scan">Scan history</label>
					<input
						id="h-scan"
						type="number"
						class="input input-bordered input-xs w-20"
						bind:value={retention.scanHistoryDays}
						min="0"
						max="3650"
					/> <span class="text-xs text-base-content/50">days</span>
				</div>
				<button
					class="btn btn-ghost btn-xs"
					onclick={handleSaveRetention}
					disabled={retentionSaving}>Save</button
				>
			</div>
			{#if forecast}
				<div class="mt-2 text-xs text-base-content/50">
					~{formatBytes(forecast.currentEstimatedBytes)} now, ~{formatBytes(
						forecast.projectedBytes30d
					)} in 30d
				</div>
			{/if}
		{/if}
	</div>
</details>
