<script lang="ts">
	/**
	 * Segmented proportional breakdown bar with legend.
	 *
	 * Renders a single horizontal bar split into proportionally-sized segments
	 * (each segment's width = value / sum-of-values), plus a legend showing each
	 * item's label, percentage, and value. Segment colours rotate through a fixed
	 * DaisyUI palette so multi-item distributions remain distinguishable.
	 *
	 * Use this for distribution data (resolution/codec/HDR splits, etc.) where the
	 * relative proportions matter more than ranking individual rows.
	 *
	 * @example
	 * <BreakdownBar items={[{ label: '1080p', value: 42 }, { label: '4K', value: 8 }]} />
	 * <BreakdownBar items={data} emptyMessage="No resolution data" />
	 */

	interface BreakdownItem {
		label: string;
		value: number;
	}

	interface Props {
		items: BreakdownItem[];
		/** Message shown when there is no data to render. */
		emptyMessage?: string;
	}

	let { items, emptyMessage = 'No data' }: Props = $props();

	// Complete class strings (not composed) so Tailwind's scanner includes each colour.
	const SEGMENT_COLORS = [
		'bg-primary',
		'bg-secondary',
		'bg-accent',
		'bg-info',
		'bg-success',
		'bg-warning'
	] as const;

	const total = $derived(items.reduce((sum, item) => sum + item.value, 0));
	const segments = $derived(total > 0 ? items.filter((item) => item.value > 0) : []);

	function pct(value: number): number {
		return total > 0 ? (value / total) * 100 : 0;
	}

	function pctLabel(value: number): string {
		const p = pct(value);
		if (p < 1) return '<1%';
		return `${Math.round(p)}%`;
	}

	function colorFor(index: number): string {
		return SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? 'bg-primary';
	}
</script>

{#if segments.length === 0}
	<p class="text-sm text-base-content/50">{emptyMessage}</p>
{:else}
	<div>
		<div
			class="flex h-3 w-full overflow-hidden rounded-full bg-base-300"
			role="img"
			aria-label="Breakdown"
		>
			{#each segments as segment, i (segment.label)}
				<div
					class="h-full {colorFor(i)} transition-all"
					style="width: {pct(segment.value)}%"
					title="{segment.label}: {pctLabel(segment.value)}"
				></div>
			{/each}
		</div>
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
			{#each segments as segment, i (segment.label)}
				<div class="flex items-center gap-1.5 text-xs">
					<span class="h-2.5 w-2.5 shrink-0 rounded-full {colorFor(i)}"></span>
					<span class="font-medium text-base-content/70">{segment.label}</span>
					<span class="text-base-content/50">{pctLabel(segment.value)} ({segment.value})</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
