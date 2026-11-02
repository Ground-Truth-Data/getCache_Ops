// _rapper/ is GENERATED from rapper's last commit: the admin table kit and the
// Get Cache tokens it paints with, so every Ops table is admin's code. Beside a
// fetch workspace it is rewritten on every dev, build and test; alone (Vercel, a
// fork) the committed copy is used. Edit in ~/DEV/fetch/rapper, never here.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

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

if (existsSync(`${rapper}/.git`)) {
	rmSync('_rapper', { recursive: true, force: true });
	mkdirSync('_rapper');
	execSync(`git -C ${rapper} archive HEAD ${files.join(' ')} | tar -x -C _rapper`, { stdio: 'inherit' });
}
