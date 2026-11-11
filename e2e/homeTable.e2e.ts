import { type Page, expect, test } from '@playwright/test';

// The sample's tallies are CAD and USD, and there are 914 of them.
const sample = new URL('../public/sample.sqlite', import.meta.url).pathname;

async function openHome(page: Page) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('./');
	await page.locator('input[type=file]').setInputFiles(sample);
	await page.locator('[data-table] tbody tr').first().waitFor();
}

test('Home is one tally table with one header and a currency column, 50 rows a page', async ({ page }) => {
	await openHome(page);
	const table = page.locator('[data-table="Planting"]');
	await expect(table.locator('table')).toHaveCount(1);
	await expect(table.locator('thead tr:not(.subtotal)')).toHaveCount(1);
	await expect(table.locator('thead th', { hasText: /^currency/ })).toHaveCount(1);
	await expect(table.locator('tbody tr')).toHaveCount(50);
	await table.getByRole('link', { name: /next/i }).click();
	await expect(table.locator('tbody tr')).toHaveCount(50);
	await expect(table.locator('tbody td').first()).toBeVisible();
});

/** Rows of pixels in the strip from the nav's bottom to the frozen band's bottom that change when the body rows are hidden. */
async function rowPixelsAboveBand(page: Page) {
	const strip = await page.evaluate(() => {
		const nav = document.querySelector('header')!.getBoundingClientRect();
		const band = document.querySelector('[data-table] thead')!.getBoundingClientRect();
		return { y: Math.floor(nav.bottom), bottom: Math.floor(band.bottom) };
	});
	const clip = { x: 0, y: strip.y, width: 1280, height: strip.bottom - strip.y };
	const shown = await page.screenshot({ clip });
	const hide = (on: boolean) => page.evaluate((on) => document.querySelectorAll<HTMLElement>('[data-table] tbody').forEach((b) => (b.style.visibility = on ? 'hidden' : '')), on);
	await hide(true);
	const hidden = await page.screenshot({ clip });
	await hide(false);
	return page.evaluate(async ([a, b, top]) => {
		const pixels = async (b64: string) => {
			const img = new Image();
			img.src = `data:image/png;base64,${b64}`;
			await img.decode();
			const c = new OffscreenCanvas(img.width, img.height);
			const g = c.getContext('2d')!;
			g.drawImage(img, 0, 0);
			return { data: g.getImageData(0, 0, img.width, img.height).data, w: img.width };
		};
		const [{ data: p, w }, { data: q }] = [await pixels(a), await pixels(b)];
		const lines = new Map<number, [number, number, number]>();
		for (let i = 0; i < p.length; i += 4)
			if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 30) {
				const [x, y] = [(i / 4) % w, Math.floor(i / 4 / w)];
				const [n, from] = lines.get(y) ?? [0, x];
				lines.set(y, [n + 1, from, x]);
			}
		return [...lines].map(([y, [n, from, to]]) => `${n} px on y ${top + y}, x ${from}–${to}`).join('; ');
	}, [shown.toString('base64'), hidden.toString('base64'), clip.y] as const);
}

// The frozen-header law (TreePS/KANBAN.md): nothing shows between the nav and the frozen header, and no row peeks
// through it. A subpixel seam is one row of pixels, so the band is checked at many scroll offsets.
test('no row shows above or through the frozen header, at any scroll offset', async ({ page, browserName }) => {
	test.fixme(browserName === 'webkit', 'WebKit paints the frozen left body cells over the band: an open bug, not a pass');
	await openHome(page);
	const leaks: string[] = [];
	for (const y of [300, 517, 700, 913, 1234, 1777]) {
		await page.evaluate((y) => scrollTo(0, y), y);
		await page.waitForTimeout(100);
		const seen = await rowPixelsAboveBand(page);
		if (seen) leaks.push(`scrollY ${y}: ${seen}`);
	}
	expect(leaks).toEqual([]);
});
