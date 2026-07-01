<script lang="ts">
	import { SettingsPage, SettingsSection } from '$lib/components/ui/settings';
	import { ArrowLeft } from 'lucide-svelte';
	import InsightsPanel from '$lib/components/storage/InsightsPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const activeInsights = $derived(data.allInsights.filter((i) => !i.dismissedAt));
	const dismissedInsights = $derived(data.allInsights.filter((i) => i.dismissedAt));
</script>

<svelte:head>
	<title>Storage Insights</title>
</svelte:head>

<SettingsPage
	title="Storage Insights"
	subtitle="Issues detected across your library and media servers"
>
	{#snippet actions()}
		<a href="/settings/monitoring/status" class="btn btn-ghost btn-sm gap-2">
			<ArrowLeft class="h-4 w-4" />
			Dashboard
		</a>
	{/snippet}

	<InsightsPanel insights={activeInsights} />

	{#if dismissedInsights.length > 0}
		<SettingsSection title="Dismissed" variant="card" class="mt-4">
			<div class="space-y-2">
				{#each dismissedInsights as insight (insight.id)}
					<div class="rounded-lg border border-base-300 bg-base-200/50 p-3 opacity-60">
						<div class="flex items-center justify-between gap-2">
							<span class="text-sm text-base-content/70">{insight.title}</span>
							<span class="text-xs text-base-content/40">Dismissed</span>
						</div>
					</div>
				{/each}
			</div>
		</SettingsSection>
	{/if}
</SettingsPage>
