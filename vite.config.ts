import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
	// One build serves a company's own root and getcache.org/ops/; dev sits behind getCache's /ops proxy.
	base: command === 'build' ? './' : '/ops/',
	server: { port: 5190, strictPort: true },
	plugins: [svelte(), tailwindcss()],
	// Pre-bundling breaks the WASM file's relative URL.
	optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
}));
