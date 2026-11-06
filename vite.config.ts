import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
	// One build serves a company's own root and getcache.org/ops/; dev sits behind getCache's /ops proxy.
	base: command === 'serve' && !isPreview ? '/ops/' : './',
	// IPv4 explicitly: on localhost alone Vite can take just [::1] while another server holds 127.0.0.1.
	// <slug>.ops.localhost is a company's own address in dev, as <slug>.getcacheops.org is in prod.
	server: { host: '127.0.0.1', port: 5194, strictPort: true, allowedHosts: ['.ops.localhost'] },
	// Supabase's public names keep their Bitwarden spelling, PUBLIC_ prefix and all.
	envPrefix: ['VITE_', 'PUBLIC_'],
	plugins: [svelte(), tailwindcss()],
	// rapper's $parent is whichever app serves it: Ops answers for its own strings, as Get Cache does for its.
	resolve: { alias: { $parent: fileURLToPath(new URL('.', import.meta.url)) } },
	// Pre-bundling breaks the WASM file's relative URL.
	optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
}));
