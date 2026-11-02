<!--
  One query result as the admin spreadsheet: search, sort, column picker,
  Comfort/Fit/Full, row selection, copy/export, Σ row, pager. Column choice and
  page ride in the hash after `?`, keyed by `name` because one page can hold
  two tables, so Copy link sends this exact view.
-->
<script lang="ts">
import { SvelteSet } from "svelte/reactivity";
import AdminDataTable from "../../_rapper/rt/admin/AdminDataTable.svelte";
import AdminPager from "../../_rapper/rt/admin/AdminPager.svelte";
import ColumnPicker from "../../_rapper/rt/admin/ColumnPicker.svelte";
import JsonPeek from "../../_rapper/rt/admin/JsonPeek.svelte";
import TableToolbar from "../../_rapper/rt/admin/TableToolbar.svelte";
import { hiddenFromParams, hiddenToParams, visibleColumns } from "../../_rapper/rt/admin/columnPrefs";
import { type SortState, sortRows } from "../../_rapper/rt/admin/sortRows";
import { moneyIn } from "./money";
import type { Snippet } from "svelte";

type Row = Record<string, unknown>;

// `money` columns show in each row's own currency, so `currency` leaves the screen but stays in exports.
// `noSum` columns are rates: a Σ of per-tree prices means nothing.
let { rows, columns, name, money = [], noSum = [], toggle, panel }: { rows: Row[]; columns: string[]; name: string; money?: string[]; noSum?: string[]; toggle?: Snippet; panel?: Snippet } = $props();
const onScreen = $derived(money.length ? columns.filter((c) => c !== "currency") : columns);
const price = $derived(moneyIn(rows));

let hash = $state(location.hash);
$effect(() => {
	const sync = () => (hash = location.hash);
	addEventListener("hashchange", sync);
	return () => removeEventListener("hashchange", sync);
});
const route = $derived(hash.split("?")[0] || "#");
const all = $derived([...new URLSearchParams(hash.split("?")[1] ?? "")]);
const mine = (k: string) => k.startsWith(`${name}.`);
const params = $derived(new URLSearchParams(all.filter(([k]) => mine(k)).map(([k, v]) => [k.slice(name.length + 1), v])));
const hrefWith = (edit: (p: URLSearchParams) => void) => {
	const own = new URLSearchParams(params);
	edit(own);
	const p = new URLSearchParams(all.filter(([k]) => !mine(k)));
	for (const [k, v] of own) p.append(`${name}.${k}`, v);
	const q = p.toString();
	return q ? `${route}?${q}` : route;
};
function setParams(edit: (p: URLSearchParams) => void) {
	history.replaceState(history.state, "", hrefWith(edit));
	hash = location.hash;
}

let filter = $state("");
let sort = $state<SortState>({ col: "", asc: true });

const hidden = $derived(hiddenFromParams(params, onScreen));
const cols = $derived(visibleColumns(onScreen, hidden));
const exportCols = $derived(onScreen === columns ? cols : [...cols, "currency"]);

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

// Page 3 of the table is not page 3 of the matches. Filters remounts the table on every change, and the page lives in the hash, so a mount under a panel starts on page 1.
// svelte-ignore state_referenced_locally
if (panel && pageIndex) setParams((p) => p.delete("page"));
function onFilter(v: string) {
	filter = v;
	if (pageIndex) setParams((p) => p.delete("page"));
}

const totals = $derived.by(() => {
	const out: Record<string, string> = {};
	for (const c of cols) {
		if (noSum.includes(c)) continue;
		const vals = matched.map((r) => r[c]);
		if (!vals.length || !vals.some((v) => typeof v === "number") || !vals.every((v) => v == null || typeof v === "number")) continue;
		const sum = (vals as number[]).reduce((a, b) => a + (b ?? 0), 0);
		if (!money.includes(c)) out[c] = sum.toLocaleString();
		else {
			// Dollars and euros don't add up, so a mixed-currency column gets no Σ.
			const codes = new Set(matched.map((r) => r.currency));
			if (codes.size === 1) out[c] = price(sum, [...codes][0]);
		}
	}
	return out;
});
const cellText = (c: string, r: Row) => (money.includes(c) ? price(r[c], r.currency) : fmt(r[c]));

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
		{@render toggle?.()}
		<ColumnPicker columns={onScreen} {hidden} onchange={(next) => setParams((p) => hiddenToParams(p, next, onScreen))} />
		<span class="dt-meta">{countLine}</span>
	</div>
	{@render panel?.()}

	<TableToolbar columns={exportCols} filteredRows={matched} selectedRows={tickedRows} tableName={name} />

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
		pinSum
		onPeek={peekCell}
		render={cellText}
		cellTitle={cellText}
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
