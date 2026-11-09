import { defineConfig, devices } from '@playwright/test';

// Ops' browser tests, on a dev server of their own: :5194 is whoever is working on Ops.
// *.e2e.ts, so vitest's own *.test/*.spec glob never loads them.
const port = 5195;

export default defineConfig({
	testDir: './e2e',
	testMatch: '*.e2e.ts',
	outputDir: '.test',
	timeout: 60_000,
	reporter: 'list',
	use: { baseURL: `http://127.0.0.1:${port}/ops/` },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
	],
	webServer: { command: `npx vite --port ${port}`, url: `http://127.0.0.1:${port}/ops/`, reuseExistingServer: false, timeout: 60_000 },
});
