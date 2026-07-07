<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { SettingsPage, SettingsSection } from '$lib/components/ui/settings';
	import { toasts } from '$lib/stores/toast.svelte';
	import { Plus, Trash2 } from 'lucide-svelte';
	import {
		getResolutionCategories,
		createResolutionCategory,
		updateResolutionCategory,
		deleteResolutionCategory,
		type ResolutionCategory
	} from '$lib/api/resolution-categories.js';

	let categories = $state<ResolutionCategory[]>([]);
	let saving = $state(false);

	// New category form
	let newLabel = $state('');
	let newMinWidth = $state(0);
	let newMinHeight = $state(0);
	let newSearchTerms = $state('');

	onMount(() => {
		void load();
	});

	async function load() {
		try {
			categories = await getResolutionCategories();
		} catch {
			categories = [];
		}
	}

	async function handleAdd() {
		if (!newLabel.trim()) return;
		saving = true;
		try {
			await createResolutionCategory({
				label: newLabel.trim(),
				minWidth: newMinWidth,
				minHeight: newMinHeight,
				searchTerms: newSearchTerms
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			});
			newLabel = '';
			newMinWidth = 0;
			newMinHeight = 0;
			newSearchTerms = '';
			await load();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : m.settings_resolutions_failed());
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteResolutionCategory(id);
			await load();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : m.settings_resolutions_failed());
		}
	}

	async function handleUpdate(cat: ResolutionCategory) {
		try {
			await updateResolutionCategory(cat.id, {
				label: cat.label,
				minWidth: cat.minWidth,
				minHeight: cat.minHeight,
				searchTerms: cat.searchTerms ?? []
			});
			toasts.success(m.settings_resolutions_saved());
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : m.settings_resolutions_failed());
		}
	}
</script>

<svelte:head>
	<title>{m.settings_resolutions_title()}</title>
</svelte:head>

<SettingsPage
	title={m.settings_resolutions_title()}
	subtitle={m.settings_resolutions_description()}
>
	<SettingsSection title="Existing Categories">
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>{m.settings_resolutions_label()}</th>
						<th>{m.settings_resolutions_min_width()}</th>
						<th>{m.settings_resolutions_min_height()}</th>
						<th>{m.settings_resolutions_search_terms()}</th>
						<th>{m.settings_resolutions_fallback()}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each categories as cat (cat.id)}
						<tr>
							<td>
								<input
									class="input input-bordered input-xs w-24"
									value={cat.label}
									onchange={(e) => {
										cat.label = (e.currentTarget as HTMLInputElement).value;
										void handleUpdate(cat);
									}}
								/>
							</td>
							<td>
								<input
									class="input input-bordered input-xs w-20"
									type="number"
									min="0"
									value={cat.minWidth}
									onchange={(e) => {
										cat.minWidth = parseInt((e.currentTarget as HTMLInputElement).value, 10) || 0;
										void handleUpdate(cat);
									}}
								/>
							</td>
							<td>
								<input
									class="input input-bordered input-xs w-20"
									type="number"
									min="0"
									value={cat.minHeight}
									onchange={(e) => {
										cat.minHeight = parseInt((e.currentTarget as HTMLInputElement).value, 10) || 0;
										void handleUpdate(cat);
									}}
								/>
							</td>
							<td>
								<input
									class="input input-bordered input-xs w-40"
									value={(cat.searchTerms ?? []).join(', ')}
									onchange={(e) => {
										cat.searchTerms = (e.currentTarget as HTMLInputElement).value
											.split(',')
											.map((s) => s.trim())
											.filter(Boolean);
										void handleUpdate(cat);
									}}
								/>
							</td>
							<td>
								{#if cat.isFallback}
									<span class="badge badge-success badge-sm"
										>{m.settings_resolutions_fallback()}</span
									>
								{/if}
							</td>
							<td>
								{#if !cat.isFallback}
									<button
										class="btn btn-ghost btn-xs text-error"
										onclick={() => handleDelete(cat.id)}
									>
										<Trash2 class="h-3 w-3" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</SettingsSection>

	<SettingsSection title={m.settings_resolutions_add()}>
		<div class="grid gap-3 sm:grid-cols-5 sm:items-end">
			<div class="form-control">
				<label class="label py-1" for="new-label">
					<span class="label-text">{m.settings_resolutions_label()}</span>
				</label>
				<input id="new-label" class="input input-bordered input-sm" bind:value={newLabel} />
			</div>
			<div class="form-control">
				<label class="label py-1" for="new-width">
					<span class="label-text">{m.settings_resolutions_min_width()}</span>
				</label>
				<input
					id="new-width"
					class="input input-bordered input-sm w-24"
					type="number"
					min="0"
					bind:value={newMinWidth}
				/>
			</div>
			<div class="form-control">
				<label class="label py-1" for="new-height">
					<span class="label-text">{m.settings_resolutions_min_height()}</span>
				</label>
				<input
					id="new-height"
					class="input input-bordered input-sm w-24"
					type="number"
					min="0"
					bind:value={newMinHeight}
				/>
			</div>
			<div class="form-control">
				<label class="label py-1" for="new-terms">
					<span class="label-text">{m.settings_resolutions_search_terms()}</span>
				</label>
				<input
					id="new-terms"
					class="input input-bordered input-sm w-48"
					bind:value={newSearchTerms}
					placeholder="2160p, 4k, uhd"
				/>
			</div>
			<button
				class="btn btn-primary btn-sm"
				onclick={handleAdd}
				disabled={saving || !newLabel.trim()}
			>
				<Plus class="h-4 w-4" />
				{m.settings_resolutions_add()}
			</button>
		</div>
	</SettingsSection>
</SettingsPage>
