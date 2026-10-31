import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-svelte'],
	vite: () => ({
		plugins: [tailwindcss()],
		// Pre-bundling breaks the WASM file's relative URL.
		optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
	}),
	manifest: {
		name: 'getCache Ops',
		description: 'Open a SQLite file and see it as tables and charts.',
		permissions: ['storage'],
		action: {},
		content_security_policy: {
			extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
		},
	},
});
