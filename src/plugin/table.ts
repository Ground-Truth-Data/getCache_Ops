import { mount } from 'svelte';
import DataTable from '../app/DataTable.svelte';

/** Query rows as a DataTable: sortable, searchable, paged, downloadable. */
export function table(title: string, rows: Record<string, unknown>[]): HTMLElement {
	const el = document.createElement('div');
	mount(DataTable, { target: el, props: { rows, columns: Object.keys(rows[0] ?? {}), name: title } });
	return el;
}
