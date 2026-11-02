<script lang="ts">
	import { brand } from '../brand';
	import { follow, signedIn } from '../data/cloud';
	import { openDatabase } from '../data/db';
	import type { Ops, Plugin } from '../plugin/api';
	import { customs, makeOps, refusal, season } from '../plugin/host';
	import { VERSION } from '../version';
	import Advanced from './Advanced.svelte';
	import Reports from './Reports.svelte';

	let ops = $state<Ops>();
	let error = $state<string>();
	let source = $state('');
	let hash = $state(location.hash);

	// Home is the reports: #/reports/<slug> falls through to it.
	const pages = [['', 'Home'], ['season', 'Season'], ...customs.map((p) => [`p/${p.id}`, p.name]), ['advanced', 'Advanced']];
	const parts = $derived(hash.replace(/^#\/?/, '').split('?')[0].split('/'));
	const page = $derived(pages.find(([path]) => path === parts.slice(0, parts[0] === 'p' ? 2 : 1).join('/')) ?? pages[0]);
	const plugin = $derived(page[0] === 'season' ? season : customs.find((p) => page[0] === `p/${p.id}`));

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
	watch();
	let pick = $state<HTMLInputElement>();

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

<svelte:head><title>{brand.name}</title>{#if brand.logo}<link rel="icon" href={brand.logo} />{/if}</svelte:head>

<svelte:window ondragover={(e) => e.preventDefault()} ondrop={drop} onhashchange={() => (hash = location.hash)} onfocus={watch} />

<div class="font-sans" style:--accent={brand.accent}>
	<header class="sticky top-0 z-10 border-b border-rule bg-ground">
		<nav class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-6 py-3">
			<a href="#/" class="mr-4 flex items-center gap-2 font-display text-2xl text-(--accent)" data-home>
				{#if brand.logo}<img src={brand.logo} alt="" class="h-8" />{/if}{brand.name}
			</a>
			{#each pages as [path, label] (path)}
				<a
					href="#/{path}"
					aria-current={page[0] === path ? 'page' : undefined}
					class="flex items-center gap-1.5 rounded-lg px-3 py-1 font-display text-lg {page[0] === path ? 'bg-(--accent) text-on-accent' : 'text-muted hover:bg-(--accent)/15 hover:text-ink'}"
					>{#if path === ''}<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5" /></svg>{/if}{label}</a>
			{/each}
			{#if source !== SAMPLE}
				<button class="ml-auto rounded-lg px-3 py-1 font-display text-lg text-muted hover:bg-(--accent)/15 hover:text-ink" onclick={trySample} data-sample>Sample</button>
			{:else if account}
				<!-- The account copy is cached, so a reload brings it straight back. -->
				<button class="ml-auto rounded-lg px-3 py-1 font-display text-lg text-muted hover:bg-(--accent)/15 hover:text-ink" onclick={() => location.reload()} data-sample>My season</button>
			{/if}
			<button class="{source === SAMPLE && !account ? 'ml-auto' : ''} rounded-lg p-2 text-muted hover:bg-(--accent)/15 hover:text-(--accent)" title="Import a backup" aria-label="Import a backup" onclick={() => pick?.click()} data-import>
				<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
			</button>
			<input bind:this={pick} type="file" class="hidden" onchange={(e) => openFile(e.currentTarget.files?.[0])} />
		</nav>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-6">
		{#if error}<p class="mb-4 text-muted" data-error>{error}</p>{/if}
		{#if page[0] === ''}
			{#if !account}
				<p class="mb-6 text-muted" data-signin>
					<a href="/app/account" target="_blank" class="text-(--accent) underline hover:opacity-80">Sign in to see your data automatically</a>
				</p>
			{/if}
			<Reports {ops} slug={parts[0] === 'reports' ? parts[1] : undefined} />
		{:else}
			<h1 class="mb-6 font-display text-3xl text-(--accent)">{page[1]}</h1>
			{#if page[0] === 'advanced'}
				<p class="mb-4 text-sm text-muted" data-warning>Raw tables change between versions. Reports are the stable way to build.</p>
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
