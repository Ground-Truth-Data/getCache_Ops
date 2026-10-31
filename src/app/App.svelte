<script lang="ts">
	import { brand } from '../brand';
	import { openDatabase } from '../data/db';
	import type { Ops } from '../plugin/api';
	import { makeOps, plugins, refusal } from '../plugin/host';

	let ops = $state<Ops>();
	let error = $state<string>();
	let source = $state('');
	let tab = $state(plugins[0].id);

	async function open(bytes: ArrayBuffer, name: string) {
		try {
			await openDatabase(bytes);
			ops = makeOps();
			source = name;
			error = undefined;
		} catch (e) {
			error = `${name}: ${(e as Error).message}`;
		}
	}

	const trySample = async () => open(await (await fetch('/sample.sqlite')).arrayBuffer(), 'the sample season');
	trySample();

	async function pick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) open(await file.arrayBuffer(), file.name);
	}

	function mount(el: HTMLElement, [plugin, ops]: [(typeof plugins)[number], Ops]) {
		return { destroy: plugin.mount(el, ops) };
	}
</script>

<main class="mx-auto max-w-4xl p-6 font-sans" style:--accent={brand.accent}>
	<header class="mb-6 flex flex-wrap items-center gap-4">
		{#if brand.logo}<img src={brand.logo} alt="" class="h-10" />{/if}
		<h1 class="text-2xl font-semibold text-(--accent)">{brand.name}</h1>
		<label class="ml-auto cursor-pointer rounded border border-(--accent) px-3 py-1 text-sm text-(--accent)">
			Open a Get Cache file <input type="file" accept=".sqlite,.sqlite3,.db" class="hidden" onchange={pick} />
		</label>
		<button class="rounded bg-(--accent) px-3 py-1 text-sm text-white" onclick={trySample}>Try the sample season</button>
	</header>

	{#if error}
		<p class="text-red-600" data-error>{error}</p>
	{:else if ops}
		<p class="mb-4 text-sm text-gray-500">Showing {source} · schema {ops.schemaVersion} · nothing leaves this computer</p>
		<nav class="mb-6 flex gap-2 border-b border-gray-200">
			{#each plugins as p (p.id)}
				<button class="-mb-px border-b-2 px-3 py-2 {tab === p.id ? 'border-(--accent) font-medium' : 'border-transparent text-gray-500'}" onclick={() => (tab = p.id)}>
					{p.name}
				</button>
			{/each}
		</nav>
		{#each plugins.filter((p) => p.id === tab) as p (p.id + source)}
			{@const why = refusal(p, ops.schemaVersion)}
			{#if why}
				<p class="text-gray-600" data-refused={p.id}>{why}</p>
			{:else}
				<div use:mount={[p, ops]}></div>
			{/if}
		{/each}
	{:else}
		<p class="text-gray-500">Opening the sample season…</p>
	{/if}
</main>
