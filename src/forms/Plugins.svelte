<script lang="ts">
	import { renderSVG } from 'uqr';
	import SignIn from '../company/SignIn.svelte';
	import Builder from './Builder.svelte';
	import Report from './Report.svelte';
	import Response from './Response.svelte';
	import { session } from '../data/auth';
	import InboxChrome from '../../_rapper/gc/InboxChrome.svelte';
	import RowGrip from '../../_rapper/gc/RowGrip.svelte';
	import RowShell from '../../_rapper/gc/RowShell.svelte';
	import IdentityPill, { type Identity } from '../../_rapper/gc/IdentityPill.svelte';
	import { isOpen, query } from '../data/db';
	import { type RowDrag, rowDragHandle, rowShift } from '../../_rapper/gc/rowDrag';
	import { addLink, copyPlugin, live, myPlugins, pluginStore, receive, received, receivedAnswers, SignInNeeded, type PluginRow } from './plugins';

	let { me, sub, id, answer, signedInNow }: { me: { authId: string } | null; sub?: string; id?: string; answer?: string; signedInNow: () => void } = $props();

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
	// A new plugin gets its id in the address before anything is typed, so a reload or remount reopens the draft.
	$effect(() => {
		if (sub === 'edit' && id === 'new') location.replace(`#/plugins/edit/${crypto.randomUUID()}`);
	});
	const store = $derived.by(() => {
		if (sub !== 'edit' || !id || id === 'new') return undefined;
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

	// The home is the inbox: All or You, a search, then rows the maker drags into his own order.
	const items = $derived([
		...mine.map((versions) => {
			const last = versions.at(-1)!;
			const live = versions.findLast((v) => v.publishedAt);
			return { pluginId: last.pluginId, mine: true, title: last.definition.title ?? '', maker: live?.madeBy ?? 'You', version: live ? `v${live.version} live` : 'draft', answers: answers.get(last.pluginId) ?? 0, href: `#/plugins/edit/${last.pluginId}` };
		}),
		...others.map((p) => ({ pluginId: p.pluginId, mine: false, title: p.title, maker: p.madeBy, version: '', answers: p.answers, href: `#/plugins/answers/${p.pluginId}` })),
	]);
	// This browser's order; a plugin it hasn't placed yet goes on top.
	const ORDER = 'ops-plugins-order';
	let order = $state<string[]>(JSON.parse(localStorage.getItem(ORDER) ?? '[]'));
	const sorted = $derived(items.toSorted((x, y) => order.indexOf(x.pluginId) - order.indexOf(y.pluginId)));
	// A maker wears their pill from the open Get Cache file's contacts, as every Get Cache screen draws them.
	const people = new Map(
		(isOpen() ? query('SELECT username, color, colorPickedAt FROM personView') : []).map((r) => [r.username as string, r]),
	);
	const pill = (p: { mine: boolean; maker: string }): Identity => {
		if (p.mine) return { label: 'you', color: 'var(--accent)', self: true, picked: false };
		const c = people.get(p.maker);
		return { label: p.maker, color: (c?.color as string) ?? '', self: false, picked: !!c?.colorPickedAt };
	};
	let you = $state(false);
	let search = $state('');
	const q = $derived(search.trim().toLowerCase());
	const shown = $derived(sorted.filter((p) => (!you || p.mine) && (!q || `${p.title} ${p.maker}`.toLowerCase().includes(q))));
	let drag = $state<RowDrag | null>(null);
	function drop(d: RowDrag) {
		drag = null;
		if (d.fromIndex === d.targetIndex) return;
		const ids = shown.map((p) => p.pluginId);
		ids.splice(d.targetIndex, 0, ...ids.splice(d.fromIndex, 1));
		let k = 0;
		order = sorted.map((p) => (ids.includes(p.pluginId) ? ids[k++] : p.pluginId));
		localStorage.setItem(ORDER, JSON.stringify(order));
	}
	const pills = $derived([[{ key: 'all', label: 'All', on: !you }, { key: 'you', label: 'You', on: you }]]);
	const buttons = $derived([
		{ label: 'Import plugin', icon: gcIcon, ring: true, onclick: () => pick?.click() },
		{ label: 'New', icon: pluginIcon, hug: true, href: '#/plugins/edit/new' },
	]);

	let photos = new Map<string, string>();
	let copied = $state(false);
</script>

<!-- Signing in happens in the app's own tab on Get Cache's site: coming back is when the session can be there. -->
<svelte:window onfocus={() => (asking &&= !session())} />

{#snippet gcIcon()}<img src="gc_logo.webp" alt="" class="h-10 w-auto" />{/snippet}
{#snippet pluginIcon()}<img src="plugin_white.webp" alt="" class="h-8 w-auto" />{/snippet}

{#snippet mark(src: string | null, size: string)}
	<img src={src ?? 'plugin_gold.webp'} alt="" class="{size} shrink-0 rounded-2xl object-contain" />
{/snippet}

{#if sub === 'edit' && store}
	{#snippet logoPick()}
		<label class="cursor-pointer" title="Change the logo" data-logo-pick>
			{@render mark(logo, 'h-16 w-16')}
			<input type="file" class="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={pickLogo} data-logo />
		</label>
	{/snippet}
	{#snippet byline()}
		{#if madeBy}<span class="text-[#c9c3b7]" data-credit>Made by {madeBy}</span>{/if}
	{/snippet}
	{#key id}<Builder {store} back={['#/plugins', 'Plugins']} logo={logoPick} {byline} meta={logo} />{/key}
	{#if asking}<div class="mt-6" data-publish-signin><SignIn done={() => ((asking = false), signedInNow())} /></div>{/if}
{:else if sub === 'answers' && id && answer}
	<Response load={() => receivedAnswers(id).then((a) => ((photos = a.photos), a))} id={answer} back={[`#/plugins/answers/${id}`, 'Answers']} photo={(k) => photos.get(k)} />
{:else if sub === 'answers' && id}
	<Report load={() => receivedAnswers(id).then((a) => ((photos = a.photos), a))} back={['#/plugins', 'Plugins']} photo={(k) => photos.get(k)} open={(a) => `#/plugins/answers/${id}/${a}`} />
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
	<div class="mb-7 flex flex-wrap items-end gap-4">
		<h1 class="font-display text-5xl text-(--accent)">Plugins</h1>
		<button class="mb-2 ml-3 h-6 w-6 rounded-full border-[1.5px] border-(--accent) text-xs font-bold text-(--accent)" aria-label="What are plugins?" aria-expanded={info} onclick={() => (info = !info)} data-info>i</button>
		{#if info}
			<p role="note" class="max-w-xl rounded-2xl border border-rule bg-[#1f1c14] px-5 py-3.5 text-lg leading-snug text-[#e8e2d6]" data-info-text>
				Plug in a custom form or an entire company suite, build, share, collect data.
			</p>
		{/if}
	</div>
	<div class="flex max-w-3xl flex-col gap-(--rt-space-2)" data-plugins>
		<InboxChrome rows={pills} onpill={(k) => (you = k === 'you')} bind:query={search} placeholder="Search plugins and makers" clearLabel="Clear" {buttons} />
		{#each shown as p, i (p.pluginId)}
			{@const moving = drag?.rowId === p.pluginId}
			{@const shift = rowShift(drag, p.pluginId, i)}
			<!-- Gold and inset: plugins sit one level in, under the white company row. -->
			<div
				class="rt-row-track rt-row-track--grip ml-4 [&_.rt-row]:border-(--rt-yellow)!"
				class:rt-row-track--dragging={moving}
				data-row-id={p.pluginId}
				style:transform={moving ? `translateY(${drag!.deltaY}px)` : shift ? `translateY(${shift}px)` : undefined}
				style:transition={shift && !moving ? 'transform 200ms ease' : undefined}
			>
			<RowShell title={p.title || 'Untitled'} href={p.href} tier="top">
				{#snippet glyph()}<img src="plugin_gold.webp" alt="" class="rt-row__glyph-img" />{/snippet}
				{#snippet subtitle()}
					<IdentityPill who={pill(p)} />
					{#if p.version}<span class="rt-row__badge rt-row__badge--gold">{p.version}</span>{/if}
				{/snippet}
				{#snippet end()}
					<span class="rt-row__cell rt-row__cell--chevron" aria-hidden="true"
						><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg></span
					>
				{/snippet}
			</RowShell>
			{#if p.answers}
				<!-- Beside the row, not in it: the row is already a link, and one link can't hold another. -->
				<a
					class="absolute top-1/2 right-16 z-1 -translate-y-1/2 rounded-full bg-(--rt-sage) px-3 py-1 text-sm font-extrabold text-[#161a10] hover:brightness-110"
					href="#/plugins/answers/{p.pluginId}"
					data-answers-link>{p.answers} {p.answers === 1 ? 'answer' : 'answers'}</a
				>
			{/if}
			<RowGrip
				label="Drag to reorder"
				dragging={moving}
				attach={(el) => rowDragHandle(el, { rowId: p.pluginId, index: i, count: shown.length, drag: () => drag, move: (d) => (drag = d), drop }).destroy}
			/>
			</div>
		{/each}
	</div>
	<input bind:this={pick} type="file" accept=".getcache" class="hidden" onchange={(e) => open(e.currentTarget.files?.[0])} data-sent-file />
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}
