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
			type: 'paneldynamic', name: 'trees', title: 'Trees', panelAddText: '+ Tree', minPanelCount: 1,
			templateElements: [{ type: 'file', name: 'photo', title: 'Photo', maxSize: 500000 }],
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
		fields.push({ ...blank('text'), key: 'weather', label: 'Weather' });
		const v2 = toDefinition(title, fields, rest);
		expect(v2.elements[0]).toEqual({ ...v1.elements[0], title: 'When' });
		expect(v2.elements.slice(1, 3)).toEqual(v1.elements.slice(1));
		expect(v2.elements[3]).toEqual({ type: 'text', name: 'weather', title: 'Weather' });
		expect((v2 as Record<string, unknown>).showProgressBar).toBe('top');
	});

	it('a group carries its add-button text', () => {
		const { title, fields, rest } = fromDefinition(structuredClone(v1));
		expect(fields[2].addText).toBe('+ Tree');
		fields[2].addText = '';
		const { panelAddText, ...withoutIt } = v1.elements[2];
		expect(panelAddText).toBe('+ Tree');
		expect(toDefinition(title, fields, rest).elements[2]).toEqual(withoutIt);
	});
});
