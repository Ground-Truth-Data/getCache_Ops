// Company forms: a version is one SurveyJS JSON definition in Central's ops.form. The builder edits a flat field
// list and writes only our field types, so a form can never reach the network (no choicesByUrl).
import type { Definition as Base, El } from '../../_rapper/gc/form';
import { call } from '../company/central';

type Trigger = { type: string; expression?: string; gotoName?: string };
export type Definition = Base & { triggers?: Trigger[] };

export type Kind = 'text' | 'number' | 'date' | 'dropdown' | 'radiogroup' | 'checkbox' | 'file' | 'section' | 'nested';
/** `src` is the element as loaded (or a new field's defaults): saving writes the edited keys onto it, so every
 *  property the builder has no control for survives each version. The builder's list is flat: a section owns
 *  what follows it up to the next section, and a nested group (a little form repeated per tree, say) owns the
 *  fields after it up to the next nested group or section. `jumps`, set while branching is on, sends a choice
 *  to a section's key or to 'submit'; a choice it leaves out continues to the next section. */
export type Field = { kind: Kind; key: string; label: string; description: string; required: boolean; choices: string[]; min?: number; max?: number; jumps?: Record<string, string>; src: El };
export type FormRow = { id: string; formId: string; version: number; definition: Definition; publishedAt: string | null; copiedFrom: string | null };
/** Where an answer was saved or an entry added, from the phone's columns; null without a fix. */
export type At = { lat?: number | null; lng?: number | null; accuracyM?: number | null };
export type Answer = At & { id: string; form: string; filledAt: string; replaces: string | null; data: Record<string, unknown> };
export type AnswerRow = At & { id: string; answer: string; groupKey: string; n: number; replaces: string | null; data: Record<string, unknown> };

export const KINDS: [Kind, string][] = [
	['text', 'Text'], ['number', 'Number'], ['dropdown', 'Dropdown'], ['radiogroup', 'Multiple choice'], ['checkbox', 'Checkboxes'],
	['date', 'Date'], ['file', 'Photo'], ['section', 'Section'], ['nested', 'Nested'],
];

const NEW: Record<Kind, Omit<El, 'name'>> = {
	text: { type: 'text' }, number: { type: 'text', inputType: 'number' }, date: { type: 'text', inputType: 'date' },
	dropdown: { type: 'dropdown' }, radiogroup: { type: 'radiogroup' }, checkbox: { type: 'checkbox' },
	file: { type: 'file', storeDataAsText: false, acceptedTypes: 'image/*' }, section: { type: 'panel' },
	nested: { type: 'paneldynamic', panelCount: 1 },
};
const choiceText = (c: unknown) => String(typeof c === 'object' ? (c as { value: unknown }).value : c);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 40);
/** The key Central takes for a field: from its title, its type while it has none, never one another field holds.
 *  A section is only a heading, so its key is never seen. */
export function keyFor(label: string, kind: Kind, fields: Field[], self?: Field) {
	const base = kind === 'section' ? `section_${crypto.randomUUID().slice(0, 8)}` : slug(label) || kind;
	let k = base;
	for (let n = 2; fields.some((o) => o !== self && o.key === k); n++) k = `${base}_${n}`;
	return k;
}

export const blank = (kind: Kind): Field => ({
	kind, key: '', label: '', required: false, choices: kind === 'dropdown' || kind === 'radiogroup' || kind === 'checkbox' ? ['Yes', 'No'] : [],
	description: '', src: { ...NEW[kind], name: '' },
});

function el(f: Field): El {
	const out: El = { ...f.src, name: f.key };
	const put = (k: string, v: unknown) => (v === undefined || v === '' || v === false ? delete out[k] : (out[k] = v));
	put('title', f.label);
	put('description', f.description);
	put('isRequired', f.required);
	if (f.kind === 'number') (put('min', f.min), put('max', f.max));
	// Choices the builder shows as plain text; untouched, a definition's own {value, text} pairs stay.
	if (f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox') {
		const choices = f.choices.filter(Boolean);
		out.choices = choices.join('\n') === ((f.src.choices as unknown[]) ?? []).map(choiceText).join('\n') ? f.src.choices : choices;
	}
	return out;
}
/** Only a one-answer question outside a nested group can send the form to another section. */
export const branches = (f: Field) => f.kind === 'dropdown' || f.kind === 'radiogroup';
// "Go to section based on answer" is written as SurveyJS's own triggers, so the definition stays standard.
const JUMP = /^\{(\w+)\} = '(.*)'$/;

export const toDefinition = (title: string, fields: Field[], rest: Partial<Definition> = {}): Definition => {
	const elements: El[] = [];
	const triggers: Trigger[] = [...(rest.triggers ?? [])];
	const sections = new Set(fields.filter((f) => f.kind === 'section').map((f) => f.key));
	let section: El[] | undefined;
	let nested: El[] | undefined;
	for (const f of fields) {
		const e = el(f);
		if (f.kind === 'section') {
			elements.push(e);
			section = e.elements = [];
			nested = undefined;
		} else if (f.kind === 'nested') {
			(section ?? elements).push(e);
			nested = e.templateElements = [];
		} else (nested ?? section ?? elements).push(e);
		if (!nested && f.jumps && branches(f))
			for (const c of f.choices) {
				const to = f.jumps[c];
				const expression = `{${f.key}} = '${c}'`;
				if (to === 'submit') triggers.push({ type: 'complete', expression });
				else if (sections.has(to)) triggers.push({ type: 'skip', expression, gotoName: to });
			}
	}
	const d: Definition = { ...rest, elements, triggers };
	if (title) d.title = title;
	else delete d.title;
	if (!d.description) delete d.description;
	if (!triggers.length) delete d.triggers;
	return d;
};

function field(e: El): Field {
	const kind = (e.type === 'text' ? (e.inputType === 'number' ? 'number' : e.inputType === 'date' ? 'date' : 'text') : e.type === 'panel' ? 'section' : e.type === 'paneldynamic' ? 'nested' : e.type) as Kind;
	return {
		kind, key: e.name, label: e.title ?? '', description: (e.description as string) ?? '', required: !!e.isRequired,
		choices: ((e.choices as unknown[]) ?? []).map(choiceText),
		min: e.min as number | undefined, max: e.max as number | undefined, src: e,
	};
}
const flat = (e: El): Field[] => {
	// Location lives in the answer's own columns; a hidden gps field from before is never written again.
	if (e.type === 'gps') return [];
	const kids = (e.type === 'panel' ? e.elements : e.type === 'paneldynamic' ? e.templateElements : undefined) as El[] | undefined;
	return kids ? [field({ ...e, elements: undefined, templateElements: undefined }), ...flatAll(kids)] : [field(e)];
};
// In the flat list a nested group swallows every question after it, so a question that sat after one in the
// definition is kept out by a blank section of its own.
const flatAll = (els: El[]): Field[] =>
	els.flatMap((e, i) => {
		const next = els[i + 1];
		const gap = e.type === 'paneldynamic' && next && next.type !== 'panel' && next.type !== 'paneldynamic';
		return gap ? [...flat(e), { ...blank('section'), key: `section_${crypto.randomUUID().slice(0, 8)}` }] : flat(e);
	});
/** The fields the builder edits, each group's own fields right after it, and `rest`: the survey's own settings,
 *  written back untouched. */
// requestGps: a switch drafts once stored; location is now always recorded.
export function fromDefinition({ title, elements, triggers, requestGps: _, ...rest }: Definition & { requestGps?: unknown }) {
	const fields = flatAll(elements);
	// A draft kept in this browser before keys were born on every field would be refused by Central on each save.
	for (const f of fields) if (!CENTRAL_KEY.test(f.key)) f.key = keyFor(f.label, f.kind, fields, f);
	// The builder's own triggers become jumps on their question; any other trigger is written back untouched.
	const others = (triggers ?? []).filter((t) => {
		const [, key, choice] = JUMP.exec(t.expression ?? '') ?? [];
		const f = fields.find((f) => f.key === key && branches(f));
		const to = t.type === 'complete' ? 'submit' : t.type === 'skip' && t.gotoName;
		if (!f || !to) return true;
		(f.jumps ??= {})[choice] = to;
	});
	return { title: title ?? '', fields, rest: others.length ? { ...rest, triggers: others } : rest };
}
/** Central's own rule for a key (ops.form_refused). */
export const CENTRAL_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;

/** Every key a definition holds, with its label, and the repeating group it sits in. */
export const keys = (d: Definition) => {
	const walk = (els: El[], group?: string): { key: string; label: string; type: string; group?: string }[] =>
		els.flatMap((e) =>
			e.type === 'panel'
				? walk(e.elements as El[], group)
				: [{ key: e.name, label: e.title ?? e.name, type: e.type, group }, ...(e.type === 'paneldynamic' ? walk(e.templateElements as El[], e.name) : [])],
		);
	return walk(d.elements);
};

/** One version as the builder and the report see it, whoever keeps it: a company form or a plugin. */
export type Version = { id: string; version: number; definition: Definition; publishedAt: string | null };
/** `autosave`: saving costs nothing (kept in this browser), so every change is saved and there is no Save button. */
export type Store = {
	load: () => Promise<Version[]>;
	save: (definition: Definition, draftId?: string) => Promise<unknown>;
	publish: (draftId?: string) => Promise<unknown>;
	autosave?: boolean;
};
export type Answers = { versions: Version[]; answers: Answer[]; rows: AnswerRow[] };

export function orgStore(orgKey: string, formId: string): Store {
	// A new form gets its id when its first draft is saved.
	let id = formId === 'new' ? undefined : formId;
	return {
		load: async () => (id ? (await forms(orgKey)).filter((f) => f.formId === id) : []),
		async save(definition, draftId) {
			const made = await saveDraft(orgKey, definition, id, draftId);
			if (!id && Array.isArray(made)) history.replaceState(null, '', `#/company/form/${(id = made[0].formId)}`);
		},
		publish: (draftId) => publish(draftId!),
	};
}
export async function orgAnswers(orgKey: string, formId: string): Promise<Answers> {
	const versions = (await forms(orgKey)).filter((f) => f.formId === formId && f.publishedAt);
	const all = await answers(versions.map((v) => v.id));
	return { versions, answers: all, rows: await answerRows(all.map((a) => a.id)) };
}

export const forms = (orgKey: string) =>call<FormRow[]>(`form?orgKey=eq.${orgKey}&select=id,formId,version,definition,publishedAt,copiedFrom&order=formId,version`);
export const saveDraft = (orgKey: string, definition: Definition, formId?: string, draftId?: string) =>
	draftId ? call(`form?id=eq.${draftId}`, 'PATCH', { definition }) : call<FormRow[]>('form', 'POST', { orgKey, definition, ...(formId && { formId }) });
export const publish = (id: string) => call(`form?id=eq.${id}`, 'PATCH', { publishedAt: new Date().toISOString() });
export const copyForm = (source: string, org: string) => call<string>('rpc/copy_form', 'POST', { source, org });
const answers = (ids: string[]) => call<Answer[]>(`answer?form=in.(${ids})&order=filledAt`);
const answerRows = (ids: string[]) => (ids.length ? call<AnswerRow[]>(`answerRow?answer=in.(${ids})&order=n`) : Promise.resolve([]));
