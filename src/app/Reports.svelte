<script lang="ts">
	import type { Ops } from '../plugin/api';
	import { reports } from '../reports';
	import DataTable from './DataTable.svelte';

	let { ops, slug }: { ops?: Ops; slug?: string } = $props();
	const report = $derived(reports.find((r) => r.slug === slug));
	const rows = $derived(ops && report ? ops.query(report.sql) : []);
</script>

{#if report}
	<a href="#/reports" class="text-sm text-muted hover:text-(--accent)">‹ All reports</a>
	<h1 class="mt-2 font-display text-3xl text-(--accent)">{report.title}</h1>
	<p class="mb-6 text-muted">{report.description}</p>
	{#if ops}<DataTable {rows} columns={Object.keys(rows[0] ?? {})} name={report.title} />{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
{:else}
	<h1 class="mb-6 font-display text-3xl text-(--accent)">Reports</h1>
	<div class="grid gap-4 sm:grid-cols-2">
		{#each reports as r (r.slug)}
			<a href="#/reports/{r.slug}" class="rounded-2xl border border-rule p-6 transition hover:-translate-y-0.5 hover:border-(--accent) hover:bg-(--accent)/10" data-report={r.slug}>
				<h2 class="font-display text-2xl text-(--accent)">{r.title}</h2>
				<p class="mt-1 text-muted">{r.description}</p>
				{#if ops}<p class="mt-4 text-sm">{(ops.query(`SELECT count(*) AS n FROM (${r.sql})`)[0].n as number).toLocaleString()} rows</p>{/if}
			</a>
		{/each}
	</div>
{/if}
