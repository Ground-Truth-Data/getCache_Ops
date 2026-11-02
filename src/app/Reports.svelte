<script lang="ts">
	import type { Ops } from '../plugin/api';
	import { reports } from '../reports';
	import Pill from '../../_rapper/rt/admin/Pill.svelte';
	import Filters from './Filters.svelte';

	let { ops, slug }: { ops?: Ops; slug?: string } = $props();
	const report = $derived(reports.find((r) => r.slug === slug) ?? reports[0]);
	const rows = $derived(ops ? ops.query(report.sql) : []);
</script>

<nav class="flex flex-wrap gap-2" data-picker>
	{#each reports as r (r.slug)}
		<Pill href="#/reports/{r.slug}" active={r === report}>{r.title}</Pill>
	{/each}
</nav>
<h1 class="mt-6 font-display text-3xl text-(--accent)">{report.title}</h1>
<p class="mb-6 text-muted">{report.description}</p>
{#if ops}
	{#key report}
		<Filters {rows} columns={Object.keys(rows[0] ?? {})} name={report.title} money={report.money} noSum={report.noSum} />
	{/key}
{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
