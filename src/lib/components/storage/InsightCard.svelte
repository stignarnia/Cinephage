<script lang="ts">
	import { X, ExternalLink } from 'lucide-svelte';
	import { severityBadgeClass, insightTypeLabel, dismissInsight, formatBytes } from './utils.js';

	interface Insight {
		id: string;
		insightType: string;
		severity: 'info' | 'warning' | 'critical';
		title: string;
		summary: string | null;
		reclaimableBytes: number | null;
		detailsJson: string | null;
	}

	interface Props {
		insight: Insight;
		onDismissed?: () => void;
	}

	let { insight, onDismissed }: Props = $props();

	let dismissing = $state(false);

	const details = $derived(
		insight.detailsJson ? (JSON.parse(insight.detailsJson) as { link?: string }) : null
	);

	async function handleDismiss() {
		dismissing = true;
		const success = await dismissInsight(insight.id);
		dismissing = false;
		if (success && onDismissed) {
			onDismissed();
		}
	}
</script>

<div class={`rounded-lg border p-4 ${severityBadgeClass(insight.severity)}`}>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="badge badge-sm border-none {severityBadgeClass(insight.severity)}">
					{insightTypeLabel(insight.insightType)}
				</span>
				{#if insight.reclaimableBytes}
					<span class="text-xs text-base-content/50">
						{formatBytes(insight.reclaimableBytes)} reclaimable
					</span>
				{/if}
			</div>
			<h4 class="mt-1 font-semibold text-base-content">{insight.title}</h4>
			{#if insight.summary}
				<p class="mt-1 text-sm text-base-content/70">{insight.summary}</p>
			{/if}
			{#if details?.link}
				<a href={details.link} class="mt-2 inline-flex items-center gap-1 text-sm link link-hover">
					View details
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
		</div>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			onclick={handleDismiss}
			disabled={dismissing}
			title="Dismiss"
		>
			<X class="h-4 w-4" />
		</button>
	</div>
</div>
