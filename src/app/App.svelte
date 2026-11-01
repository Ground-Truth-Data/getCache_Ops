<script lang="ts">
	import { brand } from '../brand';
	import { openDatabase } from '../data/db';
	import type { Ops } from '../plugin/api';
	import { makeOps, plugins, refusal } from '../plugin/host';

	let ops = $state<Ops>();
	let error = $state<string>();
	let source = $state('');
	let tab = $state(plugins[0].id);
	let over = $state(false);

	async function open(bytes: ArrayBuffer, name: string) {
		try {
			await openDatabase(bytes);
			ops = makeOps();
			source = name;
			error = undefined;
		} catch (e) {
			error = `${name} ${(e as Error).message}`;
		}
	}

	const trySample = async () => open(await (await fetch('/sample.sqlite')).arrayBuffer(), 'the sample season');

	async function openFile(file?: File) {
		if (file) open(await file.arrayBuffer(), file.name);
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		over = false;
		openFile(e.dataTransfer?.files[0]);
	}

	function mount(el: HTMLElement, [plugin, ops]: [(typeof plugins)[number], Ops]) {
		return { destroy: plugin.mount(el, ops) };
	}
</script>

<svelte:head><title>{brand.name}</title>{#if brand.logo}<link rel="icon" href={brand.logo} />{/if}</svelte:head>

<svelte:window ondragover={(e) => e.preventDefault()} ondrop={drop} />

<main class="mx-auto max-w-4xl p-6 font-sans" style:--accent={brand.accent}>
	<header class="mb-6 flex flex-wrap items-center gap-4">
		{#if brand.logo}<img src={brand.logo} alt="" class="h-10" />{/if}
		<h1 class="font-display text-3xl text-(--accent)">{brand.name}</h1>
		<button class="ml-auto rounded-lg bg-(--accent) px-3 py-1 font-display text-on-accent" onclick={trySample}>Try the sample season</button>
		<input id="pick" type="file" class="hidden" onchange={(e) => openFile(e.currentTarget.files?.[0])} />
	</header>

	{#if error}<p class="mb-4 text-red-400" data-error>{error}</p>{/if}
	{#if ops}
		<p class="mb-4 text-sm text-muted">
			Showing {source} · schema {ops.schemaVersion} · nothing leaves this computer · drop a file anywhere or
			<label for="pick" class="cursor-pointer text-(--accent) underline">choose one</label>
		</p>
	{/if}
	<nav class="mb-6 flex gap-2 border-b border-rule">
		{#each plugins as p (p.id)}
			<button
				class="-mb-px border-b-2 px-3 py-2 font-display disabled:opacity-40 {ops && tab === p.id ? 'border-(--accent) text-(--accent)' : 'border-transparent text-muted'}"
				disabled={!ops}
				onclick={() => (tab = p.id)}>{p.name}</button>
		{/each}
	</nav>
	{#if ops}
		{#each plugins.filter((p) => p.id === tab) as p (p.id + source)}
			{@const why = refusal(p, ops.schemaVersion)}
			{#if why}
				<p class="text-muted" data-refused={p.id}>{why}</p>
			{:else}
				<div use:mount={[p, ops]}></div>
			{/if}
		{/each}
	{:else}
		<label
			for="pick"
			class="flex min-h-[60vh] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-(--accent) p-6 text-center font-display text-2xl text-(--accent) {over ? 'bg-(--accent)/10' : ''}"
			ondragenter={() => (over = true)}
			ondragleave={() => (over = false)}
			data-dropzone>Drop a Get Cache backup to see charts and tables</label>
	{/if}
</main>
