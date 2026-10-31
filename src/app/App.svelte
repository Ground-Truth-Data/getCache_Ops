<script lang="ts">
	import { describe, listTables, openDatabase, query } from '../data/db';

	// The file picker lands in Round 2; until then the bundled sample proves the load path.
	const tables = fetch('/sample.sqlite')
		.then((r) => r.arrayBuffer())
		.then(openDatabase)
		.then(() =>
			listTables().map((name) => ({
				name,
				rows: query(`SELECT count(*) AS n FROM "${name}"`)[0].n as number,
				columns: describe(name),
			})),
		);
</script>

<main class="mx-auto max-w-3xl p-6 font-sans">
	<h1 class="mb-4 text-2xl font-semibold">Get Cache Ops</h1>
	{#await tables}
		<p class="text-gray-500">Opening sample.sqlite…</p>
	{:then list}
		{#each list as t (t.name)}
			<section class="mb-4 rounded border border-gray-200 p-4" data-table={t.name}>
				<h2 class="font-medium">{t.name} <span class="text-gray-500">· {t.rows} rows</span></h2>
				<p class="text-sm text-gray-600">{t.columns.map((c) => `${c.name} ${c.type}`).join(' · ')}</p>
			</section>
		{/each}
	{:catch e}
		<p class="text-red-600" data-error>{e.message}</p>
	{/await}
</main>
