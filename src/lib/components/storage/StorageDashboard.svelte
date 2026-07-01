<script lang="ts">
	import {
		HardDrive,
		ShieldCheck,
		AlertTriangle,
		Library,
		BarChart3,
		RefreshCw,
		ExternalLink,
		CheckCircle
	} from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
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
	import InsightCard from './InsightCard.svelte';

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

	const topInsights = $derived(insights.slice(0, 3));
	// SvelteSet (not a plain Set in $state) so .add()/.has() are reactive.
	let dismissedIds = new SvelteSet<string>();
	const visibleTopInsights = $derived(topInsights.filter((i) => !dismissedIds.has(i.id)));

	const baseUrl = '/settings/monitoring/status';
</script>

<!-- Scan alerts (transient — only show during/after scans) -->
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
			? `${capacityPercent}% of ${formatBytes(totalCapacity)} \u00B7 ${folderCount} folder${
					folderCount === 1 ? '' : 's'
				}`
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
		miniSegments={mediaServerStats.resolutionBreakdown.length > 0
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

<!-- TOP 3 INSIGHTS SUMMARY -->
{#if visibleTopInsights.length > 0}
	<div class="mt-4 space-y-2">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-base-content/70">Priority Insights</h3>
			<a href={`${baseUrl}/insights`} class="relative z-10 btn btn-ghost btn-xs gap-1">
				View all
				<ExternalLink class="h-3 w-3" />
			</a>
		</div>
		{#each visibleTopInsights as insight (insight.id)}
			<InsightCard {insight} onDismissed={() => dismissedIds.add(insight.id)} />
		{/each}
	</div>
{/if}

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
