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
	const box = 'w-full rounded-lg border border-rule bg-ground px-3 py-2 hover:border-(--accent)';
	const btn = 'rt-fancy-btn rounded-lg px-3 py-1 font-display text-lg';
	const current = $derived(saved.find((s) => s.sql === sql.trim()));
	let naming = $state<{ name: string; description: string }>();

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
		if (!naming?.name.trim()) return;
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
{#if current?.description}<p class="-mt-3 mb-6 text-muted" data-saved-description>{current.description}</p>{/if}
<ol class="mb-4 list-inside list-decimal text-muted">
	<li>Ask for a report here.</li>
	<li>Copy the prompt to an LLM of your choice, like Claude or ChatGPT.</li>
	<li>Paste the SQL query below and run it.</li>
	<li>Save the report if you like it.</li>
</ol>
<div class="mb-6 flex gap-2">
	<input class={box} bind:value={request} oninput={() => (copied = false)} placeholder="Give me the top biggest tree planting days this season." data-request />
	<button class="{btn} shrink-0" onclick={copy} data-copy-prompt>{copied ? 'Copied' : 'Copy prompt'}</button>
</div>
<textarea class="{box} font-mono text-sm" rows="8" bind:value={sql} placeholder="SELECT …" data-sql></textarea>
<div class="my-3 flex gap-2">
	<button class={btn} onclick={run} data-run>Run</button>
	{#if result && 'rows' in result && !current && !naming}
		<button class={btn} onclick={() => (naming = { name: '', description: request.trim() })} data-save>Save report</button>
	{/if}
</div>
{#if naming}
	<div class="mb-6 flex flex-col gap-2" data-naming>
		<input class={box} bind:value={naming.name} placeholder="Pill name, like Big days" data-save-name />
		<textarea class={box} rows="2" bind:value={naming.description} placeholder="What this report shows" data-save-description></textarea>
		<div class="flex gap-2">
			<button class={btn} onclick={save} disabled={!naming.name.trim()} data-save-confirm>Save</button>
			<button class="px-3 text-muted hover:text-ink" onclick={() => (naming = undefined)}>Cancel</button>
		</div>
	</div>
{/if}
{#if result && 'error' in result}
	<p class="text-muted" data-sql-error>{result.error}</p>
{:else if result}
	{#key result}<DataTable rows={result.rows} columns={Object.keys(result.rows[0] ?? {})} name="Query" />{/key}
{/if}
