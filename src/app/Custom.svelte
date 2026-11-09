<script lang="ts">
	import type { Ops } from '../data/db';
	import DataTable from './DataTable.svelte';

	let { ops }: { ops: Ops } = $props();
	let picked = $state('');
	const names = $derived(
		ops
			.query("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name NOT LIKE '%View', name")
			.map((r) => r.name as string),
	);
	const name = $derived(
		names.includes(picked) ? picked : (names.find((n) => n.endsWith('View') && ops.query(`SELECT 1 FROM "${n}" LIMIT 1`).length) ?? names[0]),
	);
	const columns = $derived(ops.query('SELECT name FROM pragma_table_info(?)', [name]).map((c) => c.name as string).filter((c) => !/(Key|Id)$|^id$/.test(c)));
	const rows = $derived(ops.query(`SELECT * FROM "${name.replaceAll('"', '""')}"`));
</script>

<select name="table" class="mb-4 rounded-lg border border-rule bg-field px-2 py-1" value={name} onchange={(e) => (picked = e.currentTarget.value)}>
	{#each names as n (n)}<option>{n}</option>{/each}
</select>
{#key name}
	<DataTable {rows} {columns} {name} />
{/key}
