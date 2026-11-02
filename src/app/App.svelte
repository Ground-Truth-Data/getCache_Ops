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

	const pages = [['', 'Home'], ['season', 'Season'], ['reports', 'Reports'], ...customs.map((p) => [`p/${p.id}`, p.name]), ['advanced', 'Advanced']];
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

	const trySample = async () => open(await (await fetch('sample.sqlite')).arrayBuffer(), 'the sample season');

	const LIVE = 'your Get Cache account';
	const account = signedIn();
	let synced = $state<Date>();
	if (account)
		follow(
			(bytes, syncedAt?: string) => {
				if (source && source !== LIVE) return;
				synced = syncedAt ? new Date(syncedAt) : undefined;
				open(bytes, LIVE);
			},
		);
	const live = $derived(source === LIVE);

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

<svelte:window ondragover={(e) => e.preventDefault()} ondrop={drop} onhashchange={() => (hash = location.hash)} />

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
					class="rounded-lg px-3 py-1 font-display text-lg {page[0] === path ? 'bg-(--accent) text-on-accent' : 'text-muted hover:text-ink'}">{label}</a>
			{/each}
			<button class="ml-auto rounded-lg border border-(--accent) px-3 py-1 font-display text-(--accent)" onclick={trySample}>Try the sample season</button>
			<input id="pick" type="file" class="hidden" onchange={(e) => openFile(e.currentTarget.files?.[0])} />
		</nav>
		<p class="mx-auto max-w-5xl px-6 pb-2 text-sm text-muted" data-status>
			{#if account && (live || !ops)}
				Your Get Cache account · {account.email} · {!ops ? 'fetching your data' : synced ? `last synced ${synced.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : 'not synced yet'}
			{:else if ops}
				Showing {source} · schema {ops.schemaVersion} · nothing leaves this computer ·
				<label for="pick" class="cursor-pointer text-(--accent) underline">open another file</label>
			{:else}
				<a href="/app/account" target="_blank" class="text-(--accent) underline" data-signin>Sign in to see your data automatically</a>
				· or <label for="pick" class="cursor-pointer text-(--accent) underline">drop a backup</label>
				· or <button class="text-(--accent) underline" onclick={trySample}>try the sample season</button>
			{/if}
		</p>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-6">
		{#if error}<p class="mb-4 text-muted" data-error>{error}</p>{/if}
		{#if page[0] === ''}
			<h1 class="mb-6 font-display text-3xl text-(--accent)">Your season at a glance</h1>
			<div class="grid gap-4 sm:grid-cols-3">
				{#each [['season', 'Season', 'Charts of trees planted, blocks and seedlots'], ['reports', 'Reports', 'Five plain tables to sort, search and export'], ['advanced', 'Advanced', 'Every raw table, for builders']] as [path, title, blurb] (path)}
					<a href="#/{path}" class="rounded-2xl border border-rule p-6 hover:border-(--accent)" data-card={path}>
						<span class="block font-display text-2xl text-(--accent)">{title}</span>
						<span class="mt-2 block text-muted">{blurb}</span>
					</a>
				{/each}
			</div>
		{:else if page[0] === 'reports'}
			<Reports {ops} slug={parts[1]} />
		{:else}
			<h1 class="mb-6 font-display text-3xl text-(--accent)">{page[1]}</h1>
			{#if page[0] === 'advanced'}
				<p class="mb-4 text-sm text-muted" data-warning>Raw tables change between versions. Reports are the stable way to build.</p>
				{#if ops}<Advanced {ops} />{:else}<p class="text-muted" data-nodata>No data yet</p>{/if}
			{:else if ops && plugin}
				{#key plugin.id + source}
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
