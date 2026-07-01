<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { ShieldCheck, AlertTriangle } from 'lucide-svelte';
	import { SettingsSection } from '$lib/components/ui/settings';
	import InsightCard from './InsightCard.svelte';

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
		insights: Insight[];
	}

	let { insights }: Props = $props();

	// Track locally-dismissed insight IDs for optimistic UI.
	// SvelteSet (not a plain Set in $state) so .add()/.has() are reactive.
	let dismissedIds = new SvelteSet<string>();

	const visibleInsights = $derived(insights.filter((i) => !dismissedIds.has(i.id)));

	const criticalCount = $derived(visibleInsights.filter((i) => i.severity === 'critical').length);
</script>

<SettingsSection title="Insights" variant="card">
	{#if visibleInsights.length === 0}
		<div class="flex items-center gap-3 py-4 text-base-content/60">
			<ShieldCheck class="h-5 w-5 text-success" />
			<span>Everything looks healthy. No issues detected.</span>
		</div>
	{:else}
		{#if criticalCount > 0}
			<div class="mb-3 flex items-center gap-2 text-sm text-error">
				<AlertTriangle class="h-4 w-4" />
				<span>{criticalCount} critical issue{criticalCount === 1 ? '' : 's'} need attention</span>
			</div>
		{/if}
		<div class="space-y-2">
			{#each visibleInsights as insight (insight.id)}
				<InsightCard {insight} onDismissed={() => dismissedIds.add(insight.id)} />
			{/each}
		</div>
	{/if}
</SettingsSection>
