<script lang="ts">
	import type { Ops } from '../plugin/api';
	import { prompt, refusal } from './ask';
	import DataTable from './DataTable.svelte';

	let { ops }: { ops: Ops } = $props();
	let request = $state('');
	let sql = $state('');
	let copied = $state(false);
	let result = $state<{ rows: Record<string, unknown>[] } | { error: string }>();
	const box = 'w-full rounded-lg border border-rule bg-ground px-3 py-2 hover:border-(--accent)';
	const btn = 'rt-fancy-btn rounded-lg px-3 py-1 font-display text-lg';

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
</script>

<p class="mb-2 text-muted">Say what you want, copy the prompt into any AI, paste its SQL below.</p>
<div class="mb-6 flex gap-2">
	<input class={box} bind:value={request} oninput={() => (copied = false)} placeholder="trees per planter per day, sorted by most trees" data-request />
	<button class="{btn} shrink-0" onclick={copy} data-copy-prompt>{copied ? 'Copied' : 'Copy prompt'}</button>
</div>
<textarea class="{box} font-mono text-sm" rows="8" bind:value={sql} placeholder="SELECT …" data-sql></textarea>
<button class="{btn} my-3" onclick={run} data-run>Run</button>
{#if result && 'error' in result}
	<p class="text-muted" data-sql-error>{result.error}</p>
{:else if result}
	{#key result}<DataTable rows={result.rows} columns={Object.keys(result.rows[0] ?? {})} name="Query" />{/key}
{/if}
