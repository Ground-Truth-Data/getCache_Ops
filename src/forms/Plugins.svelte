<script lang="ts">
	import { renderSVG } from 'uqr';
	import SignIn from '../company/SignIn.svelte';
	import { companies } from '../company/central';
	import Builder from './Builder.svelte';
	import { keys, nthForm, type Answers, type Definition } from './forms';
	import { current, named } from './answers';
	import { ago } from '../../_rapper/gc/ago';
	import { SvelteMap } from 'svelte/reactivity';
	import Report from './Report.svelte';
	import Response from './Response.svelte';
	import { session } from '../data/auth';
	import InboxChrome from '../../_rapper/gc/InboxChrome.svelte';
	import RowShell from '../../_rapper/gc/RowShell.svelte';
	import IdentityPill, { type Identity } from '../../_rapper/gc/IdentityPill.svelte';
	import HeaderLink from '../../_rapper/gc/HeaderLink.svelte';
	import FormView from '../../_rapper/gc/FormView.svelte';
	import { isOpen, query } from '../data/db';
	import { go as navigate } from '../app/route.svelte';
	import PluginCard from '../../_rapper/gc/PluginCard.svelte';
	import PluginList, { type PluginListItem } from '../../_rapper/gc/PluginList.svelte';
	import { logoUrl } from '../company/central';
	import { addLink, copyPlugin, keepAnswer, live, myPlugins, plugins, pluginStore, receive, received, receivedAnswers, retirePlugin, SignInNeeded, type PluginRow } from './plugins';

	let { me, sub, id, answer, signedInNow }: { me: { authId: string } | null; sub?: string; id?: string; answer?: string; signedInNow: () => void } = $props();

	let mine = $state<PluginRow[]>([]);
	// Plugins made elsewhere whose answers came in a sent file, as Central holds them: their tile opens the answers.
	let others = $state<PluginRow[]>([]);
	let inbox = $state<Awaited<ReturnType<typeof received>>>([]);
	let note = $state('');
	let info = $state(false);
	let pick = $state<HTMLInputElement>();
	let shared = $state<PluginRow>();

	async function load() {
		inbox = await received();
		mine = await myPlugins(me?.authId);
		others = await plugins(inbox.map((p) => p.id).filter((i) => !mine.some((m) => m.id === i)));
		shared = sub === 'share' && id ? await live(id) : undefined;
	}
	$effect(() => {
		void [sub, id];
		load().catch((e) => (note = e.message));
	});

	const run = (fn: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await fn();
		} catch (e) {
			// SQLite's own words are for Chris, never the screen.
			if ((e as Error).name !== 'SQLite3Error') return void (note = (e as Error).message);
			console.error('[ops] plugins', e);
			note = "Couldn't keep that in this browser. Try again, or reload.";
		}
	};
	const copy = (source: string) => run(async () => navigate(`plugins/edit/${await copyPlugin(source)}`));

	async function open(file?: File) {
		if (file) await run(async () => (await receive(new Uint8Array(await file.arrayBuffer())), await load()))();
		if (pick) pick.value = '';
	}

	// The credit is the publishing account's name, set by Central.
	let madeBy = $state<string>();
	let logo = $state<string | null>(null);
	// The company a plugin publishes as: picked before it is published, then fixed by Central.
	let orgKey = $state<string | null>(null);
	let isPublished = $state(false);
	let spaces = $state<{ orgKey: string; name: string }[]>([]);
	$effect(() => {
		if (me) companies().then(
			(m) => (spaces = m.filter((x) => x.role === 'admin').map((x) => ({ orgKey: x.orgKey, name: x.card.name }))),
			(e) => console.warn('[plugins] companies', e),
		);
	});
	const company = $derived(spaces.find((s) => s.orgKey === orgKey)?.name);
	// Set when Publish needs an account: the sign-in shows then, and goes once the session is back.
	let asking = $state(false);
	// A new plugin gets its id in the address before anything is typed, so a reload or remount reopens it.
	$effect(() => {
		if (sub === 'edit' && id === 'new') navigate(`plugins/edit/${crypto.randomUUID()}`, true);
	});
	const store = $derived.by(() => {
		if (sub !== 'edit' || !id || id === 'new') return undefined;
		const s = pluginStore(id, () => ({ logo, orgKey }), (row) => {
			logo = row?.logo ?? null;
			madeBy = row?.madeBy;
			isPublished = !!row?.publishedAt;
			orgKey = row?.orgKey ?? null;
		});
		return {
			...s,
			publish: () =>
				s.publish().then(
					() => navigate(`plugins/share/${location.pathname.split('/').at(-1)}`),
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

	// The home is the inbox: All or You, a search, then the one plugins list.
	const questions = (d: Definition) => keys(d).filter((k) => k.type !== 'paneldynamic').length;
	// The badge, the card's count and the folded list all read this browser's answers file, so they never disagree.
	const item = (p: PluginRow, mine: boolean) => {
		const got = inbox.find((r) => r.id === p.id);
		const c = p.company;
		return {
			...p,
			mine,
			title: p.definition.title ?? '',
			icon: 'plugin_gold.webp',
			maker: pill({ mine, maker: p.madeBy ?? 'You' }),
			questions: questions(p.definition),
			created: p.publishedAt && (p.createdAt ?? p.publishedAt),
			answers: got?.answers ?? 0,
			lastAt: got?.lastAt ?? null,
			past: !!p.retiredAt,
			retired: !!p.retiredAt,
			replacedBy: p.replacedBy && { ...p.replacedBy, href: `plugins/fill/${p.replacedBy.id}` },
			org: c && { key: c.orgKey, name: c.name, color: c.color, logo: logoUrl(c) || null },
			href: `plugins/fill/${p.id}`,
		};
	};
	const items = $derived([...mine.map((p) => item(p, true)), ...others.map((p) => item(p, false))]);
	// A form filled here is kept as a phone keeps one; its photos wait here until it is.
	let picked = new Map<string, File>();
	const pickPhoto = async (f: File) => {
		const key = crypto.randomUUID();
		picked.set(key, f);
		return key;
	};
	const fill = (v: PluginRow, answers: Record<string, unknown>) =>
		run(async () => {
			if (!v.publishedAt) throw new Error('Publish it to keep answers.');
			const self = isOpen() ? (query("SELECT selfKey FROM appState WHERE appStateId = 'singleton'")[0]?.selfKey as string | undefined) : undefined;
			// The session, not `me`: an account with no cloud file is signed in yet has no `me`.
			const by = self ?? session()?.user.id;
			if (!by) throw new Error('Sign in, or open your Get Cache file, to sign this answer.');
			await keepAnswer(v, answers, picked, by);
			picked = new Map();
			unfolded.delete(v.id);
			await load();
			navigate('plugins');
		})();
	// A plugin with answers folds open on its left chevron: its answers as rust rows, each opening its response.
	const unfolded = new SvelteMap<string, Answers['answers']>();
	function fold(p: PluginRow) {
		if (unfolded.delete(p.id)) return;
		receivedAnswers(p.id, p.definition).then((a) => unfolded.set(p.id, current(a).answers.toReversed()), (e) => (note = e.message));
	}
	const answersOf = (pid: string) => {
		const p = items.find((x) => x.id === pid);
		return p ? receivedAnswers(pid, p.definition).then((a) => ((photos = a.photos), a)) : Promise.reject(new Error('No such plugin here.'));
	};
	// A tapped half presses in and flashes gold for a second before it acts, so a slip of the finger reads as what it did.
	let pressing = $state<string | null>(null);
	function press(key: string, act: () => void) {
		if (pressing) return;
		pressing = key;
		setTimeout(() => ((pressing = null), act()), 1000);
	}
	const saved = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
	// Retired by this person, on Central: greyed and sorted below the rest, and it still opens.
	const retire = (pid: string) => run(() => retirePlugin(pid).then(load))();
	// A maker wears their pill from the open Get Cache file's contacts, as every Get Cache screen draws them.
	const people = new Map(
		(isOpen() ? query('SELECT username, color, colorPickedAt FROM personView') : []).map((r) => [r.username as string, r]),
	);
	const pill = (p: { mine: boolean; maker: string }): Identity => {
		if (p.mine) return { label: 'you', color: 'var(--accent)', self: true, picked: false };
		const c = people.get(p.maker);
		return { label: p.maker, color: (c?.color as string) ?? '', self: false, picked: !!c?.colorPickedAt };
	};
	// An answer is signed with the filler's personKey, or the account when no Get Cache file was open.
	const byKey = new Map((isOpen() ? query('SELECT personKey, username, color, colorPickedAt FROM personView') : []).map((r) => [r.personKey as string, r]));
	const selfKey = isOpen() ? (query("SELECT selfKey FROM appState WHERE appStateId = 'singleton'")[0]?.selfKey as string | undefined) : undefined;
	const submitter = (key?: string): Identity => {
		if (key && (key === selfKey || key === session()?.user.id)) return { label: 'you', color: 'var(--accent)', self: true, picked: false };
		const c = key ? byKey.get(key) : undefined;
		return c ? { label: c.username as string, color: (c.color as string) ?? '', self: false, picked: !!c.colorPickedAt } : { label: 'not in your contacts', color: '', self: false, picked: false };
	};
	// A Person question picks from, and its answers are read through, the open Get Cache file's contacts.
	const contacts = [...byKey.values()].map((r) => ({ key: r.personKey as string, name: r.username as string, color: (r.color as string) ?? '', picked: !!r.colorPickedAt }));
	const known = (pid: string) => answersOf(pid).then((g) => named(g, (k) => (byKey.get(k)?.username as string) ?? 'not in your contacts'));
	let you = $state(false);
	let search = $state('');
	const q = $derived(search.trim().toLowerCase());
	const match = (p: PluginListItem) => (!you || p.mine) && (!q || `${p.title} ${p.maker.label} ${p.org?.name ?? ''}`.toLowerCase().includes(q));
	const pills = $derived([[{ key: 'all', label: 'All', on: !you, chain: true }, { key: 'you', label: 'You', on: you, chain: true }]]);
	const buttons = $derived([
		{ label: 'Import plugin', icon: gcIcon, ring: true, onclick: () => pick?.click() },
		{ label: 'New', icon: pluginIcon, hug: true, href: 'plugins/edit/new' },
	]);

	let photos = new Map<string, string>();
	let copied = $state(false);
</script>

<!-- Signing in happens in the app's own tab on Get Cache's site: coming back is when the session can be there. -->
<svelte:window onfocus={() => (asking &&= !session())} />

{#snippet gcIcon()}<img src="gc_logo.webp" alt="" class="h-10 w-auto" />{/snippet}
{#snippet pluginIcon()}<img src="plugin_white.webp" alt="" class="h-8 w-auto" />{/snippet}

{#snippet go()}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>{/snippet}

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
		{#if madeBy}<span class="text-[#c9c3b7]" data-credit>Made by {madeBy}{#if isPublished}&nbsp;· <a class="underline" href="plugins/share/{id}" data-share-link>Share</a>{/if}</span>{/if}
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
	{#key id}<Builder {store} edit={(i) => `plugins/edit/${i}`} back={['plugins', 'Plugins']} logo={logoPick} {byline} meta={logo} born={nthForm(mine.filter((p) => p.id !== id).map((p) => p.definition.title ?? ''))} />{/key}
	{#if asking}<div class="mt-6" data-publish-signin><SignIn done={() => ((asking = false), signedInNow())} /></div>{/if}
{:else if sub === 'answers' && id && answer}
	<Response load={() => known(id)} id={answer} back={[`plugins/answers/${id}`, 'Answers']} photo={(k) => photos.get(k)} />
{:else if sub === 'answers' && id}
	<Report load={() => known(id)} back={['plugins', 'Plugins']} photo={(k) => photos.get(k)} open={(a) => `plugins/answers/${id}/${a}`} />
{:else if sub === 'fill' && id}
	{@const row = items.find((p) => p.id === id)}
	<!-- Edit lives inside the form, and only on your own. -->
	<header class="mb-8 flex max-w-3xl flex-wrap items-center gap-4" data-fill>
		<a class="small-btn" href="plugins" data-back
			><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Plugins</a
		>
		<span class="flex-1 font-display text-4xl">{row?.title || 'Untitled'}</span>
		{#if row?.mine}<a class="small-btn" href="plugins/edit/{id}" data-edit>Edit</a>{/if}
		{#if row?.publishedAt}<a class="small-btn" href={addLink(id)} data-add-phone>Add to phone</a>{/if}
	</header>
	{#if row}<div class="phone" data-fill-form><FormView definition={row.definition} keep={pickPhoto} people={contacts} onsubmit={(a) => fill(row, a)} /></div>{/if}
{:else if sub === 'share' && id}
	{@const link = addLink(id)}
	<header class="mb-8 flex flex-wrap items-center gap-4 border-b border-rule pb-5 print:hidden">
		<a class="small-btn" href="plugins/edit/{id}" data-back
			><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>Edit</a
		>
		{#if shared}
			{@render mark(shared.logo, 'h-16 w-16')}
			<span class="flex-1 font-display text-4xl">{shared.definition.title}</span>
			<span class="flex items-center gap-2 rounded-full bg-[#22301f] px-4 py-2 text-lg font-bold text-[#9bd28f]" data-published
				><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Published</span
			>
		{/if}
	</header>
	{@const row = items.find((p) => p.id === id)}
	<!-- The plugin as its list shows it: a tap goes back to that list. -->
	{#if row}<div class="mb-10 max-w-3xl print:hidden" data-share-row><PluginCard card={row} href="plugins" go={navigate} /></div>{/if}
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
		<span class="ml-auto [--header-link-size:1.4rem]" data-orgs-link><HeaderLink href="organizations" icon="org_gold.webp" label="Orgs." /></span>
		{#if info}
			<p role="note" class="max-w-xl rounded-2xl border border-rule bg-[#1f1c14] px-5 py-3.5 text-lg leading-snug text-[#e8e2d6]" data-info-text>
				Plug in a custom form or an entire company suite, build, share, collect data.
			</p>
		{/if}
	</div>
	<div class="flex max-w-3xl flex-col gap-(--rt-space-2)" data-plugins>
		<InboxChrome rows={pills} onpill={(k) => (you = k === 'you')} bind:query={search} placeholder="Search plugins and makers" clearLabel="Clear" {buttons} />
		<PluginList {items} {match} orderKey="ops-plugins-order" go={navigate} onretire={retire} isOpen={(pid) => unfolded.has(pid)} ontoggle={(pid) => fold(items.find((x) => x.id === pid)!)}>
			{#snippet folded(p)}
				<!-- mr-6 ends them where the row above ends, left of its grip. -->
				<div class="subs mr-6 ml-10 flex flex-col gap-(--rt-space-2)" data-answer-rows>
					<a class="small-btn self-start" href="plugins/answers/{p.id}" data-answers-link>All submissions as a table</a>
					{#each unfolded.get(p.id) ?? [] as a (a.id)}
						{@const to = `plugins/answers/${p.id}/${a.id}`}
						<div class="sub" class:pressed={pressing === a.id}>
							<RowShell title={p.title || 'Untitled'} tier="child" onclick={() => press(a.id, () => navigate(to))}>
								{#snippet glyph()}<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>{/snippet}
								{#snippet subtitle()}
									<IdentityPill who={submitter(a.editedByKey)} /><span class="rt-row__num">{saved(a.filledAt)}</span>
									{#if a.lat != null}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rt-cream)" stroke-width="1.7" stroke-linejoin="round" role="img" aria-label="GPS stamped" data-gps><path d="M6 4h12l4 5-10 11L2 9z M2 9h20 M9 4l-2 5 5 11 5-11-2-5" /></svg>{/if}
								{/snippet}
								{#snippet end()}
									<span class="rt-row__cell rt-row__cell--chevron" aria-hidden="true"><span class="rt-row__when text-(--rt-sage)!">{ago(a.filledAt)}</span>{@render go()}</span>
								{/snippet}
							</RowShell>
						</div>
					{/each}
				</div>
			{/snippet}
		</PluginList>
	</div>
	<input bind:this={pick} type="file" accept=".getcache" class="hidden" onchange={(e) => open(e.currentTarget.files?.[0])} data-sent-file />
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}

<style>
	.subs {
		padding-left: 1.25rem;
		border-left: 2px dashed var(--rust);
	}
	.subs :global(.rt-row) {
		border-color: var(--rust);
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
