<script lang="ts">
	import {
		HardDrive,
		ShieldCheck,
		AlertTriangle,
		Library,
		BarChart3,
		RefreshCw,
		CheckCircle,
		ChevronRight
	} from 'lucide-svelte';
	import type { StorageSummary, ScanProgress, ScanSuccess, ServerStatus } from './utils.js';
	import type { LibraryBreakdownItem, RootFolderBreakdownItem } from './utils.js';
	import {
		formatBytes,
		formatTimestamp,
		getScanTone,
		getServerTypeBadgeClass,
		getSyncStatusColor
	} from './utils.js';
	import StorageTile from './StorageTile.svelte';
	import { BreakdownBar } from '$lib/components/ui';

	type BreakdownItem = { label: string; count: number };

	type Insight = {
		id: string;
		insightType: string;
		severity: 'info' | 'warning' | 'critical';
		title: string;
		summary: string | null;
		reclaimableBytes: number | null;
		detailsJson: string | null;
		itemCount: number;
	};

	interface Props {
		storage: StorageSummary;
		libraryBreakdown: LibraryBreakdownItem[];
		rootFolderBreakdown: RootFolderBreakdownItem[];
		insights: Insight[];
		mediaServerStats: {
			uniqueItems: number;
			resolutionBreakdown: BreakdownItem[];
			codecBreakdown: BreakdownItem[];
		};
		scanning: boolean;
		scanProgress: ScanProgress | null;
		scanError: string | null;
		scanSuccess: ScanSuccess | null;
		serverStatuses: ServerStatus[];
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
		serverStatuses
	}: Props = $props();

	// --- Tile computations ---
	const totalCapacity = $derived(
		rootFolderBreakdown.reduce((sum, f) => sum + (f.totalSpaceBytes ?? 0), 0)
	);
	const capacityPercent = $derived(
		totalCapacity > 0 ? Math.round((storage.totalUsedBytes / totalCapacity) * 100) : 0
	);
	const folderCount = $derived(rootFolderBreakdown.length);

	const criticalCount = $derived(insights.filter((i) => i.severity === 'critical').length);
	const warningCount = $derived(insights.filter((i) => i.severity === 'warning').length);
	const infoCount = $derived(insights.filter((i) => i.severity === 'info').length);

	const healthStatus = $derived(
		criticalCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success'
	);
	const healthLabel = $derived(
		criticalCount > 0
			? `${criticalCount} critical`
			: warningCount > 0
				? `${warningCount} warning`
				: 'Healthy'
	);

	const libraryCount = $derived(libraryBreakdown.length);
	const totalItems = $derived(libraryBreakdown.reduce((sum, l) => sum + l.itemCount, 0));

	const belowCutoffCount = $derived(
		insights.find((i) => i.insightType === 'quality-below-cutoff')?.itemCount ?? 0
	);

	// --- Chart segment data ---
	const libraryStorageSegments = $derived(
		libraryBreakdown
			.filter((l) => l.usedBytes > 0)
			.map((l) => ({ label: l.name, value: l.usedBytes }))
	);

	const resolutionSegments = $derived(
		mediaServerStats.resolutionBreakdown.map((r) => ({ label: r.label, value: r.count }))
	);

	const codecSegments = $derived(
		mediaServerStats.codecBreakdown?.map((c) => ({ label: c.label, value: c.count })) ?? []
	);

	// --- Priority insights for sidebar (top 5 by severity order, already sorted from server) ---
	const topInsights = $derived(insights.slice(0, 5));

	function severityDot(sev: string): string {
		return sev === 'critical' ? 'bg-error' : sev === 'warning' ? 'bg-warning' : 'bg-info';
	}

	const baseUrl = '/settings/monitoring/status';
</script>

<!-- Scan alerts (transient) -->
{#if scanError}
	<div class="mb-4 alert alert-error">
		<AlertTriangle class="h-5 w-5" />
		<span>{scanError}</span>
	</div>
{/if}

{#if scanSuccess}
	<div class="mb-4 alert alert-success">
		<CheckCircle class="h-5 w-5" />
		<span>{scanSuccess.message}</span>
	</div>
{/if}

{#if scanning && scanProgress}
	<div class="card mb-4 bg-base-200 p-4">
		<div class="mb-2 flex items-center justify-between text-sm">
			<span class="truncate">{scanProgress.rootFolderPath ?? 'Scanning...'}</span>
			<span class="text-base-content/60"
				>{scanProgress.filesProcessed} / {scanProgress.filesFound}</span
			>
		</div>
		<progress
			class="progress progress-primary w-full"
			value={scanProgress.filesProcessed}
			max={scanProgress.filesFound || 1}
		></progress>
	</div>
{/if}

<!-- KPI TILE GRID -->
<div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:gap-4">
	<StorageTile
		icon={HardDrive}
		iconClass="bg-primary/10 text-primary"
		label="Capacity"
		value={formatBytes(storage.totalUsedBytes)}
		context={totalCapacity > 0
			? `${capacityPercent}% of ${formatBytes(totalCapacity)} \u00B7 ${folderCount} folder${folderCount === 1 ? '' : 's'}`
			: `${folderCount} folder${folderCount === 1 ? '' : 's'}`}
		href={`${baseUrl}/folders`}
		miniSegments={rootFolderBreakdown.length > 0
			? [
					{ value: storage.totalUsedBytes, colorClass: 'bg-primary' },
					{
						value: Math.max(0, totalCapacity - storage.totalUsedBytes),
						colorClass: 'bg-base-content/10'
					}
				]
			: undefined}
	/>

	<StorageTile
		icon={ShieldCheck}
		iconClass={healthStatus === 'success'
			? 'bg-success/10 text-success'
			: healthStatus === 'warning'
				? 'bg-warning/10 text-warning'
				: 'bg-error/10 text-error'}
		label="Health"
		value={healthLabel}
		context={insights.length > 0
			? `${insights.length} insight${insights.length === 1 ? '' : 's'}`
			: 'No issues'}
		href={`${baseUrl}/insights`}
		statusDot={healthStatus}
	/>

	<StorageTile
		icon={AlertTriangle}
		iconClass="bg-warning/10 text-warning"
		label="Insights"
		value={String(insights.length)}
		context={criticalCount > 0 || warningCount > 0
			? `${criticalCount} critical \u00B7 ${warningCount} warning \u00B7 ${infoCount} info`
			: 'All clear'}
		href={`${baseUrl}/insights`}
	/>

	<StorageTile
		icon={Library}
		iconClass="bg-secondary/10 text-secondary"
		label="Libraries"
		value={String(libraryCount)}
		context={`${totalItems} item${totalItems === 1 ? '' : 's'} tracked`}
		href={`${baseUrl}/libraries`}
	/>

	<StorageTile
		icon={BarChart3}
		iconClass="bg-accent/10 text-accent"
		label="Media Quality"
		value={mediaServerStats.uniqueItems > 0 ? `${mediaServerStats.uniqueItems} items` : 'No data'}
		context={belowCutoffCount > 0 ? `${belowCutoffCount} below cutoff` : 'Cutoffs met'}
		href={`${baseUrl}/media`}
		miniSegments={resolutionSegments.length > 0
			? [
					{
						value: mediaServerStats.resolutionBreakdown.find((r) => r.label === '4K')?.count ?? 0,
						colorClass: 'bg-accent'
					},
					{
						value:
							mediaServerStats.resolutionBreakdown.find((r) => r.label === '1080p')?.count ?? 0,
						colorClass: 'bg-accent/70'
					},
					{
						value: mediaServerStats.resolutionBreakdown.find((r) => r.label === '720p')?.count ?? 0,
						colorClass: 'bg-accent/40'
					},
					{
						value:
							mediaServerStats.resolutionBreakdown.find(
								(r) => r.label === '480p' || r.label === 'SD'
							)?.count ?? 0,
						colorClass: 'bg-accent/20'
					}
				].filter((s) => s.value > 0)
			: undefined}
	/>

	<StorageTile
		icon={RefreshCw}
		iconClass="bg-info/10 text-info"
		label="Sync Status"
		value={storage.health.lastScan
			? formatTimestamp(storage.health.lastScan.completedAt ?? storage.health.lastScan.startedAt)
			: 'Never'}
		context={serverStatuses.length > 0
			? `${serverStatuses.length} server${serverStatuses.length === 1 ? '' : 's'} \u00B7 ${serverStatuses.filter((s) => s.lastSyncStatus === 'completed').length} synced`
			: 'No servers'}
	/>
</div>

<!-- DASHBOARD BODY: charts + insights sidebar -->
<div class="mt-4 grid gap-4 lg:grid-cols-3">
	<!-- LEFT (2/3): Charts -->
	<div class="space-y-4 lg:col-span-2">
		<!-- Storage by Library -->
		{#if libraryStorageSegments.length > 0}
			<div class="card bg-base-200 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-sm font-semibold text-base-content/70">Storage by Library</h3>
					<span class="text-xs text-base-content/50"
						>{formatBytes(storage.totalUsedBytes)} total</span
					>
				</div>
				<BreakdownBar
					segments={libraryStorageSegments}
					variant="thin"
					totalLabel={`${libraryCount} libraries`}
				/>
			</div>
		{/if}

		<!-- Resolution + Codec side by side -->
		{#if resolutionSegments.length > 0 || codecSegments.length > 0}
			<div class="grid gap-4 sm:grid-cols-2">
				{#if resolutionSegments.length > 0}
					<div class="card bg-base-200 p-4">
						<h3 class="mb-3 text-sm font-semibold text-base-content/70">Resolution</h3>
						<BreakdownBar segments={resolutionSegments} variant="thin" showLegend={false} />
						<!-- Mini legend below -->
						<div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-base-content/60">
							{#each mediaServerStats.resolutionBreakdown.slice(0, 5) as item (item.label)}
								<span>{item.label}: {item.count}</span>
							{/each}
						</div>
					</div>
				{/if}
				{#if codecSegments.length > 0}
					<div class="card bg-base-200 p-4">
						<h3 class="mb-3 text-sm font-semibold text-base-content/70">Video Codec</h3>
						<BreakdownBar segments={codecSegments} variant="thin" showLegend={false} />
						<div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-base-content/60">
							{#each mediaServerStats.codecBreakdown.slice(0, 5) as item (item.label)}
								<span>{item.label}: {item.count}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Browse media link -->
		<div class="flex justify-end">
			<a href={`${baseUrl}/media`} class="btn btn-ghost btn-sm gap-1">
				Browse all media
				<ChevronRight class="h-3.5 w-3.5" />
			</a>
		</div>
	</div>

	<!-- RIGHT (1/3): Priority Insights sidebar -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-base-content/70">Priority Insights</h3>
			{#if insights.length > 0}
				<a href={`${baseUrl}/insights`} class="btn btn-ghost btn-xs gap-1">
					View all
					<ChevronRight class="h-3 w-3" />
				</a>
			{/if}
		</div>
		{#if topInsights.length === 0}
			<div
				class="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-sm text-base-content/60"
			>
				<CheckCircle class="h-4 w-4 shrink-0 text-success" />
				<span>Everything looks healthy</span>
			</div>
		{:else}
			{#each topInsights as insight (insight.id)}
				<a
					href={`${baseUrl}/insights`}
					class="flex items-center gap-2.5 rounded-lg border border-base-300 bg-base-200/50 p-2.5 transition-colors hover:bg-base-300/50"
				>
					<span
						class={`inline-block h-2 w-2 shrink-0 rounded-full ${severityDot(insight.severity)}`}
					></span>
					<span class="min-w-0 flex-1 truncate text-sm text-base-content">{insight.title}</span>
					{#if insight.itemCount > 1}
						<span class="shrink-0 text-xs font-medium text-base-content/50"
							>{insight.itemCount}</span
						>
					{/if}
					<ChevronRight class="h-3.5 w-3.5 shrink-0 text-base-content/30" />
				</a>
			{/each}
		{/if}
	</div>
</div>

<!-- STATUS FOOTER BAR -->
<div
	class="mt-4 flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
>
	<div class="flex items-center gap-3 text-sm">
		<span class="inline-block h-2 w-2 rounded-full {getScanTone(storage.health.lastScan?.status)}"
		></span>
		{#if storage.health.lastScan}
			<span class="text-base-content/70">
				Last scan:
				<strong class="text-base-content">
					{formatTimestamp(
						storage.health.lastScan.completedAt ?? storage.health.lastScan.startedAt
					)}
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
