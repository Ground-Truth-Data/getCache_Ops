import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
	// One build serves a company's own root and getcache.org/ops/; dev sits behind getCache's /ops proxy.
	base: command === 'serve' && !isPreview ? '/ops/' : './',
	// IPv4 explicitly: on localhost alone Vite can take just [::1] while another server holds 127.0.0.1.
	server: { host: '127.0.0.1', port: 5194, strictPort: true },
	// Supabase's public names keep their Bitwarden spelling, PUBLIC_ prefix and all.
	envPrefix: ['VITE_', 'PUBLIC_'],
	plugins: [svelte(), tailwindcss()],
	// Pre-bundling breaks the WASM file's relative URL.
	optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
}));
