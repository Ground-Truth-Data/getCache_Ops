import { describe, expect, it } from 'vitest';
import { blank, fromDefinition, toDefinition } from './forms';
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
});
