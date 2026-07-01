<script lang="ts">
	/**
	 * Reusable horizontal segmented bar for proportional breakdowns.
	 * Each segment is labeled, sized by value, and color-coded.
	 * Phase 4 will add optional onSegmentClick for drill-down.
	 */

	type Segment = {
		label: string;
		value: number;
		colorClass?: string; // tailwind bg-* class; defaults rotate through semantic colors
	};

	interface Props {
		segments: Segment[];
		totalLabel?: string; // optional caption like "67 items"
		showLegend?: boolean; // default true
		variant?: 'thin' | 'default'; // thin = h-2, default = h-3
	}

	let { segments, totalLabel, showLegend = true, variant = 'default' }: Props = $props();

	const DEFAULT_COLORS = [
		'bg-primary',
		'bg-secondary',
		'bg-accent',
		'bg-info',
		'bg-warning',
		'bg-error',
		'bg-success'
	];

	const total = $derived(segments.reduce((sum, s) => sum + s.value, 0));

	const normalizedSegments = $derived(
		segments
			.filter((s) => s.value > 0)
			.map((s, i) => ({
				label: s.label,
				value: s.value,
				colorClass: s.colorClass ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
				widthPercent: total > 0 ? (s.value / total) * 100 : 0
			}))
	);

	const barHeightClass = $derived(variant === 'thin' ? 'h-2' : 'h-3');
</script>

{#if normalizedSegments.length === 0}
	<div class="text-xs text-base-content/40">No data</div>
{:else}
	<div class="flex flex-col gap-2">
		<div class="flex {barHeightClass} w-full overflow-hidden rounded-full bg-base-300/60">
			{#each normalizedSegments as segment (segment.label)}
				<div
					class="{segment.colorClass} h-full transition-all"
					style="width: {segment.widthPercent}%"
					title="{segment.label}: {segment.value}"
					role="img"
					aria-label="{segment.label}: {segment.value} of {total}"
				></div>
			{/each}
		</div>
		{#if showLegend}
			<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/70">
				{#each normalizedSegments as segment (segment.label)}
					<span class="inline-flex items-center gap-1.5">
						<span class="inline-block h-2.5 w-2.5 rounded-full {segment.colorClass}"></span>
						{segment.label}
						<span class="text-base-content/50">({segment.value})</span>
					</span>
				{/each}
				{#if totalLabel}
					<span class="ml-auto text-base-content/50">{totalLabel}</span>
				{/if}
			</div>
		{/if}
	</div>
{/if}
