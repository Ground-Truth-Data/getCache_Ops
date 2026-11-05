<script lang="ts">
	import type { Snippet } from 'svelte';

	// The words a screen would otherwise need, shown only when someone taps "i".
	let { label, children }: { label: string; children: Snippet } = $props();
	let open = $state(false);
</script>

<span class="relative inline-flex">
	<button
		class="h-11 w-11 shrink-0 rounded-full border-2 border-[#6b6458] font-sans text-xl font-bold text-[#d8d2c6] hover:border-(--accent) hover:text-(--accent)"
		aria-label={label}
		aria-expanded={open}
		onclick={() => (open = !open)}
		data-info>i</button
	>
	{#if open}
		<span class="absolute top-13 left-0 z-20 w-72 rounded-xl border border-rule bg-surface p-4 text-base text-ink shadow-xl" role="note" data-info-text>
			{@render children()}
		</span>
	{/if}
</span>
