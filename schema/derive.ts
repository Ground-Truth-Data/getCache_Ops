// Every live `*View` row, computed from the log alone. Pure and dependency-free, so the phone, superCrud (Deno)
// and Ops run the same rule; the phone's src imports it, the edge function cannot import src.

export type Row = Record<string, unknown>;
/** Every row of one log table, in any order. */
export type ReadTable = (table: string) => Row[] | Promise<Row[]>;

export const VERSION_KEYS = {
	mapTable: "mapKey",
	mapFeatureTable: "mapFeatureKey",
	qaSurveyTable: "qaSurveyKey",
	qaPlotTable: "qaPlotKey",
	blockTable: "blockKey",
	cropTable: "cropKey",
	bagTable: "bagKey",
	bagUpTable: "bagUpKey",
	tallyTable: "tallyKey",
	packageTable: "packageKey",
	personTable: "personKey",
} as const;

export const ROWS_LIVE = ["crewTable", "orgKindTable", "orgTagTable", "orgNameTable", "stockTable", "deliveryTable", "allocationTable", "speciesTable", "speciesMarkTable"] as const;

/** The columns naming one thing, whose newest head is its only live row. A
 *  table missing here keeps every head live: each row is its own thing. */
const THING: Partial<Record<string, readonly string[]>> = {
	...Object.fromEntries(Object.entries(VERSION_KEYS).map(([t, k]) => [t, [k]])),
	orgNameTable: ["orgKey"],
	// After an import two phones' counts can both be live: the newest said wins.
	stockTable: ["mapFeatureKey", "cropKey"],
	deliveryTable: ["mapFeatureKey", "cropKey"],
	// A plan is saved whole, every line stamped alike: the newest save per block and work mode wins.
	allocationTable: ["blockKey", "workMode"],
	speciesTable: ["speciesKey"],
	speciesMarkTable: ["speciesKey"],
};
export const WHOLE_SAVES = new Set(["allocationTable"]);
export const thingOf = (table: string): readonly string[] => THING[table] ?? [];

export const STAMPS = new Set(["versionKey", "createdAt", "replacesKey", "kind", "actKey"]);
// Who made a version, not a cell of it: a different editor with nothing changed writes nothing.
export const NOT_A_CHANGE = new Set(["editedByKey"]);

const byTime = (a: Row, b: Row) => (String(a.createdAt) < String(b.createdAt) || (a.createdAt === b.createdAt && String(a.versionKey) < String(b.versionKey)) ? -1 : 1);

/** Concurrent heads of one thing as one row: a cell only one head changed since their common ancestor keeps
 *  that change, a cell several changed keeps the newest's. `versions` is every version of the thing. An
 *  `accepted` head counts as the newest. Null when there is nothing to merge: one head, no common ancestor, or
 *  the newest head already holds every change. The row carries the newest head's stamps. */
export function mergeOf(heads: readonly Row[], versions: ReadonlyMap<string, Row>, accepted?: string): Row | null {
	const sorted = [...heads].sort(byTime);
	if (sorted.length < 2) return null;
	const edits = [...sorted.filter((h) => h.versionKey !== accepted), ...sorted.filter((h) => h.versionKey === accepted)];
	const line = (v: string) => {
		const out: string[] = [];
		for (let at: string | null | undefined = v; at && !out.includes(at); at = versions.get(at)?.replacesKey as string | null) out.push(at);
		return out;
	};
	const [first, ...rest] = edits.map((h) => line(String(h.versionKey)));
	const base = first!.find((v) => rest.every((l) => l.includes(v)));
	if (!base) return null;
	const ancestor = versions.get(base)!;
	const newest = edits.at(-1)!;
	const merged: Row = { ...newest };
	for (const c of Object.keys(newest)) {
		if (STAMPS.has(c) || NOT_A_CHANGE.has(c)) continue;
		const changed = edits.filter((h) => h[c] !== ancestor[c]);
		if (changed.length) merged[c] = changed.at(-1)![c];
	}
	return newest === sorted.at(-1) && Object.keys(merged).every((c) => merged[c] === newest[c]) ? null : merged;
}

// On Central two accounts can share keys, so a version is named with its owner; the phone has none.
const own = (r: Row, key: unknown) => JSON.stringify([r.ownerId ?? null, String(key)]);

/** Held versions whose newest review, the one no other follows, does not accept them: they stand for nothing. */
export function unstanding(reviews: readonly Row[]): Set<string> {
	const followed = new Set(reviews.map((r) => own(r, r.followsKey)));
	return new Set(reviews.filter((r) => !followed.has(own(r, r.reviewKey)) && r.decision !== "accepted").map((r) => own(r, r.versionKey)));
}

/** One table's live rows: per thing, its newest head, merged with the other heads, unless any head ends it. */
export function liveOf(table: string, rows: readonly Row[], held: ReadonlySet<string>): Row[] {
	const replaced = new Set(rows.flatMap((r) => (held.has(own(r, r.versionKey)) ? [] : [own(r, r.replacesKey)])));
	const heads = rows.filter((r) => !held.has(own(r, r.versionKey)) && !replaced.has(own(r, r.versionKey)));
	const thing = thingOf(table);
	if (!thing.length) return heads.filter((h) => h.kind !== "end");
	const of = (r: Row) => JSON.stringify([r.ownerId ?? null, ...thing.map((c) => r[c] ?? null)]);
	const things = new Map<string, Row[]>();
	for (const h of heads) things.set(of(h), [...(things.get(of(h)) ?? []), h]);
	const out: Row[] = [];
	if (WHOLE_SAVES.has(table)) {
		for (const hs of things.values()) {
			const newest = hs.reduce((a, b) => (String(b.createdAt) > String(a.createdAt) ? b : a)).createdAt;
			out.push(...hs.filter((h) => h.createdAt === newest && h.kind !== "end"));
		}
		return out;
	}
	const versions = table in VERSION_KEYS ? new Map(rows.map((r) => [String(r.versionKey), r])) : null;
	for (const hs of things.values()) {
		const newest = hs.reduce((a, b) => (byTime(a, b) < 0 ? b : a));
		// An end wins over a concurrent edit it never saw.
		if (!hs.some((h) => h.kind === "end")) out.push((versions && mergeOf(hs, versions)) || newest);
	}
	return out;
}

export const viewOf = (table: string) => table.replace(/Table$/, "View");
export const LIVE_TABLES = [...Object.keys(VERSION_KEYS), ...ROWS_LIVE].map(viewOf);
export const entityOf = (table: string) => table.replace(/Table$/, "Entity");

/** One table's `*View` rows: its live rows, and for a version table each carries its birth from `born` (its
 *  entity rows): the entity's `createdAt` and, but for a person, its `createdByKey`. No entity, not live. */
export function viewRows(table: string, rows: readonly Row[], held: ReadonlySet<string>, born: readonly Row[] = []): Row[] {
	const live = liveOf(table, rows, held);
	const key = VERSION_KEYS[table as keyof typeof VERSION_KEYS];
	if (!key) return live;
	const of = new Map(born.map((e) => [e[key], e]));
	return live.flatMap((r) => {
		const e = of.get(r[key]);
		if (!e) return [];
		return [table === "personTable" ? { ...r, createdAt: e.createdAt } : { ...r, createdAt: e.createdAt, createdByKey: e.createdByKey }];
	});
}

/** Every `*View` table's rows, from the log. */
export async function rebuildDerived(read: ReadTable): Promise<Record<string, Row[]>> {
	const held = unstanding(await read("purgatoryTable"));
	const out: Record<string, Row[]> = {};
	for (const t of [...Object.keys(VERSION_KEYS), ...ROWS_LIVE]) out[viewOf(t)] = viewRows(t, await read(t), held, t in VERSION_KEYS ? await read(entityOf(t)) : []);
	return out;
}
