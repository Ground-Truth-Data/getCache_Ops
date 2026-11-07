import { describe, expect, it } from 'vitest';
import { blank, fromDefinition, keyFor, toDefinition } from './forms';
import type { Definition } from '../../_rapper/gc/form';

const v1: Definition & Record<string, unknown> = {
	title: 'Tree check',
	showProgressBar: 'top',
	elements: [
		{ type: 'text', inputType: 'date', name: 'date', title: 'Date', isRequired: true, description: 'Day you planted' },
		{ type: 'dropdown', name: 'kind', title: 'Kind', choices: [{ value: 'pl', text: 'Pine' }, 'Spruce'] },
		{
			type: 'panel', name: 'trees', title: 'Trees', description: 'One tree', state: 'expanded',
			elements: [{ type: 'file', name: 'photo', title: 'Photo', maxSize: 500000 }],
		},
	],
};

describe('the builder keeps what it does not edit', () => {
	it('round-trips a definition untouched', () => {
		const { title, fields, rest } = fromDefinition(structuredClone(v1));
		expect(toDefinition(title, fields, rest)).toEqual(v1);
	});

	it('an edit changes only the edited key, and a new field still joins', () => {
		const { title, fields, rest } = fromDefinition(structuredClone(v1));
		fields[0].label = 'When';
		fields.splice(2, 0, { ...blank('text'), key: 'weather', label: 'Weather' });
		const v2 = toDefinition(title, fields, rest);
		expect(v2.elements[0]).toEqual({ ...v1.elements[0], title: 'When' });
		expect(v2.elements[1]).toEqual(v1.elements[1]);
		expect(v2.elements[2]).toEqual({ type: 'text', name: 'weather', title: 'Weather' });
		expect(v2.elements[3]).toEqual(v1.elements[2]);
		expect((v2 as Record<string, unknown>).showProgressBar).toBe('top');
	});

	it('a section owns the fields after it, and comes back flat', () => {
		const fields = [blank('text'), { ...blank('section'), key: 'site', label: 'Site', description: 'Where you are' }, blank('number'), blank('date')];
		fields.forEach((f, i) => (f.key ||= `f${i}`));
		const d = toDefinition('', fields);
		expect(d.elements.map((e) => e.name)).toEqual(['f0', 'site']);
		expect(d.elements[1]).toMatchObject({ type: 'panel', title: 'Site', description: 'Where you are' });
		expect((d.elements[1].elements as { name: string }[]).map((e) => e.name)).toEqual(['f2', 'f3']);
		expect(fromDefinition(d).fields.map((f) => f.key)).toEqual(['f0', 'site', 'f2', 'f3']);
		expect(toDefinition('', fromDefinition(d).fields)).toEqual(d);
	});
	it('a field is never without a key Central takes', () => {
		const central = /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;
		const fields = [{ ...blank('text'), key: 'text' }];
		expect(keyFor('', 'text', fields)).toBe('text_2');
		expect(keyFor('!!!', 'nested', [])).toBe('nested');
		expect(keyFor('123 Trees!', 'number', [])).toBe('trees');
		for (const kind of ['text', 'section', 'nested'] as const) expect(keyFor('', kind, [])).toMatch(central);
	});
	it('a draft kept before keys were born gets one on load', () => {
		const d: Definition = { elements: [{ type: 'text', name: '', title: 'Tree height' }, { type: 'panel', name: '' }] };
		expect(fromDefinition(d).fields.map((f) => f.key)).toEqual(['tree_height', expect.stringMatching(/^section_/)]);
	});
	it('a question saved after a nested group stays out of it', () => {
		const d: Definition = { elements: [{ type: 'paneldynamic', name: 'trees', templateElements: [{ type: 'text', name: 'species' }] }, { type: 'text', name: 'weather' }] };
		const { fields } = fromDefinition(d);
		expect(fields.map((f) => f.kind)).toEqual(['nested', 'text', 'section', 'text']);
		const out = toDefinition('', fields);
		expect(out.elements[0].templateElements).toEqual([{ type: 'text', name: 'species' }]);
		expect((out.elements[1].elements as { name: string }[]).map((e) => e.name)).toEqual(['weather']);
	});
	it('a choice that jumps writes SurveyJS triggers, reads them back, and drops them with its option or question', () => {
		const other = { type: 'runexpression', expression: '{a} = 1' };
		const d = {
			triggers: [other],
			elements: [
				{ type: 'radiogroup', name: 'health', choices: ['Healthy', 'Damaged', 'Dead'] },
				{ type: 'panel', name: 'section_a', elements: [{ type: 'text', name: 'notes' }] },
			],
		};
		const read = fromDefinition(structuredClone(d));
		read.fields[0].jumps = { Damaged: 'section_a', Dead: 'submit' };
		const out = toDefinition('', read.fields, read.rest);
		const ours = [
			{ type: 'skip', expression: "{health} = 'Damaged'", gotoName: 'section_a' },
			{ type: 'complete', expression: "{health} = 'Dead'" },
		];
		expect(out.triggers).toEqual([other, ...ours]);
		const back = fromDefinition(structuredClone(out));
		expect(back.fields[0].jumps).toEqual({ Damaged: 'section_a', Dead: 'submit' });
		expect(back.rest.triggers).toEqual([other]);
		expect(toDefinition('', back.fields, back.rest)).toEqual(out);

		back.fields[0].choices = ['Healthy', 'Damaged'];
		expect(toDefinition('', back.fields, back.rest).triggers).toEqual([other, ours[0]]);
		expect(toDefinition('', back.fields.slice(1), back.rest).triggers).toEqual([other]);
	});
	it('a hidden gps field and the old Request GPS flag are dropped on load', () => {
		const dbh = { type: 'text', inputType: 'number', name: 'dbh' };
		const d = {
			requestGps: true,
			elements: [{ type: 'gps', name: 'gps' }, { type: 'paneldynamic', name: 'trees', templateElements: [{ type: 'gps', name: 'trees_gps' }, dbh] }],
		};
		const { fields, rest } = fromDefinition(d);
		expect(fields.map((f) => f.key)).toEqual(['trees', 'dbh']);
		expect(toDefinition('', fields, rest)).toEqual({ elements: [{ type: 'paneldynamic', name: 'trees', templateElements: [dbh] }] });
	});
	it('a nested group sits in its section and owns the fields after it, up to the next section', () => {
		const fields = [blank('section'), blank('text'), blank('nested'), blank('number'), blank('text'), blank('section'), blank('date')];
		fields.forEach((f, i) => (f.key = `f${i}`));
		const d = toDefinition('', fields);
		expect(d.elements.map((e) => e.name)).toEqual(['f0', 'f5']);
		const [text, nested] = d.elements[0].elements as { name: string; templateElements?: { name: string }[] }[];
		expect([text.name, nested.name, nested.templateElements?.map((e) => e.name)]).toEqual(['f1', 'f2', ['f3', 'f4']]);
		expect(toDefinition('', fromDefinition(d).fields)).toEqual(d);
	});
});

describe('a Person question', () => {
	it('is a dropdown of contacts with no choices, and survives a save and a load', () => {
		const f = { ...blank('person'), label: 'Boss' };
		f.key = keyFor(f.label, f.kind, [f]);
		const d = toDefinition('Crew', [f]);
		expect(d.elements).toEqual([{ type: 'dropdown', name: 'boss', title: 'Boss', contacts: true }]);
		const back = fromDefinition(structuredClone(d));
		expect(back.fields.map((x) => [x.kind, x.key, x.choices])).toEqual([['person', 'boss', []]]);
		expect(toDefinition(back.title, back.fields, back.rest)).toEqual(d);
	});
});
