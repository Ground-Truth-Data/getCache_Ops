// A form's answers as they are read: the latest of each, a response's sections, and the spreadsheets.
import type { El } from '../../_rapper/gc/form';
import { keys, type Answers, type Definition, type Version } from './forms';

export type Column = ReturnType<typeof keys>[number];
export type Spot = { lat: number; lng: number; accuracy?: number };

/** The answers as they stand: a fix replaces the row it names; entries follow their answer's order. */
export function current(got: Answers): Answers {
	const fixed = new Set(got.answers.map((a) => a.replaces));
	const answers = got.answers.filter((a) => !fixed.has(a.id));
	const rowFixed = new Set(got.rows.map((x) => x.replaces));
	const at = new Map(answers.map((a, i) => [a.id, i]));
	const rows = got.rows.filter((x) => at.has(x.answer) && !rowFixed.has(x.id)).sort((x, y) => at.get(x.answer)! - at.get(y.answer)! || x.n - y.n);
	return { versions: got.versions, answers, rows };
}

/** Every version's keys joined by key, newest label wins; a key a version lacks reads blank. */
export function columns(versions: Version[]): Column[] {
	const cols = new Map<string, Column>();
	for (const v of versions) for (const k of keys(v.definition)) cols.set(`${k.group ?? ''}/${k.key}`, k);
	return [...cols.values()];
}

/** Where a response or an entry was filled: the first GPS question in its scope, as the phone stores it. */
export const where = (cols: Column[], group?: string) => cols.find((c) => c.type === 'gps' && c.group === group);
export const spot = (v: unknown) => (typeof (v as Spot)?.lat === 'number' ? (v as Spot) : undefined);

export function text(v: unknown): string {
	if (v == null) return '';
	if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? ((x as { name?: string }).name ?? '') : String(x))).join(', ');
	const g = spot(v);
	return g ? `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}` : String(v);
}

/** A version's questions as a response shows them: those outside any section first, then each section. */
export function sections(d: Definition): { title: string; elements: El[] }[] {
	const head = d.elements.filter((e) => e.type !== 'panel');
	const panels = d.elements.filter((e) => e.type === 'panel');
	return [
		...(head.length ? [{ title: 'Section 1', elements: head }] : []),
		...panels.map((p, i) => ({ title: p.title || `Section ${i + (head.length ? 2 : 1)}`, elements: (p.elements as El[]) ?? [] })),
	];
}

const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** responses.csv, one row per response, and <group>.csv per repeating group, one row per entry linked by
 *  response id. lat, lon and acc_m come from the first GPS question, only when some row answered it. */
export function sheets(got: Answers): Record<string, string> {
	const { versions, answers, rows } = current(got);
	const cols = columns(versions);
	const sheet = (group: string | undefined, lead: string[], tail: string[], items: { data: Record<string, unknown>; lead: string[]; tail: string[] }[]) => {
		const at = where(cols, group);
		const own = cols.filter((c) => c.group === group && c !== at && c.type !== 'paneldynamic');
		const spots = items.map((x) => spot(at && x.data[at.key]));
		const gps = spots.some(Boolean);
		const lines = [
			[...lead, ...own.map((c) => c.key), ...(gps ? ['lat', 'lon', 'acc_m'] : []), ...tail],
			...items.map((x, i) => [
				...x.lead,
				...own.map((c) => text(x.data[c.key])),
				...(gps ? [spots[i]?.lat, spots[i]?.lng, spots[i]?.accuracy].map((n) => (n == null ? '' : String(n))) : []),
				...x.tail,
			]),
		];
		return lines.map((l) => l.map(esc).join(',') + '\r\n').join('');
	};
	return {
		'responses.csv': sheet(undefined, ['id'], ['saved'], answers.map((a) => ({ data: a.data, lead: [a.id], tail: [a.filledAt] }))),
		...Object.fromEntries(
			cols
				.filter((c) => c.type === 'paneldynamic')
				.map((g) => [`${g.key}.csv`, sheet(g.key, ['response_id', 'n'], [], rows.filter((r) => r.groupKey === g.key).map((r) => ({ data: r.data, lead: [r.answer, String(r.n)], tail: [] })))]),
		),
	};
}

/** Each sheet as its own download. */
export function download(files: Record<string, string>) {
	for (const [name, body] of Object.entries(files)) {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
		a.download = name;
		a.click();
		URL.revokeObjectURL(a.href);
	}
}
