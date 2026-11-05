<script lang="ts">
	import { renderSVG } from 'uqr';
	import SignIn from '../company/SignIn.svelte';
	import Builder from './Builder.svelte';
	import Report from './Report.svelte';
	import { session } from '../data/auth';
	import { addLink, copyPlugin, live, myPlugins, pluginStore, receive, received, receivedAnswers, SignInNeeded, type PluginRow } from './plugins';

	let { me, sub, id, signedInNow }: { me: { authId: string } | null; sub?: string; id?: string; signedInNow: () => void } = $props();

	let mine = $state<PluginRow[][]>([]);
	let inbox = $state<Awaited<ReturnType<typeof received>>>([]);
	let note = $state('');
	let info = $state(false);
	let pick = $state<HTMLInputElement>();
	let shared = $state<PluginRow>();

	async function load() {
		inbox = await received();
		mine = await myPlugins(me?.authId);
		shared = sub === 'share' && id ? await live(id) : undefined;
	}
	$effect(() => {
		void [sub, id];
		load().catch((e) => (note = e.message));
	});
	const answers = $derived(new Map(inbox.map((p) => [p.pluginId, p.answers])));
	// Plugins made elsewhere whose answers came in a sent file: their tile opens the answers.
	const others = $derived(inbox.filter((p) => !mine.some((v) => v[0].pluginId === p.pluginId)));

	const run = (fn: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await fn();
		} catch (e) {
			note = (e as Error).message;
		}
	};
	const copy = (pluginId: string) => run(async () => (location.hash = `#/plugins/edit/${await copyPlugin(pluginId)}`));

	async function open(file?: File) {
		if (file) await run(async () => (await receive(new Uint8Array(await file.arrayBuffer())), await load()))();
		if (pick) pick.value = '';
	}

	// The credit is the publishing account's name, set by Central; the logo travels with every version.
	let madeBy = $state<string>();
	let logo = $state<string | null>(null);
	// Set when Publish needs an account: the sign-in shows then, and goes once the session is back.
	let asking = $state(false);
	const store = $derived.by(() => {
		if (sub !== 'edit' || !id) return undefined;
		const s = pluginStore(id, () => ({ logo }), (rows) => {
			logo = rows.at(-1)?.logo ?? null;
			madeBy = rows.findLast((r) => r.publishedAt)?.madeBy;
		});
		return {
			...s,
			publish: (d?: string) =>
				s.publish(d).then(
					() => (location.hash = `#/plugins/share/${location.hash.split('/').at(-1)}`),
					(e) => ((asking = e instanceof SignInNeeded), Promise.reject(e)),
				),
		};
	});
	function pickLogo(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		if (!file) return;
		const r = new FileReader();
		r.onload = () => ((note = ''), (r.result as string).length > 200_000 ? (note = 'Pick a smaller logo: under 140 KB.') : (logo = r.result as string));
		r.readAsDataURL(file);
	}

	let photos = new Map<string, string>();
	let copied = $state(false);
	const chip = 'rounded-full px-3.5 py-1.5 text-[0.95rem] font-bold';
</script>

<!-- Signing in happens in the app's own tab on Get Cache's site: coming back is when the session can be there. -->
<svelte:window onfocus={() => (asking &&= !session())} />

{#snippet mark(src: string | null, size: string)}
	<img src={src ?? 'plugin_gold.webp'} alt="" class="{size} shrink-0 rounded-2xl object-contain" />
{/snippet}

{#if sub === 'edit' && store}
	{#snippet logoPick()}
		<label class="cursor-pointer rounded-2xl border-2 border-dashed border-[#6b6458]" title="Change the logo" data-logo-pick>
			{@render mark(logo, 'h-16 w-16')}
			<input type="file" class="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={pickLogo} data-logo />
		</label>
	{/snippet}
	{#snippet byline()}
		{#if madeBy}<span class="text-[#c9c3b7]" data-credit>Made by {madeBy}</span>{/if}
	{/snippet}
	{#key id}<Builder {store} back={['#/plugins', 'Plugins']} logo={logoPick} {byline} meta={logo} />{/key}
	{#if asking}<div class="mt-6" data-publish-signin><SignIn done={() => ((asking = false), signedInNow())} /></div>{/if}
{:else if sub === 'answers' && id}
	<Report load={() => receivedAnswers(id).then((a) => ((photos = a.photos), a))} back={['#/plugins', 'Plugins']} photo={(k) => photos.get(k)} />
{:else if sub === 'share' && id}
	{@const link = addLink(id)}
	<header class="mb-8 flex flex-wrap items-center gap-4 border-b border-rule pb-5 print:hidden">
		<a class="small-btn" href="#/plugins/edit/{id}" data-back
			><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Edit</a
		>
		{#if shared}
			{@render mark(shared.logo, 'h-16 w-16')}
			<span class="flex-1 font-display text-4xl">{shared.definition.title}</span>
			<span class="flex items-center gap-2 rounded-full bg-[#22301f] px-4 py-2 text-lg font-bold text-[#9bd28f]" data-published
				><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>v{shared.version} published</span
			>
		{/if}
	</header>
	<div class="flex flex-wrap items-center justify-center gap-16 print:hidden" data-share>
		<div class="aspect-square w-full max-w-90 rounded-[1.75rem] bg-[#f4efe6] p-7" data-qr>{@html renderSVG(link)}</div>
		<div class="flex w-full max-w-md flex-col gap-5">
			<span class="font-display text-5xl text-(--accent)">Scan to add</span>
			<code class="rounded-xl border-2 border-[#3a352e] bg-[#1a1a1a] px-4 py-4 text-lg break-all text-[#d8d2c6]" data-link>{link}</code>
			<button class="big-btn gold rt-fancy-btn" onclick={() => navigator.clipboard.writeText(link).then(() => (copied = true))} data-copy-link>{copied ? 'Copied' : 'Copy link'}</button>
			<div class="grid grid-cols-2 gap-3.5">
				<button class="big-btn" onclick={() => print()} data-print>Print QR</button>
				<button class="big-btn" onclick={copy(id)} data-copy>Make a copy</button>
			</div>
		</div>
	</div>
	<!-- The poster: only what prints. -->
	<div class="hidden flex-col items-center gap-10 pt-10 text-black print:flex" data-poster>
		<h1 class="text-center font-display text-6xl">{shared?.definition.title}</h1>
		<div class="h-[28rem] w-[28rem]">{@html renderSVG(link)}</div>
		<p class="font-display text-3xl">Scan to add</p>
	</div>
{:else}
	<div class="mb-7 flex flex-wrap items-center gap-4">
		<h1 class="font-display text-5xl text-(--accent)">Plugins</h1>
		<button class="h-11 w-11 rounded-full border-2 border-(--accent) text-xl font-bold text-(--accent)" aria-label="What are plugins?" aria-expanded={info} onclick={() => (info = !info)} data-info>i</button>
		{#if info}
			<p role="note" class="max-w-xl rounded-2xl border border-rule bg-[#1f1c14] px-5 py-3.5 text-lg leading-snug text-[#e8e2d6]" data-info-text>
				Plugins are custom forms. Build one yourself and share it, or install one from your organization. Use it offline in the Get Cache mobile app.
			</p>
		{/if}
	</div>
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-tiles>
		<a class="tile tile-gold rt-fancy-btn min-h-60" href="#/plugins/edit/new" data-new>
			<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			New plugin
		</a>
		{#each mine as versions (versions[0].pluginId)}
			{@const last = versions.at(-1)!}
			{@const shown = versions.findLast((v) => v.publishedAt)}
			{@const n = answers.get(last.pluginId)}
			<div class="relative flex min-h-60 flex-col gap-4 rounded-3xl border-2 border-[#3a352e] bg-[#1a1a1a] p-7" data-plugin-tile={last.definition.title}>
				{@render mark(last.logo, 'h-18 w-18')}
				<a class="font-display text-[2rem] leading-tight after:absolute after:inset-0" href="#/plugins/edit/{last.pluginId}" data-edit>{last.definition.title || 'Untitled'}</a>
				<span class="mt-auto flex flex-wrap gap-2.5">
					<span class="{chip} bg-[#2a2620] text-(--accent)" data-version>{shown ? `v${shown.version} live` : 'draft'}</span>
					{#if n}<a class="{chip} relative z-10 border-2 border-[#4a443c] text-[#c9c3b7]" href="#/plugins/answers/{last.pluginId}" data-answers>{n} answers</a>{/if}
				</span>
			</div>
		{/each}
		{#each others as p (p.pluginId)}
			<a class="flex min-h-60 flex-col gap-4 rounded-3xl border-2 border-[#3a352e] bg-[#1a1a1a] p-7" href="#/plugins/answers/{p.pluginId}" data-plugin-tile={p.title}>
				{@render mark(null, 'h-18 w-18')}
				<span class="font-display text-[2rem] leading-tight">{p.title}</span>
				<span class="mt-auto"><span class="{chip} border-2 border-[#4a443c] text-[#c9c3b7]" data-answers>{p.answers} answers</span></span>
			</a>
		{/each}
		<button class="tile min-h-60 border-2 border-dashed border-[#4a443c]" onclick={() => pick?.click()} data-open-sent>
			<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 19h16" /></svg>
			Open a .getcache file
		</button>
	</div>
	<input bind:this={pick} type="file" accept=".getcache" class="hidden" onchange={(e) => open(e.currentTarget.files?.[0])} data-sent-file />
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}
