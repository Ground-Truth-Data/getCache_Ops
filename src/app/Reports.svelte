<script lang="ts">
	import type { Ops } from '../plugin/api';
	import { reports } from '../reports';
	import Filters from './Filters.svelte';

	let { ops, slug }: { ops?: Ops; slug?: string } = $props();
	const report = $derived(reports.find((r) => r.slug === slug) ?? reports[0]);
	const rows = $derived(ops ? ops.query(report.sql) : []);
</script>

<nav class="flex flex-wrap gap-2" data-picker>
	{#each reports as r (r.slug)}
		<a
			href="#/reports/{r.slug}"
			class="rounded-full border px-4 py-1 font-display {r === report ? 'fancy' :'border-rule text-muted hover:border-(--accent) hover:bg-(--accent)/15 hover:text-ink'}"
			>{r.title}</a
		>
	{/each}
</nav>
<h1 class="mt-6 font-display text-3xl text-(--accent)">{report.title}</h1>
<p class="mb-6 text-muted">{report.description}</p>
{#if ops}
	{#key report}
		<Filters {rows} columns={Object.keys(rows[0] ?? {})} name={report.title} money={report.money} noSum={report.noSum} />
	{/key}
{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
