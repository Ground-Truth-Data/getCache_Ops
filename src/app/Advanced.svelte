<script lang="ts">
	import type { Ops } from '../plugin/api';
	import DataTable from './DataTable.svelte';

	let { ops }: { ops: Ops } = $props();
	let open = $state(false);
	let picked = $state('');
	const names = $derived(
		ops
			.query("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name NOT LIKE '%View', name")
			.map((r) => r.name as string),
	);
	const name = $derived(
		names.includes(picked) ? picked : (names.find((n) => n.endsWith('View') && ops.query(`SELECT 1 FROM "${n}" LIMIT 1`).length) ?? names[0]),
	);
	const schema = $derived(
		ops.query(
			`SELECT name AS "Column", type AS "Type", iif("notnull", 'yes', '') AS "Required", iif(pk, 'yes', '') AS "Key" FROM pragma_table_info(?)`,
			[name],
		),
	);
	const rows = $derived(open ? ops.query(`SELECT * FROM "${name.replaceAll('"', '""')}"`) : []);
</script>

<p class="mb-4 rounded-xl border border-red-400/60 p-4 text-red-300" data-warning>Raw tables change between versions. Reports are the stable way to build.</p>
<details class="rounded-xl border border-rule p-4" bind:open>
	<summary class="cursor-pointer font-display text-xl text-muted">Raw tables and schema</summary>
	{#if open}
		<select name="table" class="my-4 rounded-lg border border-rule bg-ground px-2 py-1" value={name} onchange={(e) => (picked = e.currentTarget.value)}>
			{#each names as n (n)}<option>{n}</option>{/each}
		</select>
		{#key name}
			<DataTable {rows} columns={schema.map((c) => c.Column as string)} {name} />
			<h3 class="mt-8 mb-2 font-display text-xl text-heading">{name} columns</h3>
			<DataTable rows={schema} columns={['Column', 'Type', 'Required', 'Key']} name="{name} columns" />
		{/key}
	{/if}
</details>
