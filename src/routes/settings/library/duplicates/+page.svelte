<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { SettingsPage, SettingsSection } from '$lib/components/ui/settings';
	import {
		getDuplicates,
		suppressDuplicate,
		unsuppressDuplicate,
		type DuplicateGroup
	} from '$lib/api/duplicates.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let libraryId = $state('');
	let mode = $state<'filename' | 'filehash'>('filename');
	let duplicates = $state<DuplicateGroup[]>([]);
	let loading = $state(false);

	async function load() {
		loading = true;
		try {
			duplicates = await getDuplicates(libraryId, mode);
		} catch {
			duplicates = [];
		} finally {
			loading = false;
		}
	}

	async function handleSuppress(group: DuplicateGroup) {
		await suppressDuplicate(libraryId || 'all', group.signature, group.signatureType);
		await load();
	}

	async function handleUnsuppress(group: DuplicateGroup) {
		await unsuppressDuplicate(libraryId || 'all', group.signature, group.signatureType);
		await load();
	}
</script>

<svelte:head>
	<title>{m.settings_duplicates_title()}</title>
</svelte:head>

<SettingsPage title={m.settings_duplicates_title()} subtitle={m.settings_duplicates_description()}>
	<div class="mb-4 flex flex-wrap gap-3">
		<select class="select select-bordered select-sm w-48" bind:value={libraryId}>
			<option value="">{m.settings_duplicates_all()}</option>
			{#each data.libraries as lib (lib.id)}
				<option value={lib.id}>{lib.name}</option>
			{/each}
		</select>
		<select class="select select-bordered select-sm w-48" bind:value={mode}>
			<option value="filename">{m.settings_duplicates_filename()}</option>
			<option value="filehash">{m.settings_duplicates_filehash()}</option>
		</select>
		<button class="btn btn-primary btn-sm" onclick={load} disabled={loading}>
			{loading ? '...' : m.settings_general_saveLibrary()}
		</button>
	</div>

	{#if duplicates.length === 0 && !loading}
		<div class="rounded-lg border border-dashed border-base-300 p-8 text-center">
			<p class="text-base-content/60">{m.settings_duplicates_no_dupes()}</p>
		</div>
	{:else}
		<SettingsSection title="Results">
			<div class="space-y-2">
				{#each duplicates as group (group.signature)}
					<div class="rounded-lg border p-3" class:opacity-50={group.suppressed}>
						<div class="flex items-center justify-between">
							<div>
								<span class="font-medium">{group.signature}</span>
								<span class="ml-2 text-sm text-base-content/60">
									{group.count}
									{m.settings_duplicates_files()}
								</span>
							</div>
							<button
								class="btn btn-ghost btn-xs"
								onclick={() => (group.suppressed ? handleUnsuppress(group) : handleSuppress(group))}
							>
								{group.suppressed
									? m.settings_duplicates_unsuppress()
									: m.settings_duplicates_suppress()}
							</button>
						</div>
						<div class="mt-2 max-h-32 overflow-y-auto text-xs text-base-content/60">
							{#each group.paths as path (path)}
								<div>{path}</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</SettingsSection>
	{/if}
</SettingsPage>
