<!--
  One query result as the admin spreadsheet: search, sort, column picker,
  Comfort/Fit/Full, row selection, copy/export, Σ row, pager. Column choice and
  page ride in the hash after `?`, so Copy link sends this exact view.
-->
<script lang="ts">
import "./table/adminTable.css";
import { SvelteSet } from "svelte/reactivity";
import AdminDataTable from "./table/AdminDataTable.svelte";
import AdminPager from "./table/AdminPager.svelte";
import ColumnPicker from "./table/ColumnPicker.svelte";
import JsonPeek from "./table/JsonPeek.svelte";
import TableToolbar from "./table/TableToolbar.svelte";
import { hiddenFromParams, hiddenToParams, visibleColumns } from "./table/columnPrefs";
import { type SortState, sortRows } from "./table/sortRows";

type Row = Record<string, unknown>;

let { rows, columns, name }: { rows: Row[]; columns: string[]; name: string } = $props();

let hash = $state(location.hash);
$effect(() => {
	const sync = () => (hash = location.hash);
	addEventListener("hashchange", sync);
	return () => removeEventListener("hashchange", sync);
});
const route = $derived(hash.split("?")[0] || "#");
const params = $derived(new URLSearchParams(hash.split("?")[1] ?? ""));
const hrefWith = (edit: (p: URLSearchParams) => void) => {
	const p = new URLSearchParams(params);
	edit(p);
	const q = p.toString();
	return q ? `${route}?${q}` : route;
};
function setParams(edit: (p: URLSearchParams) => void) {
	history.replaceState(history.state, "", hrefWith(edit));
	hash = location.hash;
}

let filter = $state("");
let sort = $state<SortState>({ col: "", asc: true });

const hidden = $derived(hiddenFromParams(params, columns));
const cols = $derived(visibleColumns(columns, hidden));

const matched = $derived.by(() => {
	const q = filter.trim().toLowerCase();
	const hit = !q
		? rows
		: rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
	return sortRows(hit, sort);
});

const pageSize = $derived(Math.max(1, Number(params.get("size")) || 200));
const pageIndex = $derived(Math.max(0, Number(params.get("page")) || 0));
const rowOffset = $derived(pageIndex * pageSize);
const shown = $derived(matched.slice(rowOffset, rowOffset + pageSize));

const pageHref = (n: number) => hrefWith((p) => (n <= 0 ? p.delete("page") : p.set("page", String(n))));

// Page 3 of the table is not page 3 of the matches.
function onFilter(v: string) {
	filter = v;
	if (pageIndex) setParams((p) => p.delete("page"));
}

const totals = $derived.by(() => {
	const out: Record<string, string> = {};
	for (const c of cols) {
		const vals = matched.map((r) => r[c]);
		if (vals.length && vals.every((v) => typeof v === "number"))
			out[c] = (vals as number[]).reduce((a, b) => a + b, 0).toLocaleString();
	}
	return out;
});

const countLine = $derived(
	filter.trim()
		? `${matched.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`
		: `${rows.length.toLocaleString()} rows`,
);

const fmt = (v: unknown): string => {
	if (v === null || v === undefined) return "—";
	if (v instanceof Uint8Array) return `<${v.byteLength}B blob>`;
	return typeof v === "number" ? v.toLocaleString() : String(v);
};

// Query rows carry no primary key, so identity is the row object itself.
const ids = new WeakMap<Row, string>();
let nextId = 0;
const rowKey = (r: Row) => {
	let k = ids.get(r);
	if (!k) ids.set(r, (k = String(nextId++)));
	return k;
};

let peek = $state<{ col: string; pk: string; text?: string } | null>(null);
function peekCell(col: string, row: Row) {
	const v = fmt(row[col]);
	if (v !== "" && v !== "—") peek = { col, pk: rowKey(row), text: v };
}

// Held by key: `matched` is rebuilt on every sort, filter and page turn.
const ticked = new SvelteSet<string>();
$effect(() => {
	rows;
	ticked.clear();
});
const allTicked = $derived(matched.length > 0 && matched.every((r) => ticked.has(rowKey(r))));
const tickedRows = $derived(matched.filter((r) => ticked.has(rowKey(r))));
function tick(r: Row) {
	const k = rowKey(r);
	if (!ticked.delete(k)) ticked.add(k);
}
function tickAll() {
	if (allTicked) ticked.clear();
	else for (const r of matched) ticked.add(rowKey(r));
}
</script>

<section class="dt" data-table={name}>
	<div class="dt-head">
		<input
			class="dt-search"
			type="search"
			value={filter}
			placeholder="Search any column"
			oninput={(e) => onFilter(e.currentTarget.value)}
		/>
		<ColumnPicker {columns} {hidden} onchange={(next) => setParams((p) => hiddenToParams(p, next, columns))} />
		<span class="dt-meta">{countLine}</span>
	</div>

	<TableToolbar columns={cols} filteredRows={matched} selectedRows={tickedRows} tableName={name} />

	<AdminDataTable
		columns={cols}
		rows={shown}
		{rowKey}
		{sort}
		onSort={(next) => (sort = next)}
		frozen={1}
		rowNumberOffset={rowOffset}
		{totals}
		totalLabel={matched.length.toLocaleString()}
		onPeek={peekCell}
		render={(c, r) => fmt(r[c])}
		cellTitle={(c, r) => fmt(r[c])}
		rowClass={(r) => (ticked.has(rowKey(r)) ? "row-selected" : "")}
		prefsKey={name}
	>
		{#snippet lead(row)}
			{#if row === null}
				<input
					type="checkbox"
					checked={allTicked}
					indeterminate={!allTicked && ticked.size > 0}
					onchange={tickAll}
					aria-label="Select all matching rows"
				/>
			{:else}
				<input type="checkbox" checked={ticked.has(rowKey(row))} onchange={() => tick(row)} aria-label="Select row" />
			{/if}
		{/snippet}
	</AdminDataTable>

	<AdminPager
		page={pageIndex}
		{pageSize}
		rowsOnPage={shown.length}
		total={matched.length}
		hasMore={rowOffset + shown.length < matched.length}
		href={pageHref}
		onPageSize={(size) => setParams((p) => (p.set("size", String(size)), p.delete("page")))}
	/>
</section>

<JsonPeek endpoint="" open={peek} onclose={() => (peek = null)} />

<style>
.dt { margin-bottom: 2rem; }
.dt-head { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.dt-search { flex: 1; padding: 0.3rem 0.6rem; border: 1px solid #3a3a3a; border-radius: 6px; background: transparent; color: inherit; }
.dt-meta { color: #8f8a76; font-size: 0.8rem; }
</style>
