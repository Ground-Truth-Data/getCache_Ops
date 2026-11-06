<script lang="ts">
	import type { Ops } from '../plugin/api';
	import Pill from '../../_rapper/rt/admin/Pill.svelte';
	import { prompt, refusal } from './ask';
	import DataTable from './DataTable.svelte';

	type Saved = { name: string; description: string; sql: string };
	const KEY = 'ops:savedQueries';

	let { ops }: { ops: Ops } = $props();
	let request = $state('');
	let sql = $state('');
	let copied = $state(false);
	let result = $state<{ rows: Record<string, unknown>[] } | { error: string }>();
	// This browser only: Ops never writes the planter's file.
	let saved = $state<Saved[]>(load());
	const box = 'w-full rounded-lg border border-rule bg-field px-3 py-2 outline-none hover:border-(--accent) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/30';
	const btn = 'rt-fancy-btn rounded-lg px-3 py-1 font-display text-lg';
	const current = $derived(saved.find((s) => s.sql === sql.trim()));
	let naming = $state<{ name: string; description: string; missing?: boolean }>();

	function load(): Saved[] {
		try {
			return JSON.parse(localStorage.getItem(KEY) ?? '[]');
		} catch (e) {
			console.warn('[ops:saved]', e);
			return [];
		}
	}

	function keep(next: Saved[]) {
		saved = next;
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch (e) {
			console.warn('[ops:saved]', e);
		}
	}

	async function copy() {
		await navigator.clipboard.writeText(prompt((q) => ops.query(q), request));
		copied = true;
	}

	function run() {
		const why = refusal(sql);
		try {
			result = why ? { error: why } : { rows: ops.query(sql) };
		} catch (e) {
			result = { error: (e as Error).message };
		}
	}

	function open(s: Saved) {
		request = '';
		sql = s.sql;
		naming = undefined;
		run();
	}

	function save() {
		if (!naming) return;
		if (!naming.name.trim()) return void (naming.missing = true);
		keep([...saved, { name: naming.name.trim(), description: naming.description.trim(), sql: sql.trim() }]);
		naming = undefined;
	}
</script>

{#if saved.length}
	<nav class="mb-6 flex flex-wrap gap-2" data-saved>
		{#each saved as s (s.sql)}
			<Pill href="#/advanced" active={s.sql === sql.trim()} onclick={(e) => (e.preventDefault(), open(s))}>
				{s.name}
				<span
					class="ml-2 opacity-60 hover:opacity-100"
					role="button"
					tabindex="0"
					aria-label="Remove {s.name}"
					onclick={(e) => (e.preventDefault(), e.stopPropagation(), keep(saved.filter((x) => x !== s)))}
					onkeydown={(e) => e.key === 'Enter' && keep(saved.filter((x) => x !== s))}
					data-unsave>×</span
				>
			</Pill>
		{/each}
	</nav>
{/if}
{#if result}
	<section class="mb-10" data-result>
		<h2 class="font-display text-3xl text-(--accent)" data-result-title>{current?.name ?? 'Result'}</h2>
		{#if current?.description}<p class="mb-4 text-muted" data-saved-description>{current.description}</p>{/if}
		{#if 'error' in result}
			<p class="mt-2 text-muted" data-sql-error>{result.error}</p>
		{:else}
			{#key result}<DataTable rows={result.rows} columns={Object.keys(result.rows[0] ?? {})} name={current?.name ?? 'Query'} />{/key}
		{/if}
	</section>
{/if}
<h1 class="mb-6 font-display text-3xl text-(--accent)">SQL Queries</h1>
<div class="max-w-4xl">
		<label for="request" class="mb-2 block font-display text-2xl text-ink">1 · Ask for a report</label>
		<textarea id="request" class="{box} mb-3 resize-none text-lg" rows="2" bind:value={request} oninput={() => (copied = false)} placeholder="Give me the top 10 tree planting days of this season." data-request></textarea>
		<div class="mb-6 flex flex-wrap items-center gap-3" data-llms>
			<button class="{btn} px-5 py-2 text-xl" onclick={copy} data-copy-prompt>{copied ? 'Copied ✓' : '2 · Copy prompt'}</button>
			<span class="font-display text-xl text-ink">→ 3 · paste it into</span>
			{#each [['Claude', 'https://claude.ai/new'], ['ChatGPT', 'https://chatgpt.com/']] as [name, href] (name)}
				<a {href} target="_blank" rel="noopener" class="rounded-lg border-2 border-(--accent) px-5 py-2 font-display text-xl text-ink hover:bg-(--accent)/15">{name} ↗</a>
			{/each}
		</div>
		<label for="sql" class="mb-2 block font-display text-2xl text-ink"><span class="text-(--accent)">⬇</span> 4 · Paste the SQL it gives you back here <span class="text-(--accent)">⬇</span></label>
		<textarea id="sql" class="{box} font-mono text-sm" rows="8" bind:value={sql} placeholder="SELECT ..." data-sql></textarea>
		<div class="my-3 flex gap-2">
			<button class={btn} onclick={run} data-run>Run</button>
			{#if result && 'rows' in result && !current && !naming}
				<button class={btn} onclick={() => (naming = { name: '', description: request.trim() })} data-save>Save report</button>
			{/if}
		</div>
		{#if naming}
			<div class="flex flex-col gap-2" data-naming>
				<input
					class="{box} {naming.missing ? 'border-red-500!' : ''}"
					bind:value={naming.name}
					oninput={() => naming && (naming.missing = false)}
					placeholder="Report name (required), like Big days"
					aria-invalid={naming.missing}
					data-save-name
				/>
				{#if naming.missing}<p class="text-sm text-red-500" data-save-name-missing>Name the report to save it.</p>{/if}
				<textarea class={box} rows="2" bind:value={naming.description} placeholder="What this report shows" data-save-description></textarea>
				<div class="flex gap-2">
					<button class={btn} onclick={save} data-save-confirm>Save</button>
					<button class="px-3 text-muted hover:text-ink" onclick={() => (naming = undefined)}>Cancel</button>
				</div>
			</div>
		{/if}
	</div>
