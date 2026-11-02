<script lang="ts">
	import type { Snippet } from 'svelte';
	import { nextSort, sortArrow, type SortState } from '../plugin/sortRows';
	import { csv, totals, view } from './dataTable';
	import { moneyIn } from './money';

	// `money` columns show in each row's own currency, so `currency` needs no column on screen; sort and CSV keep the raw number.
	let { rows, columns, name, money = [], toggle, panel }: { rows: Record<string, unknown>[]; columns: string[]; name: string; money?: string[]; toggle?: Snippet; panel?: Snippet } = $props();
	const shown = $derived(money.length ? columns.filter((c) => c !== 'currency') : columns);
	const price = $derived(moneyIn(rows));
	let q = $state('');
	let sort = $state<SortState>({ col: '', asc: true });
	let page = $state(0);
	const v = $derived(view(rows, q, sort, page));
	const sums = $derived(totals(v.hits, shown, money));
	const sigma = (t: (typeof sums)[string]) => (typeof t === 'number' ? t.toLocaleString() : price(t.sum, t.currency));
	const button = 'rounded-lg border border-(--accent) px-3 py-1 font-display text-(--accent) disabled:opacity-30';
	const show = (x: unknown) => (typeof x === 'number' ? x.toLocaleString() : String(x ?? ''));

	function download() {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([csv(v.hits, columns)]));
		a.download = `${name}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<section class="mb-8" data-table={name}>
	<div class="mb-2 flex flex-wrap items-center gap-3">
		<h2 class="mr-auto font-display text-xl text-heading">{name} · {v.label}</h2>
		<input class="rounded-lg border border-rule bg-transparent px-2 py-1" type="search" name="search" placeholder="Search" bind:value={q} oninput={() => (page = 0)} />
		{@render toggle?.()}
		<button class={button} onclick={download}>{q.trim() ? `Download ${v.hits.length.toLocaleString()} matching rows` : 'Download all rows'}</button>
		<button class={button} disabled={v.page === 0} onclick={() => (page = v.page - 1)}>Prev</button>
		<button class={button} disabled={v.page === v.last} onclick={() => (page = v.page + 1)}>Next</button>
	</div>
	{@render panel?.()}
	<!-- No overflow wrapper: one would become the sticky header's scroller and unfreeze it from the page. -->
	<table class="w-full text-sm tabular-nums">
		<thead>
			<tr>
				{#each shown as c}
					<th class="band sticky top-(--site-head) z-[5] cursor-pointer bg-ground px-3 py-1 text-left whitespace-nowrap select-none" onclick={() => ((sort = nextSort(sort, c)), (page = 0))}>{c} {sortArrow(sort, c)}</th>
				{/each}
			</tr>
			{#if v.hits.length}
				<tr class="bg-ink/5 font-bold whitespace-nowrap" data-sigma>
					{#each shown as c, i}
						<th class="border-b border-rule px-3 py-1 text-left">
							{#if i === 0}<span class="text-(--accent)">Σ</span> {v.hits.length.toLocaleString()} rows
							{:else if sums[c] != null}<span class="text-(--accent)">Σ</span> {sigma(sums[c])}{/if}
						</th>
					{/each}
				</tr>
			{/if}
		</thead>
			<tbody>
				{#each v.rows as r}
					<tr>
						{#each shown as c}
							<td class="border-b border-rule px-3 py-1 text-left whitespace-nowrap">{money.includes(c) ? price(r[c], r.currency) : show(r[c])}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
	</table>
</section>

<style>
	/* Full-bleed: the frozen row's ground runs to both window edges, so nothing scrolls past its sides. */
	.band {
		border-image: linear-gradient(var(--color-ground) 0 0) fill 0 / 0 / 0 100vmax;
		box-shadow: inset 0 -1px var(--color-rule);
	}
</style>
