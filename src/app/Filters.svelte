<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import DataTable from './DataTable.svelte';
	import { apply, facets, type Filter } from './filters';

	let { rows, chart, ...table }: Omit<ComponentProps<typeof DataTable>, 'toggle' | 'panel'> & { chart?: (rows: Record<string, unknown>[], el: HTMLElement) => Element } =
		$props();
	const { dateCol, sorts, picks } = $derived(facets(rows));
	// Newest first is the one default; any other report keeps its SQL's order (the 704 sheet's, for quality).
	const fresh = (): Filter => ({ sort: facets(rows).sorts.find(([c]) => c === 'date')?.[0], pick: {}, season: true });
	let f = $state(fresh());
	let custom = $state(false);
	let open = $state(false);
	const shown = $derived(apply(rows, f, dateCol));
	const seg = (on: boolean) => `rounded-full px-3 py-0.5 ${on ? 'rt-fancy-btn' :'text-muted hover:bg-(--accent)/15 hover:text-ink'}`;
	const head = 'w-24 text-xs tracking-widest text-muted';

	function chip(days?: number) {
		custom = !days;
		f = { ...f, days, from: undefined, to: undefined };
	}
</script>

{#snippet toggle()}
	<button
		class="rt-fancy-btn rounded-lg p-2"
		title="Filters"
		aria-label="Filters"
		aria-expanded={open}
		onclick={() => (open = !open)}
		data-filter-toggle
	>
		<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
	</button>
{/snippet}

{#snippet panel()}
	{#if open}
		<div class="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-(--accent) p-4" data-filters>
			<div class="flex items-center justify-between">
				<span class="text-xs tracking-widest text-(--accent)">FILTERS</span>
				<button class="text-sm text-muted underline hover:text-(--accent)" onclick={() => ((f = fresh()), (custom = false))}>reset</button>
			</div>
			{#if sorts.length > 1}
				<div class="flex items-center gap-3">
					<span class={head}>SORT</span>
					<div class="inline-flex rounded-full border border-rule p-0.5" data-sort>
						{#each sorts as [c, label] (c)}<button class={seg(f.sort === c)} onclick={() => (f.sort = c)}>{label}</button>{/each}
					</div>
				</div>
			{/if}
			{#each picks as [c, values] (c)}
				<label class="flex items-center gap-3">
					<span class={head}>{c.toUpperCase()}</span>
					<select class="rounded-lg border border-rule bg-ground px-2 py-1 hover:border-(--accent)" value={f.pick[c] ?? ''} onchange={(e) => (f.pick[c] = e.currentTarget.value)} data-pick={c}>
						<option value="">all</option>
						{#each values as v (v)}<option>{v}</option>{/each}
					</select>
				</label>
			{/each}
			{#if dateCol}
				<div class="flex flex-wrap items-center gap-3">
					<span class={head}>{dateCol.toUpperCase()}</span>
					<div class="inline-flex rounded-full border border-rule p-0.5" data-days>
						<button class={seg(!!f.season)} onclick={() => (f.season = !f.season)} data-season>this season</button>
						{#each [1, 7, 30] as d (d)}<button class={seg(f.days === d)} onclick={() => chip(f.days === d ? undefined : d)}>{d} {d === 1 ? 'day' : 'days'}</button>{/each}
						<button class={seg(custom)} onclick={() => chip()}>custom</button>
					</div>
					{#if custom}
						<input type="date" class="rounded-lg border border-rule bg-ground px-2 py-1 hover:border-(--accent)" bind:value={f.from} aria-label="From" />
						<input type="date" class="rounded-lg border border-rule bg-ground px-2 py-1 hover:border-(--accent)" bind:value={f.to} aria-label="To" />
					{/if}
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#if chart && shown.length}
	<div class="mb-8" {@attach (el) => (el.append(chart(shown, el)), () => el.replaceChildren())} data-chart></div>
{/if}
<!-- A new filter starts the table over on page 1, whichever table is in. -->
{#key JSON.stringify(f)}<DataTable rows={shown} {...table} {toggle} {panel} />{/key}
