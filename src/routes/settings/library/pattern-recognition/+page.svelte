<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { SettingsPage, SettingsSection } from '$lib/components/ui/settings';
	import { toasts } from '$lib/stores/toast.svelte';
	import { Plus, X } from 'lucide-svelte';
	import {
		getPatternConfig,
		savePatternConfig,
		type PatternConfigRow,
		type PatternConfigUpdate
	} from '$lib/api/pattern-config.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedLibraryId = $state<string>('');
	let config = $state<PatternConfigRow | null>(null);
	let saving = $state(false);
	let newIgnorePattern = $state('');
	let newBonusPattern = $state('');

	onMount(() => {
		void loadConfig();
	});

	async function loadConfig() {
		try {
			config = await getPatternConfig(selectedLibraryId || undefined);
			// Ensure arrays exist
			config.ignoreUserPatterns ??= [];
			config.bonusPatterns ??= [];
		} catch {
			config = null;
		}
	}

	async function handleSelectLibrary() {
		await loadConfig();
	}

	function addIgnorePattern() {
		if (!newIgnorePattern.trim() || !config) return;
		if (!config.ignoreUserPatterns) config.ignoreUserPatterns = [];
		config.ignoreUserPatterns = [...config.ignoreUserPatterns, newIgnorePattern.trim()];
		newIgnorePattern = '';
	}

	function removeIgnorePattern(index: number) {
		if (!config?.ignoreUserPatterns) return;
		config.ignoreUserPatterns = config.ignoreUserPatterns.filter((_, i) => i !== index);
	}

	function addBonusPattern() {
		if (!newBonusPattern.trim() || !config) return;
		if (!config.bonusPatterns) config.bonusPatterns = [];
		config.bonusPatterns = [...config.bonusPatterns, newBonusPattern.trim()];
		newBonusPattern = '';
	}

	function removeBonusPattern(index: number) {
		if (!config?.bonusPatterns) return;
		config.bonusPatterns = config.bonusPatterns.filter((_, i) => i !== index);
	}

	async function handleSave() {
		if (!config) return;
		saving = true;
		try {
			const input: PatternConfigUpdate = {
				ignoreDefaultsEnabled: config.ignoreDefaultsEnabled ?? true,
				ignoreUserPatterns: config.ignoreUserPatterns ?? [],
				bonusPatterns: config.bonusPatterns ?? [],
				structureMode: (config.structureMode as 'none' | 'folder_depth' | 'regex' | null) || 'none',
				structureConfig: config.structureConfig
			};
			if (selectedLibraryId) {
				input.libraryId = selectedLibraryId;
			}
			await savePatternConfig(input);
			toasts.success(m.settings_patterns_saved());
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : m.settings_patterns_failed());
		} finally {
			saving = false;
		}
	}

	function toggleStructureMode(mode: string) {
		if (!config) return;
		config.structureMode = mode;
		if (mode === 'none') {
			config.structureConfig = null;
		} else if (mode === 'folder_depth') {
			config.structureConfig = { seriesFolderDepth: 0, seasonFolderDepth: 1 };
		} else {
			config.structureConfig = null;
		}
	}
</script>

<svelte:head>
	<title>{m.settings_patterns_title()}</title>
</svelte:head>

<SettingsPage title={m.settings_patterns_title()} subtitle={m.settings_patterns_description()}>
	<!-- Library scope selector -->
	<div class="mb-6">
		<label class="label py-1" for="pattern-library">
			<span class="label-text">{m.settings_patterns_select_library()}</span>
		</label>
		<select
			id="pattern-library"
			class="select select-bordered select-sm w-full max-w-md"
			bind:value={selectedLibraryId}
			onchange={handleSelectLibrary}
		>
			<option value="">{m.settings_patterns_all_libraries()}</option>
			{#each data.libraries as library (library.id)}
				<option value={library.id}>{library.name}</option>
			{/each}
		</select>
	</div>

	{#if config}
		<!-- Scope indicator -->
		<div class="mb-4 text-sm text-base-content/60">
			{#if selectedLibraryId}
				{m.settings_patterns_scope_library()}
			{:else}
				{m.settings_patterns_scope_global()}
			{/if}
		</div>

		<!-- Ignore Patterns -->
		<SettingsSection
			title={m.settings_patterns_ignore()}
			description={m.settings_patterns_ignore_desc()}
		>
			<label class="label cursor-pointer justify-start gap-3">
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm"
					bind:checked={config.ignoreDefaultsEnabled!}
				/>
				<span class="label-text">{m.settings_patterns_ignore_enabled()}</span>
			</label>

			<div class="mt-3 space-y-1">
				{#each config.ignoreUserPatterns ?? [] as pattern, i (i)}
					<div class="flex items-center gap-2">
						<span class="badge">{pattern}</span>
						<button class="btn btn-ghost btn-xs text-error" onclick={() => removeIgnorePattern(i)}>
							<X class="h-3 w-3" />
						</button>
					</div>
				{/each}
			</div>

			<div class="mt-2 flex gap-2">
				<input
					type="text"
					class="input input-bordered input-sm flex-1"
					bind:value={newIgnorePattern}
					placeholder={m.settings_patterns_ignore_user_placeholder()}
				/>
				<button
					class="btn btn-primary btn-sm"
					onclick={addIgnorePattern}
					disabled={!newIgnorePattern.trim()}
				>
					<Plus class="h-4 w-4" />
					{m.settings_patterns_ignore_user_add()}
				</button>
			</div>
		</SettingsSection>

		<!-- Bonus Patterns -->
		<SettingsSection
			title={m.settings_patterns_bonus()}
			description={m.settings_patterns_bonus_desc()}
		>
			<div class="space-y-1">
				{#each config.bonusPatterns ?? [] as pattern, i (i)}
					<div class="flex items-center gap-2">
						<span class="badge">{pattern}</span>
						<button class="btn btn-ghost btn-xs text-error" onclick={() => removeBonusPattern(i)}>
							<X class="h-3 w-3" />
						</button>
					</div>
				{/each}
			</div>

			<div class="mt-2 flex gap-2">
				<input
					type="text"
					class="input input-bordered input-sm flex-1"
					bind:value={newBonusPattern}
					placeholder={m.settings_patterns_bonus_placeholder()}
				/>
				<button
					class="btn btn-primary btn-sm"
					onclick={addBonusPattern}
					disabled={!newBonusPattern.trim()}
				>
					<Plus class="h-4 w-4" />
					{m.settings_patterns_bonus_add()}
				</button>
			</div>
		</SettingsSection>

		<!-- Structure Recognition -->
		<SettingsSection
			title={m.settings_patterns_structure()}
			description={m.settings_patterns_structure_desc()}
		>
			<div class="form-control">
				<label class="label py-1" for="struct-mode">
					<span class="label-text">{m.settings_patterns_structure_mode()}</span>
				</label>
				<select
					id="struct-mode"
					class="select select-bordered select-sm w-full max-w-sm"
					value={config.structureMode || 'none'}
					onchange={(e) => toggleStructureMode((e.currentTarget as HTMLSelectElement).value)}
				>
					<option value="none">{m.settings_patterns_structure_none()}</option>
					<option value="folder_depth">{m.settings_patterns_structure_folder_depth()}</option>
					<option value="regex">{m.settings_patterns_structure_regex()}</option>
				</select>
			</div>

			{#if config.structureMode === 'folder_depth'}
				<div class="mt-3 grid gap-4 sm:grid-cols-2">
					<div class="form-control">
						<label class="label py-1" for="series-depth">
							<span class="label-text">{m.settings_patterns_structure_series_depth()}</span>
						</label>
						<input
							id="series-depth"
							type="number"
							class="input input-bordered input-sm w-full"
							min="0"
							max="10"
							bind:value={config.structureConfig!.seriesFolderDepth!}
						/>
					</div>
					<div class="form-control">
						<label class="label py-1" for="season-depth">
							<span class="label-text">{m.settings_patterns_structure_season_depth()}</span>
						</label>
						<input
							id="season-depth"
							type="number"
							class="input input-bordered input-sm w-full"
							min="1"
							max="10"
							bind:value={config.structureConfig!.seasonFolderDepth!}
						/>
					</div>
				</div>
			{/if}
		</SettingsSection>

		<!-- Save -->
		<div class="modal-action mt-4 border-t border-base-300 pt-4">
			<button type="button" class="btn btn-primary btn-sm" onclick={handleSave} disabled={saving}>
				{m.settings_general_saveLibrary()}
			</button>
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-base-300 p-8 text-center">
			<p class="text-base-content/60">{m.settings_libraries_scan_loading()}</p>
		</div>
	{/if}
</SettingsPage>
