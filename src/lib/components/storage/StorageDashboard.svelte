<script lang="ts">
	import type {
		StorageSummary,
		ScanProgress,
		ScanSuccess,
		ServerStatus
	} from '$lib/components/libraries/storage-utils.js';
	import type {
		LibraryBreakdownItem,
		RootFolderBreakdownItem
	} from '$lib/components/libraries/storage-utils.js';
	import StorageHero from './StorageHero.svelte';
	import InsightsPanel from './InsightsPanel.svelte';
	import LibraryOverview from './LibraryOverview.svelte';
	import RootFolderOverview from './RootFolderOverview.svelte';
	import MediaBreakdown from './MediaBreakdown.svelte';
	import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-svelte';
	import {
		formatTimestamp,
		getScanTone,
		getServerTypeBadgeClass,
		getSyncStatusColor
	} from '$lib/components/libraries/storage-utils.js';

	type BreakdownItem = { label: string; count: number };

	type Insight = {
		id: string;
		insightType: string;
		severity: 'info' | 'warning' | 'critical';
		title: string;
		summary: string | null;
		reclaimableBytes: number | null;
		detailsJson: string | null;
	};

	interface Props {
		storage: StorageSummary;
		libraryBreakdown: LibraryBreakdownItem[];
		rootFolderBreakdown: RootFolderBreakdownItem[];
		insights: Insight[];
		mediaServerStats: {
			resolutionBreakdown: BreakdownItem[];
			codecBreakdown: BreakdownItem[];
			hdrBreakdown: BreakdownItem[];
			audioCodecBreakdown: BreakdownItem[];
			containerBreakdown: BreakdownItem[];
		};
		scanning: boolean;
		scanProgress: ScanProgress | null;
		scanError: string | null;
		scanSuccess: ScanSuccess | null;
		serverStatuses: ServerStatus[];
		onEditLibrary: (libraryId: string) => void;
		onEditRootFolder: (folderId: string) => void;
		onScanRootFolder: (folderId: string) => void;
	}

	let {
		storage,
		libraryBreakdown,
		rootFolderBreakdown,
		insights,
		mediaServerStats,
		scanning,
		scanProgress,
		scanError,
		scanSuccess,
		serverStatuses,
		onEditLibrary,
		onEditRootFolder,
		onScanRootFolder
	}: Props = $props();
</script>

<!-- Hero: capacity + stacked bar -->
<StorageHero {storage} />

<!-- Insights panel (the star feature) -->
<div class="mt-4">
	<InsightsPanel {insights} />
</div>

<!-- Scan status / errors / progress -->
{#if scanError}
	<div class="mt-4 alert alert-error">
		<AlertCircle class="h-5 w-5" />
		<span>{scanError}</span>
	</div>
{/if}

{#if scanSuccess}
	<div class="mt-4 alert alert-success">
		<CheckCircle class="h-5 w-5" />
		<div class="flex flex-1 items-center justify-between gap-2">
			<span>{scanSuccess.message}</span>
			{#if scanSuccess.unmatchedCount > 0}
				<a href="/library/unmatched" class="btn btn-ghost btn-xs gap-1">
					{scanSuccess.unmatchedCount} unmatched
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
		</div>
	</div>
{/if}

{#if scanning && scanProgress}
	<div class="card mt-4 bg-base-200 p-4">
		<div class="mb-2 flex items-center justify-between text-sm">
			<span class="truncate">{scanProgress.rootFolderPath ?? 'Scanning...'}</span>
			<span class="text-base-content/60">
				{scanProgress.filesProcessed} / {scanProgress.filesFound}
			</span>
		</div>
		<progress
			class="progress progress-primary w-full"
			value={scanProgress.filesProcessed}
			max={scanProgress.filesFound || 1}
		></progress>
	</div>
{/if}

<!-- Last scan + server status summary -->
<div
	class="mt-4 flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
>
	<div class="flex items-center gap-3 text-sm">
		<span
			class="inline-block h-2 w-2 rounded-full {getScanTone(storage.health.lastScan?.status)}"
		></span>
		{#if storage.health.lastScan}
			<span class="text-base-content/70">
				Last scan:
				<strong class="text-base-content">
					{formatTimestamp(storage.health.lastScan.completedAt ?? storage.health.lastScan.startedAt)}
				</strong>
			</span>
		{:else}
			<span class="text-base-content/50">No scan history</span>
		{/if}
	</div>
	{#if serverStatuses.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each serverStatuses as server (server.serverId)}
				<span class="inline-flex items-center gap-1.5 text-xs text-base-content/70">
					<span class="badge badge-xs {getServerTypeBadgeClass(server.serverType)}"></span>
					<span>{server.serverName}</span>
					<span
						class="badge badge-xs {getSyncStatusColor(server.lastSyncStatus, server.lastSyncAt)}"
					>
						{server.lastSyncStatus ?? 'pending'}
					</span>
				</span>
			{/each}
		</div>
	{/if}
</div>

<!-- Libraries + Root Folders (side by side on desktop, stacked on mobile) -->
<div class="mt-4 grid gap-4 lg:grid-cols-2">
	<LibraryOverview libraries={libraryBreakdown} {onEditLibrary} />
	<RootFolderOverview rootFolders={rootFolderBreakdown} {onEditRootFolder} {onScanRootFolder} />
</div>

<!-- Media breakdown charts -->
<MediaBreakdown
	resolutionBreakdown={mediaServerStats.resolutionBreakdown}
	codecBreakdown={mediaServerStats.codecBreakdown}
	hdrBreakdown={mediaServerStats.hdrBreakdown}
	audioCodecBreakdown={mediaServerStats.audioCodecBreakdown}
	containerBreakdown={mediaServerStats.containerBreakdown}
/>

<!-- Browse all media link -->
<div class="mt-4 flex justify-end">
	<a href="/settings/monitoring/status/media" class="btn btn-ghost btn-sm gap-2">
		Browse all media
		<ExternalLink class="h-3.5 w-3.5" />
	</a>
</div>
