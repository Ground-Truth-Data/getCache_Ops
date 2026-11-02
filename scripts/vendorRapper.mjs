// _rapper/ is GENERATED from rapper's last commit: the admin table kit and the
// Get Cache tokens it paints with, so every Ops table is admin's code. Beside a
// fetch workspace it is rewritten on every dev, build and test; alone (Vercel, a
// fork) the committed copy is used. Edit in ~/DEV/fetch/rapper, never here.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const rapper = '../fetch/rapper';
const files = [
	...['AdminDataTable', 'AdminPager', 'ColumnPicker', 'JsonPeek', 'Pill', 'SegmentedControl', 'TableToolbar'].map((f) => `rt/admin/${f}.svelte`),
	...['columnPrefs', 'exportRows', 'frozenLeft', 'sortRows'].map((f) => `rt/admin/${f}.ts`),
	'rt/admin/adminTable.css',
	'rt/admin/adminTokens.css',
	'gc/mobile.css',
	'gc/rowShell.css',
	'gc/fancyButton.css',
];

// Written in place and only when changed: a deleted and recreated folder drops out of Vite's watcher, which then serves the old kit.
if (existsSync(`${rapper}/.git`)) {
	for (const f of files) {
		const text = execFileSync('git', ['-C', rapper, 'show', `HEAD:${f}`], { encoding: 'utf8' });
		const to = `_rapper/${f}`;
		if (existsSync(to) && readFileSync(to, 'utf8') === text) continue;
		mkdirSync(dirname(to), { recursive: true });
		writeFileSync(to, text);
	}
}
