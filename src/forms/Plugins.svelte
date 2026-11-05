<script lang="ts">
	import { renderSVG } from 'uqr';
	import SignIn from '../company/SignIn.svelte';
	import Builder from './Builder.svelte';
	import Report from './Report.svelte';
	import { addLink, copyPlugin, myPlugins, pluginStore, receive, received, receivedAnswers, type PluginRow } from './plugins';

	let { me, sub, id, signedInNow }: { me: { authId: string } | null; sub?: string; id?: string; signedInNow: () => void } = $props();

	let mine = $state<PluginRow[][]>([]);
	let inbox = $state<Awaited<ReturnType<typeof received>>>([]);
	let paste = $state('');
	let note = $state('');
	let pick = $state<HTMLInputElement>();

	async function load() {
		inbox = await received();
		if (!me) return;
		const by = new Map<string, PluginRow[]>();
		for (const p of await myPlugins(me.authId)) by.set(p.pluginId, [...(by.get(p.pluginId) ?? []), p]);
		mine = [...by.values()];
	}
	$effect(() => {
		void sub;
		load().catch((e) => (note = e.message));
	});

	const run = (fn: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await fn();
		} catch (e) {
			note = (e as Error).message;
		}
	};
	const copy = (pluginId: string) => run(async () => (location.hash = `#/plugins/edit/${await copyPlugin(pluginId)}`));
	const pasted = $derived(paste.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]);

	async function open(file?: File) {
		if (!file) return;
		await run(async () => {
			const added = await receive(new Uint8Array(await file.arrayBuffer()));
			const n = Object.values(added).reduce((a, b) => a + b, 0);
			note = n ? `${file.name}: ${added.answer} answers, ${added.answerRow} rows and ${added.photo} photos added.` : `${file.name}: nothing new, every row was already here.`;
			await load();
		})();
		if (pick) pick.value = '';
	}

	// The maker's page: the credit and logo travel with every version.
	let madeBy = $state('');
	let logo = $state<string | null>(null);
	let fixed = $state(false);
	const store = $derived(
		sub === 'edit' && id
			? pluginStore(id, () => ({ madeBy: madeBy.trim(), logo }), (rows) => {
					const last = rows.at(-1);
					if (last) ({ madeBy, logo } = last);
					fixed = rows.some((r) => r.publishedAt || r.copiedFrom);
				})
			: undefined,
	);
	function pickLogo(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		if (!file) return;
		const r = new FileReader();
		r.onload = () => ((note = ''), (r.result as string).length > 200_000 ? (note = 'Pick a smaller logo: under 140 KB.') : (logo = r.result as string));
		r.readAsDataURL(file);
	}

	let photos = new Map<string, string>();
	const input = 'rounded border border-rule bg-surface px-2 py-1';
</script>

{#snippet back(label = 'Plugins')}
	<a class="small-btn mb-6" href="#/plugins" data-back>← {label}</a>
{/snippet}

{#snippet credit()}
	<div class="flex flex-wrap items-center gap-4" data-credit>
		<label class="cursor-pointer" title="The logo on the phone">
			<img src={logo ?? 'plugin_gold.webp'} alt="" class="h-16 w-16 rounded-lg border border-rule object-contain" data-logo-shown />
			<input type="file" class="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={pickLogo} data-logo />
		</label>
		<input class="{input} w-64" placeholder="Made by" bind:value={madeBy} disabled={fixed} title={fixed ? 'A plugin keeps its maker’s credit' : 'Shown on the phone'} data-made-by />
	</div>
{/snippet}

{#if sub === 'edit' && store}
	{#key id}<Builder {store} back={['#/plugins', 'Plugins']} head={credit} />{/key}
{:else if sub === 'answers' && id}
	<Report load={() => receivedAnswers(id).then((a) => ((photos = a.photos), a))} back={['#/plugins', 'Plugins']} photo={(k) => photos.get(k)} />
{:else if sub === 'share' && id}
	{@const link = addLink(id)}
	{@render back()}
	<h1 class="mb-6 font-display text-5xl text-(--accent)">Share</h1>
	<div class="flex flex-wrap items-center gap-12" data-share>
		<div class="h-80 w-80 rounded-3xl bg-[#f4efe6] p-6" data-qr>{@html renderSVG(link)}</div>
		<div class="flex w-full max-w-md flex-col gap-5">
			<p class="text-lg">Anyone who opens this link or scans the code adds the plugin to Get Cache. No account needed.</p>
			<code class="text-sm break-all" data-link>{link}</code>
			<button class="big-btn gold rt-fancy-btn" onclick={() => navigator.clipboard.writeText(link)} data-copy-link>Copy link</button>
		</div>
	</div>
{:else}
	<h1 class="mb-6 font-display text-5xl text-(--accent)">Plugins</h1>
	{#if !me}
		<SignIn done={signedInNow} />
	{:else}
		<div class="flex max-w-3xl flex-col gap-3" data-mine>
			{#each mine as versions (versions[0].pluginId)}
				{@const last = versions.at(-1)!}
				{@const live = versions.findLast((v) => v.publishedAt)}
				<div class="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[#3a352e] bg-[#1a1a1a] px-5 py-3" data-plugin-row={last.definition.title}>
					<img src={last.logo ?? 'plugin_gold.webp'} alt="" class="h-12 w-12 rounded-lg object-contain" />
					<span class="flex flex-1 flex-col">
						<span class="font-display text-xl">{last.definition.title || 'Untitled'}</span>
						<span class="text-sm text-muted">{last.madeBy} · {live ? `version ${live.version}` : 'not published'}{last.publishedAt ? '' : ' · draft'}{versions[0].copiedFrom ? ' · a copy' : ''}</span>
					</span>
					<a class="small-btn" href="#/plugins/edit/{last.pluginId}" data-edit>Edit</a>
					{#if live}
						<a class="small-btn" href="#/plugins/share/{last.pluginId}" data-share-link>Share</a>
						<button class="small-btn" onclick={copy(last.pluginId)} data-copy>Copy</button>
					{/if}
				</div>
			{:else}
				<p class="text-muted">No plugins yet.</p>
			{/each}
		</div>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<a class="rt-fancy-btn rounded-lg px-4 py-1 font-display text-lg" href="#/plugins/edit/new" data-new>New plugin</a>
			<input class="{input} w-80 text-sm" placeholder="Paste a plugin's link to copy it" bind:value={paste} data-paste />
			<button class="small-btn" disabled={!pasted} onclick={() => pasted && copy(pasted)()} data-copy-pasted>Copy</button>
		</div>
	{/if}

	<h2 class="mt-12 mb-3 font-display text-3xl">Answers received</h2>
	<div class="flex max-w-3xl flex-col gap-2" data-received>
		{#each inbox as p (p.pluginId)}
			<a class="flex items-center gap-4 rounded-xl border border-rule px-4 py-2" href="#/plugins/answers/{p.pluginId}" data-received-row={p.title}>
				<span class="flex-1 font-display text-lg">{p.title}</span><span class="text-sm text-muted">{p.madeBy} · {p.answers} answers</span>
			</a>
		{:else}
			<p class="text-muted">None yet. A planter's Send makes a .getcache file: open it here.</p>
		{/each}
	</div>
	<button class="small-btn mt-4" onclick={() => pick?.click()} data-open-sent>Open a .getcache file</button>
	<input bind:this={pick} type="file" accept=".getcache" class="hidden" onchange={(e) => open(e.currentTarget.files?.[0])} data-sent-file />
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}
