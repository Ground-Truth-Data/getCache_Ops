// Company forms: a version is one SurveyJS JSON definition in Central's ops.form. The builder edits a flat field
// list and writes only our field types, so a form can never reach the network (no choicesByUrl).
import { call } from '../company/central';

export type Kind = 'text' | 'number' | 'date' | 'dropdown' | 'radiogroup' | 'checkbox' | 'file' | 'gps' | 'group';
export type Field = { kind: Kind; key: string; label: string; required: boolean; choices: string[]; min?: number; max?: number; fields: Field[] };
export type Definition = { title?: string; elements: El[] };
type El = Record<string, unknown> & { type: string; name: string; title?: string };
export type FormRow = { id: string; formId: string; version: number; definition: Definition; publishedAt: string | null; copiedFrom: string | null };
export type Answer = { id: string; form: string; authId: string; filledAt: string; replaces: string | null; data: Record<string, unknown> };
export type AnswerRow = { id: string; answer: string; groupKey: string; n: number; replaces: string | null; data: Record<string, unknown> };

export const KINDS: [Kind, string][] = [
	['text', 'Text'], ['number', 'Number'], ['dropdown', 'Dropdown'], ['radiogroup', 'Multiple choice'], ['checkbox', 'Checkboxes'],
	['date', 'Date'], ['file', 'Photo'], ['gps', 'GPS'], ['group', 'Repeating group'],
];

export const blank = (kind: Kind): Field => ({ kind, key: '', label: '', required: false, choices: kind === 'dropdown' || kind === 'radiogroup' || kind === 'checkbox' ? ['Yes', 'No'] : [], fields: [] });

function el(f: Field): El {
	const base = { name: f.key, ...(f.label && { title: f.label }), ...(f.required && { isRequired: true }) };
	switch (f.kind) {
		case 'number': return { type: 'text', inputType: 'number', ...base, ...(f.min != null && { min: f.min }), ...(f.max != null && { max: f.max }) };
		case 'date': return { type: 'text', inputType: 'date', ...base };
		case 'dropdown': case 'radiogroup': case 'checkbox': return { type: f.kind, ...base, choices: f.choices };
		case 'file': return { type: 'file', ...base, storeDataAsText: false, acceptedTypes: 'image/*' };
		case 'group': return { type: 'paneldynamic', ...base, templateElements: f.fields.map(el), panelCount: 1 };
		default: return { type: f.kind, ...base };
	}
}
export const toDefinition = (title: string, fields: Field[]): Definition => ({ ...(title && { title }), elements: fields.map(el) });

function field(e: El): Field {
	const kind = (e.type === 'text' ? (e.inputType === 'number' ? 'number' : e.inputType === 'date' ? 'date' : 'text') : e.type === 'paneldynamic' ? 'group' : e.type) as Kind;
	return {
		kind, key: e.name, label: e.title ?? '', required: !!e.isRequired,
		choices: ((e.choices as unknown[]) ?? []).map((c) => String(typeof c === 'object' ? (c as { value: unknown }).value : c)),
		min: e.min as number | undefined, max: e.max as number | undefined,
		fields: ((e.templateElements as El[]) ?? []).map(field),
	};
}
export const fromDefinition = (d: Definition) => ({ title: d.title ?? '', fields: d.elements.map(field) });

/** Every key a definition holds, with its label, and the repeating group it sits in. */
export const keys = (d: Definition) =>
	d.elements.flatMap((e): { key: string; label: string; group?: string }[] =>
		e.type === 'paneldynamic'
			? [{ key: e.name, label: e.title ?? e.name }, ...(e.templateElements as El[]).map((t) => ({ key: t.name, label: t.title ?? t.name, group: e.name }))]
			: [{ key: e.name, label: e.title ?? e.name }],
	);

/** SurveyJS answers split the way Central keeps them: header data, and one row per repeating entry. */
export function split(d: Definition, data: Record<string, unknown>) {
	const groups = new Set(d.elements.filter((e) => e.type === 'paneldynamic').map((e) => e.name));
	const header = Object.fromEntries(Object.entries(data).filter(([k]) => !groups.has(k)));
	const rows = [...groups].flatMap((g) => ((data[g] as Record<string, unknown>[]) ?? []).map((r, n) => ({ groupKey: g, n: n + 1, data: r })));
	return { data: header, rows };
}

export const forms = (orgKey: string) => call<FormRow[]>(`form?orgKey=eq.${orgKey}&select=id,formId,version,definition,publishedAt,copiedFrom&order=formId,version`);
export const saveDraft = (orgKey: string, definition: Definition, formId?: string, draftId?: string) =>
	draftId ? call(`form?id=eq.${draftId}`, 'PATCH', { definition }) : call<FormRow[]>('form', 'POST', { orgKey, definition, ...(formId && { formId }) });
export const publish = (id: string) => call(`form?id=eq.${id}`, 'PATCH', { publishedAt: new Date().toISOString() });
export const copyForm = (source: string, org: string) => call<string>('rpc/copy_form', 'POST', { source, org });
export const answers = (ids: string[]) => call<Answer[]>(`answer?form=in.(${ids})&order=filledAt`);
export const answerRows = (ids: string[]) => (ids.length ? call<AnswerRow[]>(`answerRow?answer=in.(${ids})&order=n`) : Promise.resolve([]));
