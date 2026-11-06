import { expect, test } from 'vitest';
import { sections, sheets } from './answers';
import type { Answers } from './forms';

const definition = {
	title: 'Special tree finder',
	elements: [
		{ type: 'text', name: 'species', title: 'Species' },
		{
			type: 'panel', name: 'section_1', title: 'Measurements',
			elements: [
				{ type: 'text', inputType: 'number', name: 'height', title: 'Height' },
				{ type: 'paneldynamic', name: 'trees', title: 'Trees', templateElements: [{ type: 'text', name: 'dbh', title: 'DBH' }] },
			],
		},
	],
};
const got: Answers = {
	versions: [{ id: 'v1', version: 1, definition, publishedAt: '2026-11-01' }],
	answers: [
		{ id: 'r1', form: 'v1', filledAt: '2026-11-05T14:41:00Z', replaces: null, data: { species: 'red, "big" cedar', height: 42 }, lat: -19.4114, lng: 146.817, accuracyM: 4 },
		{ id: 'r2', form: 'v1', filledAt: '2026-11-05T15:00:00Z', replaces: null, data: { species: 'pine' } },
		{ id: 'r2b', form: 'v1', filledAt: '2026-11-05T15:05:00Z', replaces: 'r2', data: { species: 'spruce' }, lat: null, lng: null, accuracyM: null },
	],
	rows: [
		{ id: 'e2', answer: 'r1', groupKey: 'trees', n: 2, replaces: null, data: { dbh: 51 } },
		{ id: 'e1', answer: 'r1', groupKey: 'trees', n: 1, replaces: null, data: { dbh: 34 }, lat: -19.4113, lng: 146.8172, accuracyM: 5 },
		{ id: 'e3', answer: 'r2b', groupKey: 'trees', n: 1, replaces: null, data: { dbh: 28 } },
	],
};

test('responses.csv: a header from the keys, one row per response as it stands, commas and quotes escaped', () => {
	expect(sheets(got)['responses.csv']).toBe(
		'id,species,height,lat,lon,acc_m,saved\r\n' +
			'r1,"red, ""big"" cedar",42,-19.4114,146.817,4,2026-11-05T14:41:00Z\r\n' +
			'r2b,spruce,,,,,2026-11-05T15:05:00Z\r\n',
	);
});

test("a group's sheet: one row per entry, linked by response id, in order", () => {
	expect(sheets(got)['trees.csv']).toBe('response_id,n,dbh,lat,lon,acc_m\r\nr1,1,34,-19.4113,146.8172,5\r\nr1,2,51,,,\r\nr2b,1,28,,,\r\n');
});

test('no GPS answered, no lat/lon/acc_m columns', () => {
	const none = { ...got, answers: got.answers.map((a) => ({ ...a, lat: null, lng: null, accuracyM: null })), rows: [] };
	expect(sheets(none)['responses.csv'].split('\r\n')[0]).toBe('id,species,height,saved');
	expect(sheets(none)['trees.csv']).toBe('response_id,n,dbh\r\n');
});

test('sections: the head first, then each section with its nested group', () => {
	expect(sections(definition).map((s) => [s.title, s.elements.map((e) => e.name)])).toEqual([
		['Section 1', ['species']],
		['Measurements', ['height', 'trees']],
	]);
});
