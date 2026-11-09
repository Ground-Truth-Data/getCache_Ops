// A Get Cache Ops report. Ops runs this file in a box: no network, no sign-in, no Ops page around it.
// Ask Ops for the rows of a table your manifest lists; Ops' Export button asks you for a file.

let next = 0;
const waiting = new Map();
const rows = (table) =>
	new Promise((ok, fail) => {
		waiting.set(++next, { ok, fail });
		parent.postMessage({ id: next, rows: table }, '*');
	});

let csv = '';
addEventListener('message', ({ data }) => {
	if (data?.export) return parent.postMessage({ file: { name: 'trees-by-day.csv', text: csv } }, '*');
	const w = waiting.get(data?.id);
	if (!w) return;
	waiting.delete(data.id);
	data.error ? w.fail(new Error(data.error)) : w.ok(data.rows);
});

(async () => {
	const [bags, tallies] = await Promise.all([rows('bagUpView'), rows('tallyView')]);
	const day = new Map(bags.map((b) => [b.bagUpKey, b.plantedDt]));
	const trees = new Map();
	for (const t of tallies) trees.set(day.get(t.bagUpKey), (trees.get(day.get(t.bagUpKey)) ?? 0) + (t.plantedQty ?? 0));
	const days = [...trees].filter(([d]) => d).sort(([a], [b]) => (a < b ? 1 : -1));
	csv = ['day,trees', ...days.map(([d, n]) => `${d},${n}`)].join('\n');

	document.body.style.cssText = 'font: 16px system-ui; color: #eee; background: #1d2a24; margin: 16px';
	document.body.innerHTML = `<h2>Trees by day</h2><table data-days>${days
		.map(([d, n]) => `<tr><td>${d}</td><td style="text-align:right;padding-left:2em">${n}</td></tr>`)
		.join('')}</table>${days.length ? '' : '<p>No planting yet.</p>'}`;
})();
