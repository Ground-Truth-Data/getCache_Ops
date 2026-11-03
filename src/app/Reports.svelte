<script lang="ts">
	import type { Ops } from '../plugin/api';
	import { reports, seasonReports } from '../reports';
	import Pill from '../../_rapper/rt/admin/Pill.svelte';
	import Filters from './Filters.svelte';
	import { charts } from './charts';

	let { ops, page, slug }: { ops?: Ops; page: string; slug?: string } = $props();
	const seasonal = $derived(page === 'reports');
	const list = $derived<typeof reports>(seasonal ? seasonReports : reports);
	const report = $derived(list.find((r) => r.slug === slug) ?? list[0]);
	let season = $state(true);
	// The season is the newest planted date's calendar year, as the app's inbox counts it.
	const from = $derived(season && ops ? `${ops.query('SELECT substr(max(plantedDt), 1, 4) AS y FROM bagUpView')[0]?.y}-01-01` : '');
	const rows = $derived(ops ? ops.query(report.sql, seasonal ? [from] : undefined) : []);
</script>

<nav class="flex flex-wrap gap-2" data-picker>
	{#each list as r (r.slug)}
		<Pill href="#/{page}/{r.slug}" active={r === report}>{r.title}</Pill>
	{/each}
</nav>
<h1 class="mt-6 font-display text-3xl text-(--accent)">{report.title}</h1>
<p class="mb-6 text-muted">{report.description}</p>
{#if ops}
	{#key report}
		<Filters
			{rows}
			columns={Object.keys(rows[0] ?? {})}
			name={report.title}
			money={report.money}
			noSum={report.noSum}
			chart={charts[report.slug]}
			season={seasonal ? season : undefined}
			onseason={(on) => (season = on)}
		/>
	{/key}
{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
