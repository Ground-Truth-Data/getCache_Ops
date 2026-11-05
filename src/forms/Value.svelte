<script lang="ts">
	import { text } from './answers';

	let { v, photo }: { v: unknown; photo?: (key: string) => string | undefined } = $props();
	const urls = $derived(Array.isArray(v) ? v.map((x) => photo?.((x as { content?: string })?.content ?? '')).filter(Boolean) : []);
</script>

{#if urls.length}{#each urls as src (src)}<img {src} alt="" class="h-16 rounded" data-photo />{/each}{:else}{text(v)}{/if}
