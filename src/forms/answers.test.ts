import { expect, test, vi } from 'vitest';
import { download, named, sections, sheets, text } from './answers';
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
	definition,
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

test("a Person answer shows the username from the reader's contacts, an unknown one says so", () => {
	const crew: Answers = {
		definition: { elements: [{ type: 'dropdown', name: 'boss', title: 'Boss', contacts: true }, { type: 'text', name: 'note', title: 'Note' }] },
		answers: [
			{ id: 'r1', form: 'v1', filledAt: '2026-11-07T10:00:00Z', replaces: null, data: { boss: 'p1', note: 'p1' } },
			{ id: 'r2', form: 'v1', filledAt: '2026-11-07T11:00:00Z', replaces: null, data: { boss: 'p9' } },
		],
		rows: [],
	};
	const people = new Map([['p1', 'Carlie']]);
	expect(sheets(named(crew, (k) => people.get(k) ?? 'not in your contacts'))['responses.csv']).toBe(
		'id,boss,note,saved\r\nr1,Carlie,p1,2026-11-07T10:00:00Z\r\nr2,not in your contacts,,2026-11-07T11:00:00Z\r\n',
	);
});

test('a multi-answer prints as a comma list: chosen values as they are, picked people or files by name', () => {
	expect(text(['pine', 3])).toBe('pine, 3');
	expect(text([{ name: 'Sam Planter' }, { content: 'data:' }])).toBe('Sam Planter, ');
	expect(text(undefined)).toBe('');
	expect(text(0)).toBe('0');
});

test('each sheet downloads as its own csv, and its object URL is let go', async () => {
	const links: { href: string; download: string; clicked: boolean }[] = [];
	const made: Blob[] = [];
	const revoked: string[] = [];
	vi.stubGlobal('document', { createElement: () => { const a = { href: '', download: '', clicked: false, click: () => (a.clicked = true) }; links.push(a); return a; } });
	vi.stubGlobal('URL', { createObjectURL: (b: Blob) => (made.push(b), `blob:${made.length}`), revokeObjectURL: (u: string) => revoked.push(u) });
	download({ 'responses.csv': 'id\r\n', 'trees.csv': 'n\r\n' });
	vi.unstubAllGlobals();
	expect(links).toEqual([{ href: 'blob:1', download: 'responses.csv', clicked: true }, { href: 'blob:2', download: 'trees.csv', clicked: true }].map((l) => expect.objectContaining(l)));
	expect(revoked).toEqual(['blob:1', 'blob:2']);
	expect(await Promise.all(made.map((b) => b.text()))).toEqual(['id\r\n', 'n\r\n']);
	expect(made.map((b) => b.type)).toEqual(['text/csv', 'text/csv']);
});
