<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { HardDrive, RefreshCw } from 'lucide-svelte';
	import { SettingsPage } from '$lib/components/ui/settings';
	import { StorageDashboard } from '$lib/components/storage';
	import { createSSE } from '$lib/sse';
	import { layoutState, deriveMobileSseStatus } from '$lib/layout.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toast.svelte';
	import { scanLibrary } from '$lib/api/library.js';
	import { syncMediaServerStats } from '$lib/api/settings.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type ScanProgress = {
		phase: string;
		rootFolderId?: string;
		rootFolderPath?: string;
		filesFound: number;
		filesProcessed: number;
		filesAdded: number;
		filesUpdated: number;
		filesRemoved: number;
		unmatchedCount: number;
		currentFile?: string;
	};

	type ScanSuccess = { message: string; unmatchedCount: number };

	let scanning = $state(false);
	let scanProgress = $state<ScanProgress | null>(null);
	let scanError = $state<string | null>(null);
	let scanSuccess = $state<ScanSuccess | null>(null);
	let syncing = $state(false);

	const sse = createSSE<{
		status: { inProgress?: boolean; isScanning?: boolean };
		progress: ScanProgress;
		scanComplete: { results?: Array<{ unmatchedFiles?: number }> };
		scanError: { error?: { message?: string } };
	}>('/api/library/scan/status', {
		status: (payload) => {
			scanning = Boolean(payload.inProgress ?? payload.isScanning ?? false);
			if (!scanning) scanProgress = null;
		},
		progress: (payload) => {
			scanning = true;
			scanProgress = payload;
		},
		scanComplete: (payload) => {
			const totalUnmatched =
				payload.results?.reduce((sum, item) => sum + (item.unmatchedFiles ?? 0), 0) ?? 0;
			scanSuccess = {
				message: `Scan complete: ${payload.results?.length ?? 0} folders scanned`,
				unmatchedCount: totalUnmatched
			};
			scanning = false;
			scanProgress = null;
			void invalidateAll();
		},
		scanError: (payload) => {
			scanError = payload.error?.message ?? 'Scan failed';
			scanning = false;
			scanProgress = null;
		}
	});

	$effect(() => {
		layoutState.setMobileSseStatus(deriveMobileSseStatus(sse));
		return () => layoutState.clearMobileSseStatus();
	});

	function resetScanState() {
		scanError = null;
		scanSuccess = null;
		scanProgress = null;
	}

	async function triggerLibraryScan(rootFolderId?: string) {
		scanning = true;
		resetScanState();
		try {
			await scanLibrary(rootFolderId ? { rootFolderId } : { fullScan: true });
		} catch (error) {
			scanError = error instanceof Error ? error.message : m.settings_general_failedToStartScan();
			scanning = false;
		}
	}

	async function triggerServerSync() {
		syncing = true;
		try {
			await syncMediaServerStats();
			await invalidateAll();
		} catch (error) {
			toasts.error(error instanceof Error ? error.message : 'Sync failed');
		} finally {
			syncing = false;
		}
	}

	$effect(() => {
		void sse.status;
	});
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
				disabled={scanning || data.rootFolders.length === 0}
			>
				{#if scanning}
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
					disabled={syncing}
				>
					<RefreshCw class="h-4 w-4 {syncing ? 'animate-spin' : ''}" />
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
		{scanning}
		{scanProgress}
		{scanError}
		{scanSuccess}
		serverStatuses={data.serverStatuses}
	/>
</SettingsPage>
