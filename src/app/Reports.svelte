<script lang="ts">
	import type { Ops } from '../plugin/api';
	import { reports } from '../reports';
	import DataTable from './DataTable.svelte';

	let { ops, slug }: { ops: Ops; slug?: string } = $props();
	const report = $derived(reports.find((r) => r.slug === slug));
	const rows = $derived(report ? ops.query(report.sql) : []);
</script>

{#if report}
	<a href="#/reports" class="text-sm text-muted hover:text-(--accent)">‹ All reports</a>
	<h2 class="mt-2 font-display text-3xl text-(--accent)">{report.title}</h2>
	<p class="mb-6 text-muted">{report.description}</p>
	<DataTable {rows} columns={Object.keys(rows[0] ?? {})} name={report.title} />
{:else}
	<div class="grid gap-4 sm:grid-cols-2">
		{#each reports as r (r.slug)}
			<a href="#/reports/{r.slug}" class="rounded-2xl border border-rule p-6 transition hover:border-(--accent)" data-report={r.slug}>
				<h2 class="font-display text-2xl text-(--accent)">{r.title}</h2>
				<p class="mt-1 text-muted">{r.description}</p>
				<p class="mt-4 text-sm">{(ops.query(`SELECT count(*) AS n FROM (${r.sql})`)[0].n as number).toLocaleString()} rows</p>
			</a>
		{/each}
	</div>
{/if}
