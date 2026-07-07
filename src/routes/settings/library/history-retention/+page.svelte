<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { SettingsPage, SettingsSection } from '$lib/components/ui/settings';
	import { toasts } from '$lib/stores/toast.svelte';
	import { formatBytes } from '$lib/utils/format.js';
	import {
		getHistoryRetention,
		saveHistoryRetention,
		getStorageForecast,
		type HistoryRetentionSettings,
		type StorageForecast
	} from '$lib/api/history-retention.js';

	let retention = $state<HistoryRetentionSettings | null>(null);
	let forecast = $state<StorageForecast | null>(null);
	let saving = $state(false);

	onMount(() => {
		void load();
	});

	async function load() {
		try {
			[retention, forecast] = await Promise.all([getHistoryRetention(), getStorageForecast()]);
		} catch {
			retention = null;
		}
	}

	async function handleSave() {
		if (!retention) return;
		saving = true;
		try {
			await saveHistoryRetention(retention);
			toasts.success(m.settings_history_saved());
			forecast = await getStorageForecast();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : m.settings_history_failed());
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{m.settings_history_title()}</title>
</svelte:head>

<SettingsPage title={m.settings_history_title()} subtitle={m.settings_history_description()}>
	{#if retention}
		<SettingsSection title={m.settings_history_title()}>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="form-control">
					<label class="label py-1" for="file-days">
						<span class="label-text">{m.settings_history_file_days()}</span>
					</label>
					<input
						id="file-days"
						type="number"
						class="input input-bordered input-sm w-28"
						bind:value={retention.fileHistoryDays}
						min="0"
						max="3650"
					/>
					<span class="text-xs text-base-content/60">{m.settings_history_file_days_help()}</span>
				</div>
				<div class="form-control">
					<label class="label py-1" for="library-days">
						<span class="label-text">{m.settings_history_library_days()}</span>
					</label>
					<input
						id="library-days"
						type="number"
						class="input input-bordered input-sm w-28"
						bind:value={retention.libraryHistoryDays}
						min="0"
						max="3650"
					/>
					<span class="text-xs text-base-content/60">{m.settings_history_library_days_help()}</span>
				</div>
				<div class="form-control">
					<label class="label py-1" for="scan-days">
						<span class="label-text">{m.settings_history_scan_days()}</span>
					</label>
					<input
						id="scan-days"
						type="number"
						class="input input-bordered input-sm w-28"
						bind:value={retention.scanHistoryDays}
						min="0"
						max="3650"
					/>
					<span class="text-xs text-base-content/60">{m.settings_history_scan_days_help()}</span>
				</div>
			</div>
			<div class="modal-action mt-4 border-t border-base-300 pt-4">
				<button class="btn btn-primary btn-sm" onclick={handleSave} disabled={saving}>
					{m.settings_general_saveLibrary()}
				</button>
			</div>
		</SettingsSection>

		{#if forecast}
			<SettingsSection title={m.settings_history_forecast()}>
				<div class="grid grid-cols-3 gap-4">
					<div class="rounded-lg border bg-base-200 p-3 text-center">
						<div class="text-lg font-bold">{formatBytes(forecast.currentEstimatedBytes)}</div>
						<div class="text-xs text-base-content/60">{m.settings_history_forecast_current()}</div>
					</div>
					<div class="rounded-lg border bg-base-200 p-3 text-center">
						<div class="text-lg font-bold">{formatBytes(forecast.projectedBytes30d)}</div>
						<div class="text-xs text-base-content/60">{m.settings_history_forecast_30d()}</div>
					</div>
					<div class="rounded-lg border bg-base-200 p-3 text-center">
						<div class="text-lg font-bold">{formatBytes(forecast.projectedBytes90d)}</div>
						<div class="text-xs text-base-content/60">{m.settings_history_forecast_90d()}</div>
					</div>
				</div>
			</SettingsSection>
		{/if}
	{/if}
</SettingsPage>
