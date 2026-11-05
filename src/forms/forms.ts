// Company forms: a version is one SurveyJS JSON definition in Central's ops.form. The builder edits a flat field
// list and writes only our field types, so a form can never reach the network (no choicesByUrl).
import type { Definition, El } from '../../_rapper/gc/form';
import { call } from '../company/central';

export type { Definition };

export type Kind = 'text' | 'number' | 'date' | 'dropdown' | 'radiogroup' | 'checkbox' | 'file' | 'gps' | 'section';
/** `src` is the element as loaded (or a new field's defaults): saving writes the edited keys onto it, so every
 *  property the builder has no control for survives each version. */
/** The builder's list is flat: a section owns the fields after it, up to the next section. */
export type Field = { kind: Kind; key: string; label: string; description: string; required: boolean; choices: string[]; min?: number; max?: number; src: El };
export type FormRow = { id: string; formId: string; version: number; definition: Definition; publishedAt: string | null; copiedFrom: string | null };
export type Answer = { id: string; form: string; filledAt: string; replaces: string | null; data: Record<string, unknown> };
export type AnswerRow = { id: string; answer: string; groupKey: string; n: number; replaces: string | null; data: Record<string, unknown> };

export const KINDS: [Kind, string][] = [
	['text', 'Text'], ['number', 'Number'], ['dropdown', 'Dropdown'], ['radiogroup', 'Multiple choice'], ['checkbox', 'Checkboxes'],
	['date', 'Date'], ['file', 'Photo'], ['gps', 'GPS'], ['section', 'Section'],
];

const NEW: Record<Kind, Omit<El, 'name'>> = {
	text: { type: 'text' }, number: { type: 'text', inputType: 'number' }, date: { type: 'text', inputType: 'date' },
	dropdown: { type: 'dropdown' }, radiogroup: { type: 'radiogroup' }, checkbox: { type: 'checkbox' },
	file: { type: 'file', storeDataAsText: false, acceptedTypes: 'image/*' }, gps: { type: 'gps' }, section: { type: 'panel' },
};
const choiceText = (c: unknown) => String(typeof c === 'object' ? (c as { value: unknown }).value : c);

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
	if (f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox')
		out.choices = f.choices.join('\n') === ((f.src.choices as unknown[]) ?? []).map(choiceText).join('\n') ? f.src.choices : f.choices;
	return out;
}
export const toDefinition = (title: string, fields: Field[], rest: Partial<Definition> = {}): Definition => {
	const elements: El[] = [];
	let section: El | undefined;
	for (const f of fields)
		if (f.kind === 'section') elements.push((section = { ...el(f), elements: [] }));
		else ((section?.elements as El[] | undefined) ?? elements).push(el(f));
	const d: Definition = { ...rest, elements };
	if (title) d.title = title;
	else delete d.title;
	return d;
};

function field(e: El): Field {
	const kind = (e.type === 'text' ? (e.inputType === 'number' ? 'number' : e.inputType === 'date' ? 'date' : 'text') : e.type === 'panel' ? 'section' : e.type) as Kind;
	return {
		kind, key: e.name, label: e.title ?? '', description: (e.description as string) ?? '', required: !!e.isRequired,
		choices: ((e.choices as unknown[]) ?? []).map(choiceText),
		min: e.min as number | undefined, max: e.max as number | undefined, src: e,
	};
}
/** The fields the builder edits, a section's own fields right after it, and `rest`: the survey's own settings,
 *  written back untouched. */
export const fromDefinition = ({ title, elements, ...rest }: Definition) => ({
	title: title ?? '',
	fields: elements.flatMap((e) => (e.type === 'panel' ? [field({ ...e, elements: undefined }), ...((e.elements as El[]) ?? []).map(field)] : [field(e)])),
	rest,
});

/** Every key a definition holds, with its label, and the repeating group it sits in. */
export const keys = (d: Definition) =>
	d.elements.flatMap((e): { key: string; label: string; group?: string }[] =>
		e.type === 'paneldynamic'
			? [{ key: e.name, label: e.title ?? e.name }, ...(e.templateElements as El[]).map((t) => ({ key: t.name, label: t.title ?? t.name, group: e.name }))]
			: e.type === 'panel'
				? (e.elements as El[]).map((t) => ({ key: t.name, label: t.title ?? t.name }))
				: [{ key: e.name, label: e.title ?? e.name }],
	);

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
