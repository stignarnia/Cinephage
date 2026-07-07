<script lang="ts">
	import {
		Library,
		FolderOpen,
		FileSignature,
		Shield,
		Filter,
		FolderSync,
		Eye,
		Monitor,
		Clock
	} from 'lucide-svelte';
	import { SettingsTabNav } from '$lib/components/settings';
	import * as m from '$lib/paraglide/messages.js';

	let { children } = $props();

	const navItems = [
		{
			href: '/settings/library/libraries',
			label: m.settings_general_tabLibraries(),
			icon: Library
		},
		{
			href: '/settings/library/root-folders',
			label: m.settings_general_tabRootFolders(),
			icon: FolderOpen
		},
		{
			href: '/settings/library/file-management',
			label: m.settings_general_tabFileManagement(),
			icon: FolderSync
		},
		{
			href: '/settings/library/naming',
			label: m.nav_naming(),
			icon: FileSignature
		},
		{
			href: '/settings/library/quality',
			label: m.nav_qualitySettings(),
			icon: Shield
		},
		{
			href: '/settings/library/filters',
			label: m.nav_globalFilters(),
			icon: Filter
		},
		{
			href: '/settings/library/pattern-recognition',
			label: m.settings_patterns_title(),
			icon: Eye
		},
		{
			href: '/settings/library/resolution-categories',
			label: m.settings_resolutions_title(),
			icon: Monitor
		},
		{
			href: '/settings/library/history-retention',
			label: m.settings_history_title(),
			icon: Clock
		}
	];
</script>

<div class="flex min-h-full flex-col">
	<SettingsTabNav {navItems} ariaLabel="Library settings" />

	<div class="flex-1">
		{@render children()}
	</div>
</div>
