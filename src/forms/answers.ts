// A form's answers as they are read: the latest of each, a response's sections, and the spreadsheets.
import type { El } from '../../_rapper/gc/form';
import { keys, type Answers, type At, type Definition } from './forms';

/** How long ago, as the inbox writes it: 5m, 3h, 4d, 2w. */
export function ago(iso: string) {
	const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
	return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 20160 ? `${Math.round(m / 1440)}d` : `${Math.round(m / 10080)}w`;
}

/** The answers as they stand: a fix replaces the row it names; entries follow their answer's order. */
export function current(got: Answers): Answers {
	const fixed = new Set(got.answers.map((a) => a.replaces));
	const answers = got.answers.filter((a) => !fixed.has(a.id));
	const rowFixed = new Set(got.rows.map((x) => x.replaces));
	const at = new Map(answers.map((a, i) => [a.id, i]));
	const rows = got.rows.filter((x) => at.has(x.answer) && !rowFixed.has(x.id)).sort((x, y) => at.get(x.answer)! - at.get(y.answer)! || x.n - y.n);
	return { definition: got.definition, answers, rows };
}

export function text(v: unknown): string {
	if (v == null) return '';
	if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? ((x as { name?: string }).name ?? '') : String(x))).join(', ');
	return String(v);
}

/** A form's questions as a response shows them: those outside any section first, then each section. */
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
 *  response id. lat, lon and acc_m are where each was saved or added, only when some row has a fix. */
export function sheets(got: Answers): Record<string, string> {
	const { definition, answers, rows } = current(got);
	const cols = keys(definition);
	const sheet = (group: string | undefined, lead: string[], tail: string[], items: (At & { data: Record<string, unknown>; lead: string[]; tail: string[] })[]) => {
		const own = cols.filter((c) => c.group === group && c.type !== 'paneldynamic');
		const gps = items.some((x) => x.lat != null);
		const lines = [
			[...lead, ...own.map((c) => c.key), ...(gps ? ['lat', 'lon', 'acc_m'] : []), ...tail],
			...items.map((x) => [
				...x.lead,
				...own.map((c) => text(x.data[c.key])),
				...(gps ? [x.lat, x.lng, x.accuracyM].map((n) => (n == null ? '' : String(n))) : []),
				...x.tail,
			]),
		];
		return lines.map((l) => l.map(esc).join(',') + '\r\n').join('');
	};
	return {
		'responses.csv': sheet(undefined, ['id'], ['saved'], answers.map((a) => ({ ...a, lead: [a.id], tail: [a.filledAt] }))),
		...Object.fromEntries(
			cols
				.filter((c) => c.type === 'paneldynamic')
				.map((g) => [`${g.key}.csv`, sheet(g.key, ['response_id', 'n'], [], rows.filter((r) => r.groupKey === g.key).map((r) => ({ ...r, lead: [r.answer, String(r.n)], tail: [] })))]),
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
