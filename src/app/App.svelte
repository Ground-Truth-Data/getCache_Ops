<script lang="ts">
	import { brand } from '../brand';
	import { follow, signedIn } from '../data/cloud';
	import { openDatabase } from '../data/db';
	import type { Ops, Plugin } from '../plugin/api';
	import { customs, makeOps, refusal } from '../plugin/host';
	import { VERSION } from '../version';
	import Pill from '../../_rapper/rt/admin/Pill.svelte';
	import Advanced from './Advanced.svelte';
	import Custom from './Custom.svelte';
	import Reports from './Reports.svelte';

	let ops = $state<Ops>();
	let error = $state<string>();
	let source = $state('');
	let hash = $state(location.hash);

	// Home is the reports.
	const pages = [['reports', 'Reports'], ...customs.map((p) => [`p/${p.id}`, p.name]), ['custom', 'Custom'], ['advanced', 'Advanced']];
	const parts = $derived(hash.replace(/^#\/?/, '').split('?')[0].split('/'));
	const page = $derived(pages.find(([path]) => path === parts.slice(0, parts[0] === 'p' ? 2 : 1).join('/')) ?? pages[0]);
	const plugin = $derived(customs.find((p) => page[0] === `p/${p.id}`));

	async function open(bytes: ArrayBuffer | Uint8Array, name: string) {
		try {
			await openDatabase(bytes);
			ops = makeOps();
			source = name;
			error = undefined;
		} catch (e) {
			error = `${name} ${(e as Error).message}`;
		}
	}


	const SAMPLE = 'the sample season';
	const trySample = async () => open(await (await fetch('sample.sqlite')).arrayBuffer(), SAMPLE);
	const LIVE = 'your Get Cache account';
	let account = $state<ReturnType<typeof signedIn>>(null);
	// Again on coming back from the app's tab, where the planter signed in or the app refreshed the token.
	function watch() {
		if (account || !(account = signedIn())) return;
		follow(
			(bytes) => {
				if (source && source !== LIVE) return;
				open(bytes, LIVE);
			},
			() => (account = null),
		);
	}
	// Only Get Cache's own site can read the planter's file and sign-in: a popup there sends a copy here.
	const HOME = location.hostname.endsWith('localhost') ? location.origin : 'https://getcache.org';
	const PHONE = 'your Get Cache data';
	const askHome = () => window.open(`${HOME}/share?to=${encodeURIComponent(location.origin)}`, 'getcache', 'popup,width=420,height=640');
	function received(e: MessageEvent) {
		if (e.origin === HOME && e.data?.getcache) open(e.data.getcache, PHONE);
	}

	// On Get Cache's own site, the app's file is this browser's newest data, unsent rows included (OPS_READ.md).
	const LOCAL = "this browser's Get Cache data";
	const WORK = ['mapFeatureEntity', 'qaPlotEntity', 'bagUpEntity', 'tallyEntity', 'blockEntity'];
	async function local() {
		if (location.origin !== HOME || (source && source !== LOCAL)) return;
		const file = await navigator.storage.getDirectory().then((d) => d.getFileHandle('getcache-v57.sqlite3')).then((h) => h.getFile(), () => null);
		if (!file) return;
		await open(await file.arrayBuffer(), LOCAL);
		// A file the app was born with holds no work: leave the page to the cloud copy.
		if (ops && !ops.query(`SELECT ${WORK.map((t) => `(SELECT count(*) FROM ${t})`).join(' + ')} AS n`)[0]?.n) ((ops = undefined), (source = ''));
	}
	let tried = $state(false);
	local().finally(() => ((tried = true), watch()));
	const why = $derived(
		ops || !tried || account ? '' : location.origin === HOME ? "No Get Cache data in this browser yet, and no Get Cache sign-in here." : 'No data yet: use Sync Get Cache, or drop a backup file.',
	);
	const focused = () => (watch(), source === LOCAL && local());
	let pick = $state<HTMLInputElement>();
	let headHeight = $state(0);

	async function openFile(file?: File) {
		if (file) open(await file.arrayBuffer(), file.name);
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		openFile(e.dataTransfer?.files[0]);
	}

	function mount(el: HTMLElement, [plugin, ops]: [Plugin, Ops]) {
		return { destroy: plugin.mount(el, ops) };
	}
</script>

<svelte:head><title>{brand.name}</title><link rel="icon" type="image/png" href={brand.icon} /></svelte:head>

<svelte:window ondragover={(e) => e.preventDefault()} ondrop={drop} onhashchange={() => (hash = location.hash)} onfocus={focused} onmessage={received} />

<!-- --site-head: where a table's frozen header row docks, flush under this header whatever its wrapped height. -->
<div class="font-sans" style:--accent={brand.accent} style:--rt-yellow={brand.accent} style:--site-head="{headHeight}px">
	<header class="sticky top-0 z-10 border-b border-rule bg-ground" bind:offsetHeight={headHeight}>
		<nav class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-6 py-3">
			<a href="#/" class="mr-4 flex items-center gap-2 font-display text-2xl text-(--accent)" data-home>
				{#each brand.logos as src, i (src)}<img {src} alt={i ? '' : brand.name} class="h-10" />{:else}{brand.name}{/each}
			</a>
			{#each pages as [path, label] (path)}
				<Pill href="#/{path}" active={page[0] === path}>{label}</Pill>
			{/each}
			<button class="rt-fancy-btn ml-auto rounded-lg px-3 py-1 font-display text-lg" onclick={askHome} data-ask><img src="sync.webp" alt="" class="-my-2 mr-0.5 inline h-8 align-middle brightness-0" />Sync Get Cache</button>
			{#if source !== SAMPLE}
				<button class="rounded-lg px-3 py-1 font-display text-lg text-muted hover:bg-(--accent)/15 hover:text-ink" onclick={trySample} data-sample>Sample</button>
			{:else if account}
				<!-- The account copy is cached, so a reload brings it straight back. -->
				<button class="rounded-lg px-3 py-1 font-display text-lg text-muted hover:bg-(--accent)/15 hover:text-ink" onclick={() => location.reload()} data-sample>My season</button>
			{/if}
			<button class="rounded-lg p-2 text-muted hover:bg-(--accent)/15 hover:text-(--accent)" title="Import a backup" aria-label="Import a backup" onclick={() => pick?.click()} data-import>
				<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
			</button>
			<input bind:this={pick} type="file" class="hidden" onchange={(e) => openFile(e.currentTarget.files?.[0])} />
		</nav>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-6">
		{#if error}<p class="mb-4 text-muted" data-error>{error}</p>{/if}
		{#if why}<p class="mb-4 text-muted" data-why>{why}</p>{/if}
		{#if page[0] === 'reports'}
			<Reports {ops} slug={parts[1]} />
		{:else}
			<h1 class="mb-6 font-display text-3xl text-(--accent)">{page[0] === 'advanced' ? 'Write SQL queries' : page[1]}</h1>
			{#if page[0] === 'custom'}
				<p class="mb-4 text-sm text-muted" data-warning>Raw tables change between versions. Reports are the stable way to build.</p>
				{#if ops}<Custom {ops} />{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
			{:else if page[0] === 'advanced'}
				{#if ops}<Advanced {ops} />{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
			{:else if ops && plugin}
				<!-- Each copy is a new ops: a live copy keeps one `source`, so keying on it froze the first. -->
				{#key [plugin, ops]}
					{@const why = refusal(plugin, ops.schemaVersion)}
					{#if why}
						<p class="text-muted" data-refused={plugin.id}>{why}</p>
					{:else}
						<div use:mount={[plugin, ops]}></div>
					{/if}
				{/key}
			{:else}
				<p class="text-muted" data-nodata>No data yet</p>
			{/if}
		{/if}
	</main>

	<span class="fixed right-3 bottom-3 rounded-md border border-rule bg-ground px-2 py-0.5 font-display text-sm text-muted" title="Version" data-version>{VERSION}</span>
</div>
