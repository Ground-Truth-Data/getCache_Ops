<script lang="ts">
	import { renderSVG } from 'uqr';
	import SignIn from '../company/SignIn.svelte';
	import { mine as memberships } from '../company/central';
	import Builder from './Builder.svelte';
	import { keys, nthForm, type Answers, type Definition } from './forms';
	import { ago, current } from './answers';
	import { SvelteMap } from 'svelte/reactivity';
	import Report from './Report.svelte';
	import Response from './Response.svelte';
	import { session } from '../data/auth';
	import InboxChrome from '../../_rapper/gc/InboxChrome.svelte';
	import RowGrip from '../../_rapper/gc/RowGrip.svelte';
	import RowShell from '../../_rapper/gc/RowShell.svelte';
	import IdentityPill, { type Identity } from '../../_rapper/gc/IdentityPill.svelte';
	import HeaderLink from '../../_rapper/gc/HeaderLink.svelte';
	import FormView from '../../_rapper/gc/FormView.svelte';
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
	// The company a plugin publishes as: picked before its first version, then fixed by Central.
	let orgKey = $state<string | null>(null);
	let isPublished = $state(false);
	let spaces = $state<{ orgKey: string; name: string }[]>([]);
	$effect(() => {
		if (me) memberships(me.authId).then(
			(m) => (spaces = m.filter((x) => x.role === 'admin' && x.orgSpace?.status === 'approved').map((x) => ({ orgKey: x.orgKey, name: x.orgSpace!.name }))),
			(e) => console.warn('[plugins] companies', e),
		);
	});
	const company = $derived(spaces.find((s) => s.orgKey === orgKey)?.name);
	// Set when Publish needs an account: the sign-in shows then, and goes once the session is back.
	let asking = $state(false);
	// A new plugin gets its id in the address before anything is typed, so a reload or remount reopens the draft.
	$effect(() => {
		if (sub === 'edit' && id === 'new') location.replace(`#/plugins/edit/${crypto.randomUUID()}`);
	});
	const store = $derived.by(() => {
		if (sub !== 'edit' || !id || id === 'new') return undefined;
		const s = pluginStore(id, () => ({ logo, orgKey }), (rows) => {
			logo = rows.at(-1)?.logo ?? null;
			madeBy = rows.findLast((r) => r.publishedAt)?.madeBy;
			isPublished = rows.some((r) => r.publishedAt);
			orgKey = rows.at(-1)?.orgKey ?? null;
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
	const questions = (d: Definition) => keys(d).filter((k) => k.type !== 'paneldynamic').length;
	const items = $derived([
		...mine.map((versions) => {
			const last = versions.at(-1)!;
			const live = versions.findLast((v) => v.publishedAt);
			const got = inbox.find((p) => p.pluginId === last.pluginId);
			return { pluginId: last.pluginId, mine: true, title: last.definition.title ?? '', maker: live?.madeBy ?? 'You', version: live ? `v${live.version} live` : 'draft', live: !!live, questions: questions(last.definition), answers: got?.answers ?? 0, lastAt: got?.lastAt ?? null, href: `#/plugins/fill/${last.pluginId}`, definition: last.definition };
		}),
		...others.map((p) => ({ pluginId: p.pluginId, mine: false, title: p.title, maker: p.madeBy, version: '', live: true, questions: questions(p.definition), answers: p.answers, lastAt: p.lastAt, href: `#/plugins/fill/${p.pluginId}`, definition: p.definition })),
	]);
	// A plugin with answers folds open on its left chevron: its answers as rust rows, each opening its response.
	const unfolded = new SvelteMap<string, Answers['answers']>();
	function fold(pluginId: string) {
		if (unfolded.delete(pluginId)) return;
		receivedAnswers(pluginId).then((a) => unfolded.set(pluginId, current(a).answers.toReversed()), (e) => (note = e.message));
	}
	// A tapped half presses in and flashes gold for a second before it acts, so a slip of the finger reads as what it did.
	let pressing = $state<string | null>(null);
	function press(key: string, act: () => void) {
		if (pressing) return;
		pressing = key;
		setTimeout(() => ((pressing = null), act()), 1000);
	}
	const saved = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
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
	const pills = $derived([[{ key: 'all', label: 'All', on: !you, chain: true }, { key: 'you', label: 'You', on: you, chain: true }]]);
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

{#snippet go()}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>{/snippet}

<!-- One pill colour per fact, so the eye learns them: questions rust, a draft dim, submissions counted on the icon. -->
{#snippet pluginRow(p: (typeof items)[number], href: string, foldable: boolean)}
	<!-- Half and half: the left folds the submissions open, the right fills the form out. -->
	<RowShell title={p.title || 'Untitled'} tier="top">
		{#snippet lead()}
			{#if foldable}
				<span class="rt-row__fold" class:rt-row__fold--shut={!unfolded.has(p.pluginId)} class:none={!p.answers}
					><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg></span
				>
			{/if}
		{/snippet}
		{#snippet overlay()}
			<!-- Always two zones, so every row reads the same; with no submissions the left one folds nothing. -->
			{#if foldable}
				<span
					class="rt-row__half rt-row__half--toggle zone"
					class:pressed={pressing === `${p.pluginId}:fold`}
					role="button"
					tabindex="0"
					aria-label={unfolded.has(p.pluginId) ? 'Hide submissions' : 'Show submissions'}
					aria-expanded={unfolded.has(p.pluginId)}
					aria-disabled={!p.answers}
					onclick={(e) => (e.stopPropagation(), p.answers && press(`${p.pluginId}:fold`, () => fold(p.pluginId)))}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), p.answers && press(`${p.pluginId}:fold`, () => fold(p.pluginId)))}
					data-fold
				></span>
			{/if}
			<a
				class="rt-row__half rt-row__half--open zone"
				class:pressed={pressing === p.pluginId}
				{href}
				aria-label="Fill out {p.title || 'Untitled'}"
				onclick={(e) => (e.preventDefault(), e.stopPropagation(), press(p.pluginId, () => (location.hash = href)))}
				data-open
			></a>
		{/snippet}
		{#snippet glyph()}
			<img src="plugin_gold.webp" alt="" class="rt-row__glyph-img" />
			{#if p.answers}<span class="rt-count-badge" aria-label="{p.answers} {p.answers === 1 ? 'submission' : 'submissions'}" data-answers>{p.answers}</span>{/if}
		{/snippet}
		{#snippet subtitle()}
			<IdentityPill who={pill(p)} />
			{#if !p.live}<span class="rt-row__badge border-[#8a857b]! text-[#8a857b]!" data-version>draft</span>{/if}
			<span class="questions" data-questions>{p.questions} {p.questions === 1 ? 'question' : 'questions'}</span>
		{/snippet}
		{#snippet end()}
			<span class="flex items-center" aria-hidden="true"
				><span class="fill-label">Fill out</span><span class="rt-row__cell rt-row__cell--chevron"
					>{#if p.lastAt}<span class="rt-row__when text-(--rt-sage)!" title="Last submitted {saved(p.lastAt)}" data-last>{ago(p.lastAt)}</span>{/if}{@render go()}</span
				></span
			>
		{/snippet}
	</RowShell>
{/snippet}

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
		{#if isPublished && orgKey}
			<span class="font-bold text-(--accent)" data-company>{company ?? 'A company'}'s plugin</span>
		{:else if !isPublished && spaces.length}
			<label class="flex items-center gap-2 text-[#c9c3b7]"
				>Publish as
				<select class="rounded-lg border-2 border-(--accent) bg-transparent px-2 py-1 font-bold text-(--accent)" bind:value={orgKey} data-publish-as>
					<option value={null}>You</option>
					{#each spaces as s (s.orgKey)}<option value={s.orgKey}>{s.name}</option>{/each}
				</select></label
			>
		{/if}
	{/snippet}
	{#key id}<Builder {store} back={['#/plugins', 'Plugins']} logo={logoPick} {byline} meta={logo} born={nthForm(mine.filter((v) => v[0].pluginId !== id).map((v) => v.at(-1)!.definition.title ?? ''))} />{/key}
	{#if asking}<div class="mt-6" data-publish-signin><SignIn done={() => ((asking = false), signedInNow())} /></div>{/if}
{:else if sub === 'answers' && id && answer}
	<Response load={() => receivedAnswers(id).then((a) => ((photos = a.photos), a))} id={answer} back={[`#/plugins/answers/${id}`, 'Answers']} photo={(k) => photos.get(k)} />
{:else if sub === 'answers' && id}
	<Report load={() => receivedAnswers(id).then((a) => ((photos = a.photos), a))} back={['#/plugins', 'Plugins']} photo={(k) => photos.get(k)} open={(a) => `#/plugins/answers/${id}/${a}`} />
{:else if sub === 'fill' && id}
	{@const row = items.find((p) => p.pluginId === id)}
	<!-- Edit lives inside the form, and only on your own. Answers are kept on a phone, so filling here tries the form out. -->
	<header class="mb-8 flex max-w-3xl flex-wrap items-center gap-4" data-fill>
		<a class="small-btn" href="#/plugins" data-back
			><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Plugins</a
		>
		<span class="flex-1 font-display text-4xl">{row?.title || 'Untitled'}</span>
		{#if row?.mine}<a class="small-btn" href="#/plugins/edit/{id}" data-edit>Edit</a>{/if}
		{#if row?.live}<a class="small-btn" href={addLink(id)} data-add-phone>Add to phone</a>{/if}
	</header>
	{#if row}<div class="phone" data-fill-form><FormView definition={row.definition} onsubmit={() => (location.hash = '#/plugins')} /></div>{/if}
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
	{@const row = items.find((p) => p.pluginId === id)}
	<!-- The plugin as its list shows it: a tap goes back to that list. -->
	{#if row}<div class="split mb-10 max-w-3xl print:hidden" data-share-row>{@render pluginRow(row, '#/plugins', false)}</div>{/if}
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
	<div class="mb-7 flex max-w-3xl flex-wrap items-center gap-4">
		<h1 class="font-display text-5xl text-(--accent)">Plugins</h1>
		<button class="ml-3 h-6 w-6 rounded-full border-[1.5px] border-(--accent) text-xs font-bold text-(--accent)" aria-label="What are plugins?" aria-expanded={info} onclick={() => (info = !info)} data-info>i</button>
		<span class="ml-auto [--header-link-size:1.4rem]" data-orgs-link><HeaderLink href="#/organizations" icon="org_gold.webp" label="Orgs." /></span>
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
			<div
				class="split rt-row-track rt-row-track--grip ml-4"
				class:rt-row-track--dragging={moving}
				data-row-id={p.pluginId}
				style:transform={moving ? `translateY(${drag!.deltaY}px)` : shift ? `translateY(${shift}px)` : undefined}
				style:transition={shift && !moving ? 'transform 200ms ease' : undefined}
			>
			{@render pluginRow(p, p.href, true)}
			<RowGrip
				label="Drag to reorder"
				dragging={moving}
				attach={(el) => rowDragHandle(el, { rowId: p.pluginId, index: i, count: shown.length, drag: () => drag, move: (d) => (drag = d), drop }).destroy}
			/>
			</div>
			{@const got = unfolded.get(p.pluginId)}
			{#if got}
				<!-- mr-6 ends them where the row above ends, left of its grip. -->
				<div class="subs mr-6 ml-10 flex flex-col gap-(--rt-space-2)" data-answer-rows>
					{#each got as a (a.id)}
						{@const to = `#/plugins/answers/${p.pluginId}/${a.id}`}
						<div class="sub" class:pressed={pressing === a.id}>
							<RowShell title={p.title || 'Untitled'} tier="child" onclick={() => press(a.id, () => (location.hash = to))}>
								{#snippet glyph()}<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--rt-rust)" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>{/snippet}
								{#snippet subtitle()}
									<span class="rt-row__num">{saved(a.filledAt)}</span>
									{#if a.lat != null}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rt-cream)" stroke-width="1.7" stroke-linejoin="round" role="img" aria-label="GPS stamped" data-gps><path d="M6 4h12l4 5-10 11L2 9z M2 9h20 M9 4l-2 5 5 11 5-11-2-5" /></svg>{/if}
								{/snippet}
								{#snippet end()}
									<span class="rt-row__cell rt-row__cell--chevron" aria-hidden="true"><span class="rt-row__when text-(--rt-sage)!">{ago(a.filledAt)}</span>{@render go()}</span>
								{/snippet}
							</RowShell>
						</div>
					{/each}
					<a class="small-btn self-start" href="#/plugins/answers/{p.pluginId}" data-answers-link>All submissions as a table</a>
				</div>
			{/if}
		{/each}
	</div>
	<input bind:this={pick} type="file" accept=".getcache" class="hidden" onchange={(e) => open(e.currentTarget.files?.[0])} data-sent-file />
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}

<style>
	/* Only the zones are live: the row itself neither lights nor points. */
	/* Gold: plugins sit one level under the white company row. Not a Tailwind [&_] class: beside a
	   class: directive Svelte writes its & as a literal &amp;, and the rule never matches. */
	.split :global(.rt-row) {
		cursor: default;
		border-color: var(--rt-yellow);
	}
	.zone {
		width: 50%;
	}
	.none {
		opacity: 0.3;
	}
	.questions {
		color: var(--rt-rust);
		font-weight: 600;
		white-space: nowrap;
	}
	/* The right half names what it does only while the pointer is on it. */
	.fill-label {
		margin-right: 1rem;
		color: var(--rt-yellow);
		font-family: var(--rt-font-display);
		font-size: 1.15rem;
		opacity: 0;
		transition: opacity 120ms;
	}
	.split:has(.rt-row__half--open:hover) .fill-label {
		opacity: 1;
	}
	.subs {
		padding-left: 1.25rem;
		border-left: 2px dashed color-mix(in srgb, var(--rt-rust) 55%, #1a1a1a);
	}
	.subs :global(.rt-row) {
		border-color: var(--rt-rust);
	}
	.pressed,
	.sub.pressed :global(.rt-row) {
		animation: press 1s ease-out;
	}
	@keyframes press {
		0% {
			transform: scale(0.98);
			box-shadow: inset 0 3px 10px rgb(0 0 0 / 0.6);
			background: color-mix(in srgb, var(--rt-yellow) 45%, transparent);
		}
		100% {
			transform: none;
			box-shadow: inset 0 0 0 rgb(0 0 0 / 0);
			background: color-mix(in srgb, var(--rt-yellow) 10%, transparent);
		}
	}
	.phone {
		width: 24rem;
		max-height: 44rem;
		overflow-y: auto;
		scrollbar-width: none;
		padding: 1.1rem;
		border: 3px solid #3a352e;
		border-radius: 2.25rem;
		background: #0a0a0a;
	}
</style>
