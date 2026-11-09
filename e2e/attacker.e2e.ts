import { expect, test } from '@playwright/test';
import dgram from 'node:dgram';
import { readFileSync } from 'node:fs';
import http from 'node:http';

// Card 143's permanent attacker: a report that tries every way out of its box. Nothing may reach the attacker's
// server or UDP port, read Ops' cookie or page, move Ops' page, or get rows its manifest never listed.
const attacker = readFileSync(new URL('./attacker.js', import.meta.url), 'utf8');
const sample = new URL('../public/sample.sqlite', import.meta.url).pathname;

test('a report cannot get out of its box', async ({ page, context, baseURL }) => {
	const reached: string[] = [];
	const evil = http.createServer((req, res) => (reached.push(`${req.method} ${req.url}`), res.end('ok')));
	await new Promise<void>((ok) => evil.listen(0, '127.0.0.1', ok));
	const udp = dgram.createSocket('udp4');
	udp.on('message', () => reached.push('udp'));
	await new Promise<void>((ok) => udp.bind(0, '127.0.0.1', ok));
	const E = `http://127.0.0.1:${(evil.address() as { port: number }).port}`;
	const said: string[] = [];
	page.on('console', (m) => m.text().startsWith('[attack]') && said.push(m.text().slice(9)));
	try {
		await context.addCookies([{ name: 'opsSecret', value: 'cookie-s3cret', url: baseURL! }]);
		await page.route((url) => url.pathname.endsWith('/starters/report/report.js') && !url.search, (r) =>
			r.fulfill({ contentType: 'text/javascript', body: attacker.replace("'EVIL'", JSON.stringify(E)).replace('UDP', String((udp.address() as { port: number }).port)) }),
		);
		await page.goto('./');
		await page.locator('input[type=file]').setInputFiles(sample);
		await page.getByRole('link', { name: 'Sample report' }).click();
		await page.locator('[data-allow]').click();
		const box = page.frameLocator('[data-box]');
		await box.locator('input[name=email]').fill('planter@example.com');
		await box.locator('input[name=password]').fill('hunter2');
		await box.locator('button').click();
		await expect.poll(() => said.filter((s) => s.startsWith('rows')).length).toBe(2);
		// Long enough for the 1.5 s self-navigation and the 2 s refresh.
		await page.waitForTimeout(3_500);

		expect(said).toContain('ran');
		expect(said.join('\n')).not.toContain('cookie-s3cret');
		// Chromium throws; WebKit hands a sandboxed page an empty jar.
		expect(said.find((s) => s.startsWith('cookie:'))).toMatch(/^cookie: (threw SecurityError)?$/);
		expect(said).toEqual(
			expect.arrayContaining([
				'parent: threw SecurityError',
				'storage: threw SecurityError',
				'rtc: threw ReferenceError',
				'fetch: refused',
				'rows 1: Sample report was not allowed personEntity.',
				'rows 2: Sample report was not allowed tallyView", personEntity --.',
			]),
		);
		expect(said.filter((s) => s.startsWith('kid rtc')), 'its own code ran in a nested frame').toEqual([]);
		expect(said.filter((s) => s.startsWith('rows 3')), 'Ops answered a raw SQL request').toEqual([]);
		expect(new URL(page.url()).pathname).toBe('/ops/p/starter');
		expect(reached).toEqual([]);
	} finally {
		evil.close();
		udp.close();
	}
});

test('the sample report shows the open file after the permission page', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack}`));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.goto('./');
	await page.locator('input[type=file]').setInputFiles(sample);
	await page.getByRole('link', { name: 'Sample report' }).click();
	await expect(page.locator('[data-permission=starter]')).toContainText('bagUpView');
	await page.locator('[data-allow]').click();
	const days = page.frameLocator('[data-box]').locator('[data-days] tr');
	await expect(days.first()).toBeVisible();
	expect(await days.count()).toBeGreaterThan(5);
	const download = page.waitForEvent('download');
	await page.locator('[data-export]').click();
	expect((await download).suggestedFilename()).toBe('trees-by-day.csv');
	expect(errors).toEqual([]);
});
