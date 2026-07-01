<script lang="ts">
	import { BreakdownBar } from '$lib/components/ui';
	import { SettingsSection } from '$lib/components/ui/settings';

	type BreakdownItem = { label: string; count: number };

	interface Props {
		resolutionBreakdown: BreakdownItem[];
		codecBreakdown: BreakdownItem[];
		hdrBreakdown: BreakdownItem[];
		audioCodecBreakdown: BreakdownItem[];
		containerBreakdown: BreakdownItem[];
	}

	let {
		resolutionBreakdown,
		codecBreakdown,
		hdrBreakdown,
		audioCodecBreakdown,
		containerBreakdown
	}: Props = $props();

	function totalLabel(items: BreakdownItem[]): string {
		const total = items.reduce((sum, i) => sum + i.count, 0);
		return `${total} item${total === 1 ? '' : 's'}`;
	}
</script>

{#if resolutionBreakdown.length > 0 || codecBreakdown.length > 0}
	<div class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		<SettingsSection title="Resolution" variant="card">
			<BreakdownBar
				segments={resolutionBreakdown.map((i) => ({ label: i.label, value: i.count }))}
				totalLabel={totalLabel(resolutionBreakdown)}
			/>
		</SettingsSection>
		<SettingsSection title="Video Codec" variant="card">
			<BreakdownBar
				segments={codecBreakdown.map((i) => ({ label: i.label, value: i.count }))}
				totalLabel={totalLabel(codecBreakdown)}
			/>
		</SettingsSection>
		<SettingsSection title="HDR / SDR" variant="card">
			<BreakdownBar
				segments={hdrBreakdown.map((i) => ({ label: i.label, value: i.count }))}
				totalLabel={totalLabel(hdrBreakdown)}
			/>
		</SettingsSection>
		<SettingsSection title="Audio Codec" variant="card">
			<BreakdownBar
				segments={audioCodecBreakdown.map((i) => ({ label: i.label, value: i.count }))}
				totalLabel={totalLabel(audioCodecBreakdown)}
			/>
		</SettingsSection>
		<SettingsSection title="Container" variant="card">
			<BreakdownBar
				segments={containerBreakdown.map((i) => ({ label: i.label, value: i.count }))}
				totalLabel={totalLabel(containerBreakdown)}
			/>
		</SettingsSection>
	</div>
{/if}
