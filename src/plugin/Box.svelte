<script lang="ts">
	import type { Ops } from '../data/db';
	import { answer, srcdoc, type Report } from './host';

	let { report, ops }: { report: Report; ops: Ops } = $props();

	// Asked again whenever the report asks for a different set of tables.
	const KEY = $derived(`ops:allowed:${report.id}`);
	const asked = $derived(report.tables.join(','));
	const stored = () => {
		try {
			return localStorage.getItem(KEY);
		} catch {
			return null;
		}
	};
	let allowed = $derived(stored() === asked);
	function allow() {
		try {
			localStorage.setItem(KEY, asked);
		} catch (e) {
			console.warn('[ops] allow', e);
		}
		allowed = true;
	}

	let frame = $state<HTMLIFrameElement>();
	const doc = $derived(allowed ? fetch(report.url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(srcdoc) : undefined);

	function message(e: MessageEvent) {
		const box = frame?.contentWindow;
		if (!box || e.source !== box) return;
		const file = (e.data as { file?: { name?: unknown; text?: unknown } })?.file;
		if (file) return typeof file.text === 'string' && save(String(file.name ?? 'report.txt'), file.text);
		const reply = answer(report, e.data, ops.query);
		if (reply) box.postMessage(reply, '*');
	}

	function save(name: string, text: string) {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([text]));
		a.download = name.replace(/[\\/:*?"<>|]/g, '_');
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<svelte:window onmessage={message} />

{#if !allowed}
	<section class="max-w-xl rounded-xl border border-rule bg-surface p-6" data-permission={report.id}>
		<p class="mb-3">{report.name} is {report.id === 'starter' ? 'a sample' : 'your company’s own'} report, from {new URL(report.url, location.href).host}.</p>
		<p class="mb-2 text-muted">It will see these rows of yours, and nothing else:</p>
		<ul class="mb-4 list-disc pl-6">{#each report.tables as t (t)}<li>{t}</li>{/each}</ul>
		<p class="mb-4 text-sm text-muted">It cannot reach the internet, your sign-in or this page. It saves files only through Export.</p>
		<button class="rt-fancy-btn rounded-lg px-4 py-1 font-display text-lg" onclick={allow} data-allow>Allow</button>
	</section>
{:else}
	<div class="mb-3 flex gap-2 print:hidden">
		<button class="small-btn" onclick={() => frame?.contentWindow?.postMessage({ export: true }, '*')} data-export>Export</button>
		<button class="small-btn" onclick={() => print()} data-print>Print</button>
	</div>
	{#await doc then html}
		<iframe bind:this={frame} title={report.name} sandbox="allow-scripts" srcdoc={html} class="h-[75vh] w-full rounded-lg border border-rule" data-box={report.id}></iframe>
	{:catch e}
		<p class="text-muted" data-failed>{report.name} could not be fetched: {(e as Error).message}</p>
	{/await}
{/if}
