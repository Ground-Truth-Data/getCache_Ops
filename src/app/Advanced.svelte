<script lang="ts">
	import type { Ops } from '../data/db';
	import Pill from '../../_rapper/rt/admin/Pill.svelte';
	import { comment, prompt, refusal, sqlOf } from './ask';
	import DataTable from './DataTable.svelte';

	type Saved = { name: string; description: string; sql: string };
	const KEY = 'ops:savedQueries';

	let { ops }: { ops: Ops } = $props();
	let request = $state('');
	const dull = $derived(!request.trim());
	let sql = $state('');
	let copied = $state(false);
	let result = $state<{ rows: Record<string, unknown>[] } | { error: string }>();
	// This browser only: Ops never writes the planter's file.
	let saved = $state<Saved[]>(load());
	let doomed = $state<Saved>();
	const box = 'w-full rounded-lg border border-rule bg-field px-3 py-2 outline-none hover:border-(--accent) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/30';
	const btn = 'rt-fancy-btn rounded-lg px-3 py-1 font-display text-lg';
	const current = $derived(saved.find((s) => s.sql === sql.trim()));

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
		sql = sqlOf(sql);
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
		run();
	}

	function save() {
		const name = comment(sql, 'Name') || `Report ${saved.length + 1}`;
		keep([...saved, { name, description: comment(sql, 'Shows') || request.trim(), sql: sql.trim() }]);
	}
</script>

{#if saved.length}
	<nav class="mb-6 flex flex-wrap gap-2" data-saved>
		{#each saved as s (s.sql)}
			{#if doomed === s}
				<span class="flex items-center gap-2 rounded-full border border-red-500 px-3 py-1 text-sm" data-unsave-confirm>
					Delete “{s.name}” for good?
					<button class="rounded-full bg-red-500 px-2.5 text-white hover:bg-red-600" onclick={() => keep(saved.filter((x) => x !== s))} data-unsave-yes>Delete</button>
					<button class="text-muted hover:text-ink" onclick={() => (doomed = undefined)}>Keep</button>
				</span>
			{:else}
				<Pill href="advanced" active={s.sql === sql.trim()} onclick={(e) => (e.preventDefault(), open(s))}>
					{s.name}
					<span
						class="ml-2 opacity-60 hover:opacity-100"
						role="button"
						tabindex="0"
						aria-label="Remove {s.name}"
						onclick={(e) => (e.preventDefault(), e.stopPropagation(), (doomed = s))}
						onkeydown={(e) => e.key === 'Enter' && (doomed = s)}
						data-unsave>×</span
					>
				</Pill>
			{/if}
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
{#snippet arrow(deg: number)}<span class="inline-block text-(--accent)" style:rotate="{deg}deg">⬇&#xFE0E;</span>{/snippet}
<h1 class="mb-6 font-display text-3xl text-(--accent)">SQL Queries</h1>
<div class="max-w-4xl">
		<label for="request" class="mb-2 block font-display text-2xl text-ink">1 · Ask for a report</label>
		<textarea id="request" class="{box} mb-3 resize-none text-lg" rows="2" bind:value={request} oninput={() => (copied = false)} placeholder="Give me the top 10 tree planting days of this season." data-request></textarea>
		<div class="mb-6 flex flex-wrap items-center gap-3" data-llms>
			<button class="{btn} px-5 py-2 text-xl" class:dull disabled={dull} onclick={copy} data-copy-prompt>{copied ? 'Copied ✓' : '2 · Copy prompt'}</button>
			<span class="font-display text-xl text-ink">{@render arrow(-90)} 3 · paste it into</span>
			{#each [['Claude', 'https://claude.ai/new'], ['ChatGPT', 'https://chatgpt.com/']] as [name, href] (name)}
				<a {href} target="_blank" rel="noopener" class:dull inert={dull} class="rounded-lg border-2 border-(--accent) px-5 py-2 font-display text-xl text-ink hover:bg-(--accent)/15">{name} {@render arrow(-135)}</a>
			{/each}
		</div>
		<label for="sql" class="mb-2 block font-display text-2xl text-ink">4 · Paste the entire SQL response in here {@render arrow(0)}{@render arrow(0)}{@render arrow(0)}</label>
		<textarea id="sql" class="{box} font-mono text-sm" rows="8" bind:value={sql} placeholder="SELECT ..." data-sql></textarea>
		<div class="my-3 flex items-center gap-3">
			<button class={btn} onclick={run} data-run>Run</button>
			{#if current}
				<span class="font-display text-xl text-(--accent)" data-saved-as>Saved as “{current.name}” ✓</span>
			{:else if result && 'rows' in result}
				<button class={btn} onclick={save} data-save>Save report</button>
			{/if}
		</div>
	</div>

<!-- Nothing asked yet: Copy, Claude and ChatGPT stay grey and dead until the box has words. -->
<style>
	.dull {
		filter: grayscale(1);
		opacity: 0.4;
		box-shadow: none;
	}
</style>
