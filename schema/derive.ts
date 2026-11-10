// Every live `*View` row, computed from the log alone. Pure and dependency-free, so the phone, superCrud (Deno)
// and Ops run the same rule; the phone's src imports it, the edge function cannot import src.

export type Row = Record<string, unknown>;
/** Every row of one log table. `purgatoryTable` must come in the order its reviews were made. */
export type ReadTable = (table: string) => Row[] | Promise<Row[]>;

export const VERSION_KEYS = {
	mapTable: "mapKey",
	mapFeatureTable: "mapFeatureKey",
	qaSurveyTable: "qaSurveyKey",
	qaPlotTable: "qaPlotKey",
	blockTable: "blockKey",
	boxTable: "boxKey",
	bagTable: "bagKey",
	bagUpTable: "bagUpKey",
	tallyTable: "tallyKey",
	packageTable: "packageKey",
	personTable: "personKey",
} as const;

export const ROWS_LIVE = ["crewTable", "orgKindTable", "orgTagTable", "orgNameTable", "stockTable", "deliveryTable", "allocationTable"] as const;

/** The columns naming one thing, whose newest head is its only live row. A
 *  table missing here keeps every head live: each row is its own thing. */
const THING: Partial<Record<string, readonly string[]>> = {
	...Object.fromEntries(Object.entries(VERSION_KEYS).map(([t, k]) => [t, [k]])),
	orgNameTable: ["orgKey"],
	// After an import two phones' counts can both be live: the newest said wins.
	stockTable: ["mapFeatureKey", "boxKey"],
	deliveryTable: ["mapFeatureKey", "boxKey"],
	// A plan is saved whole, every line stamped alike: the newest save per block wins.
	allocationTable: ["blockKey"],
};
export const WHOLE_SAVES = new Set(["allocationTable"]);
export const thingOf = (table: string): readonly string[] => THING[table] ?? [];

export const STAMPS = new Set(["versionKey", "createdAt", "replacedAt", "replacesKey"]);
// Who made a version, not a cell of it: a different editor with nothing changed writes nothing.
export const NOT_A_CHANGE = new Set(["editedByKey"]);
/** A version that merged concurrent heads: the heads it carried lost nothing. */
export const MERGE_PREFIX = "merge-";
/** A merge that is a decision: an accept, made by a person at that moment. Its own key, so it never shares one
 *  with a pure merge of the same heads, and it weighs as an edit. */
export const ACCEPT_PREFIX = `${MERGE_PREFIX}accept-`;

const byTime = (a: Row, b: Row) => (String(a.createdAt) < String(b.createdAt) || (a.createdAt === b.createdAt && String(a.versionKey) < String(b.versionKey)) ? -1 : 1);

/** Concurrent heads of one thing as one row: a cell only one head changed since their common ancestor keeps
 *  that change, a cell several changed keeps the newest's. `versions` is every version of the thing. An
 *  `accepted` head counts as the newest. Null when there is nothing to merge: one head, no common ancestor, or
 *  the newest head already holds every change. The row carries the newest head's stamps. */
export function mergeOf(heads: readonly Row[], versions: ReadonlyMap<string, Row>, accepted?: string): Row | null {
	const sorted = [...heads].sort(byTime);
	if (sorted.length < 2) return null;
	const ordered = [...sorted.filter((h) => h.versionKey !== accepted), ...sorted.filter((h) => h.versionKey === accepted)];
	const line = (v: string) => {
		const out: string[] = [];
		for (let at: string | null | undefined = v; at && !out.includes(at); at = versions.get(at)?.replacesKey as string | null) out.push(at);
		return out;
	};
	// A pure merge is weighed as the edit it replaced: its stamp is when it was merged, not when its cells were
	// written. An accept is a decision made then, and weighs as itself.
	const editUnder = (v: string): string => {
		const parent = versions.get(String(versions.get(v)?.replacesKey));
		return parent && v.startsWith(MERGE_PREFIX) && !v.startsWith(ACCEPT_PREFIX) ? editUnder(String(parent.versionKey)) : v;
	};
	const edits = [...new Set(ordered.map((h) => editUnder(String(h.versionKey))))]
		.map((v) => versions.get(v)!)
		.sort((a, b) => Number(a.versionKey === accepted) - Number(b.versionKey === accepted) || byTime(a, b));
	const [first, ...rest] = edits.map((h) => line(String(h.versionKey)));
	const base = first!.find((v) => rest.every((l) => l.includes(v)));
	if (!base) return null;
	const ancestor = versions.get(base)!;
	const newest = ordered.at(-1)!;
	const merged: Row = { ...newest };
	for (const c of Object.keys(newest)) {
		if (STAMPS.has(c) || NOT_A_CHANGE.has(c)) continue;
		const changed = edits.filter((h) => h[c] !== ancestor[c]);
		if (changed.length) merged[c] = changed.at(-1)![c];
	}
	return newest === sorted.at(-1) && Object.keys(merged).every((c) => merged[c] === newest[c]) ? null : merged;
}

/** Held versions whose newest review does not accept them: they stand for nothing. */
export function unstanding(reviews: readonly Row[]): Set<string> {
	const last = new Map<string, unknown>();
	for (const r of reviews) last.set(String(r.versionKey), r.decision);
	return new Set([...last].flatMap(([k, d]) => (d === "accepted" ? [] : [k])));
}

/** One table's live rows: per thing, its newest head, merged with the other heads, unless it ends the thing. */
export function liveOf(table: string, rows: readonly Row[], held: ReadonlySet<string>): Row[] {
	const replaced = new Set(rows.flatMap((r) => (held.has(String(r.versionKey)) ? [] : [String(r.replacesKey)])));
	const heads = rows.filter((r) => r.replacedAt === "" && !held.has(String(r.versionKey)) && !replaced.has(String(r.versionKey)));
	const thing = thingOf(table);
	if (!thing.length) return heads.filter((h) => !h.isDeleted);
	const of = (r: Row) => JSON.stringify(thing.map((c) => r[c] ?? null));
	const things = new Map<string, Row[]>();
	for (const h of heads) things.set(of(h), [...(things.get(of(h)) ?? []), h]);
	const out: Row[] = [];
	if (WHOLE_SAVES.has(table)) {
		for (const hs of things.values()) {
			const newest = hs.reduce((a, b) => (String(b.createdAt) > String(a.createdAt) ? b : a)).createdAt;
			out.push(...hs.filter((h) => h.createdAt === newest && !h.isDeleted));
		}
		return out;
	}
	const versions = table in VERSION_KEYS ? new Map(rows.map((r) => [String(r.versionKey), r])) : null;
	for (const hs of things.values()) {
		const newest = hs.reduce((a, b) => (byTime(a, b) < 0 ? b : a));
		const live = (versions && mergeOf(hs, versions)) || newest;
		if (!live.isDeleted) out.push(live);
	}
	return out;
}

const viewOf = (table: string) => table.replace(/Table$/, "View");
export const LIVE_TABLES = [...Object.keys(VERSION_KEYS), ...ROWS_LIVE].map(viewOf);

/** Every `*View` table's rows, from the log. An entity's view row carries its birth: the entity's `createdAt`
 *  and, but for a person, its `createdByKey`. A version whose entity is missing is not live. */
export async function rebuildDerived(read: ReadTable): Promise<Record<string, Row[]>> {
	const held = unstanding(await read("purgatoryTable"));
	const out: Record<string, Row[]> = {};
	for (const [table, key] of Object.entries(VERSION_KEYS)) {
		const born = new Map((await read(table.replace(/Table$/, "Entity"))).map((e) => [e[key], e]));
		out[viewOf(table)] = liveOf(table, await read(table), held).flatMap((r) => {
			const e = born.get(r[key]);
			if (!e) return [];
			return [table === "personTable" ? { ...r, createdAt: e.createdAt } : { ...r, createdAt: e.createdAt, createdByKey: e.createdByKey }];
		});
	}
	for (const table of ROWS_LIVE) out[viewOf(table)] = liveOf(table, await read(table), held);
	return out;
}
