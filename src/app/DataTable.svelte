<!--
  One query result as the admin spreadsheet: search, sort, column picker,
  Comfort/Fit/Full, row selection, copy/export, Σ row, pager. Column choice and
  page ride in the address's query, keyed by `name` because one page can hold
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
import { MONEY_NAME, RATE_NAME, amount, byCurrency, mark } from "./money";
import { TREE, TREE_NAME } from "./trees";
import { go, route } from "./route.svelte";
import type { Snippet } from "svelte";

type Row = Record<string, unknown>;

// A unit is said once, in the header; cells are plain numbers. `money` columns split the rows by currency, one
// table each, so `currency` leaves the screen. `noSum` columns are rates: a Σ of per-tree prices means nothing.
let { rows, columns, name, money = [], noSum = [], toggle, panel }: { rows: Row[]; columns: string[]; name: string; money?: string[]; noSum?: string[]; toggle?: Snippet; panel?: Snippet } = $props();
const onScreen = $derived(money.length ? columns.filter((c) => c !== "currency") : columns);
const cur = $derived(columns.find((c) => c.toLowerCase() === "currency") ?? "currency");
const cash = $derived(money.length ? money : columns.some((c) => c === cur) ? columns.filter((c) => c !== cur && MONEY_NAME.test(c)) : []);

const path = $derived(route.path.split("?")[0] || ".");
const all = $derived([...new URLSearchParams(route.path.split("?")[1] ?? "")]);
const mine = (k: string) => k.startsWith(`${name}.`);
const params = $derived(new URLSearchParams(all.filter(([k]) => mine(k)).map(([k, v]) => [k.slice(name.length + 1), v])));
const hrefWith = (edit: (p: URLSearchParams) => void) => {
	const own = new URLSearchParams(params);
	edit(own);
	const p = new URLSearchParams(all.filter(([k]) => !mine(k)));
	for (const [k, v] of own) p.append(`${name}.${k}`, v);
	const q = p.toString();
	return q ? `${path}?${q}` : path;
};
function setParams(edit: (p: URLSearchParams) => void) {
	go(hrefWith(edit), true);
}

let filter = $state("");
let sort = $state<SortState>({ col: "", asc: true });

const hidden = $derived(hiddenFromParams(params, onScreen));
const cols = $derived(visibleColumns(onScreen, hidden));
const codes = $derived(cash.length ? byCurrency(rows, cur).map(([c]) => c) : []);
const exportCols = $derived(codes.length > 1 ? [...cols, cur] : cols);

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

const groups = $derived(cash.length ? byCurrency(shown, cur) : [["", shown] as [string, Row[]]]);
const inGroup = (code: string) => (cash.length ? matched.filter((r) => String(r[cur] ?? "") === code) : matched);
const totals = (these: Row[]) => {
	const out: Record<string, string> = {};
	for (const c of cols) {
		if (noSum.includes(c) || (cash.includes(c) && RATE_NAME.test(c))) continue;
		const vals = these.map((r) => r[c]);
		if (!vals.length || !vals.some((v) => typeof v === "number") || !vals.every((v) => v == null || typeof v === "number")) continue;
		const sum = (vals as number[]).reduce((a, b) => a + (b ?? 0), 0);
		out[c] = cash.includes(c) ? amount(sum) : sum.toLocaleString();
	}
	return out;
};
const isTrees = (c: string) => TREE_NAME.test(c) && rows.some((r) => typeof r[c] === "number");
const label = (code: string) => (c: string) => (cash.includes(c) && code ? `${c} (${mark(code)})` : isTrees(c) ? `${c} ${TREE}` : c);
// The pine is Ops' font, so a sheet says "trees"; a currency stays in the header only while there is one.
const exportLabel = (c: string) => (cash.includes(c) && codes.length === 1 ? `${c} (${mark(codes[0])})` : c);
const exported = (rs: Row[]) => rs.map((r) => Object.fromEntries(exportCols.map((c) => [exportLabel(c), r[c]])));
const cellText = (c: string, r: Row) => (cash.includes(c) ? amount(r[c], RATE_NAME.test(c)) : fmt(r[c]));

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

	<TableToolbar columns={exportCols.map(exportLabel)} filteredRows={exported(matched)} selectedRows={exported(tickedRows)} tableName={name} />

	{#each groups as [code, these] (code)}
	<AdminDataTable
		columns={cols}
		label={label(code)}
		rows={these}
		{rowKey}
		{sort}
		onSort={(next) => (sort = next)}
		frozen={1}
		rowNumberOffset={groups.length === 1 ? rowOffset : undefined}
		totals={totals(inGroup(code))}
		totalLabel={inGroup(code).length.toLocaleString()}
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
	{/each}

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
.dt-search { flex: 1; padding: 0.3rem 0.6rem; border: 1px solid #3a3a3a; border-radius: 6px; background: var(--color-field); color: inherit; }
.dt-search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); }
.dt-meta { color: #8f8a76; font-size: 0.8rem; }
</style>
