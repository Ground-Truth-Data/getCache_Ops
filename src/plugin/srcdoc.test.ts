import { expect, test } from 'vitest';
import { answer, type Report, srcdoc } from './host';

const report: Report = { id: 'x', name: 'X', url: 'https://x.test/x.js', tables: ['tallyView', 'odd"name'] };

const sha = async (s: string) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))));
const script = (page: string) => page.slice(page.indexOf('<script>') + 8, page.lastIndexOf('</script>'));

test("the box's page runs only its own script, by hash, with no network, frames or workers", async () => {
	const page = await srcdoc('draw()');
	const csp = /content="([^"]+)"/.exec(page)![1];
	expect(csp).toContain(`script-src 'sha256-${await sha(script(page))}'`);
	for (const rule of ["default-src 'none'", "frame-src 'none'", "worker-src 'none'", "form-action 'none'", "base-uri 'none'"]) expect(csp).toContain(rule);
});

test('Ops strips WebRTC before the report runs, in the same script', async () => {
	const s = script(await srcdoc('draw()'));
	expect(s.indexOf('RTC|WebTransport')).toBeGreaterThan(-1);
	expect(s.indexOf('RTC|WebTransport')).toBeLessThan(s.indexOf('draw()'));
});

// The parser ends a script at </script in any case; ended early, the page's hash no longer matches and the report never runs.
test('a report whose text holds a closing script tag, in any case, still runs whole', async () => {
	const page = await srcdoc('x = "</script>"; y = "</SCRIPT >"; z = "</Script"');
	expect(page.match(/<\/script/gi)).toHaveLength(1);
	expect(page.endsWith('</script>')).toBe(true);
});

test("a table name with a quote stays one identifier, and a query that throws comes back as the request's error", () => {
	const seen: string[] = [];
	expect(answer(report, { id: 3, rows: 'odd"name' }, (sql) => (seen.push(sql), []))).toEqual({ id: 3, rows: [] });
	expect(seen).toEqual(['SELECT * FROM "odd""name"']);
	expect(
		answer(report, { id: 4, rows: 'tallyView' }, () => {
			throw new Error('no such table: tallyView');
		}),
	).toEqual({ id: 4, error: 'no such table: tallyView' });
});
