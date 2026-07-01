<script lang="ts">
	let { children } = $props();
</script>

<div class="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
	{@render children()}
</div>
