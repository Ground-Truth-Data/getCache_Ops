import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	// Pre-bundling breaks the WASM file's relative URL.
	optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
});
