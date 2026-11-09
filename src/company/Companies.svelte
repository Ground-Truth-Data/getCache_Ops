<script lang="ts">
	import OrgCard from '../../_rapper/gc/OrgCard.svelte';
	import { ownSignIn } from '../data/auth';
	import type { Ops } from '../data/db';
	import { check, companies, join, logoUrl, makeCompany, spaceUrl, type Company } from './central';
	import Info from './Info.svelte';
	import SignIn from './SignIn.svelte';

	let { me, ops, signedInNow }: { me: { authId: string } | null; ops: Ops | undefined; signedInNow: () => void } = $props();
	type Org = { orgKey: string; orgName: string; color: string; kinds: string | null; maps: number };
	// The phone's own Orgs list (db/sql/orgs.ts), run on the same planter's file: the same organizations, row for row.
	const ORGS = `SELECT o.orgKey, n.orgName, n.color,
		(SELECT group_concat(DISTINCT kind) FROM orgKindView k WHERE k.orgKey = o.orgKey) AS kinds,
		(SELECT COUNT(DISTINCT m.mapKey) FROM orgTagView m WHERE m.orgKey = o.orgKey) AS maps
		FROM orgTable o JOIN orgNameView n USING (orgKey) ORDER BY n.orgName COLLATE NOCASE`;
	const orgs = $derived((ops?.query(ORGS) ?? []) as Org[]);
	let mine = $state(new Map<string, Company>());
	type Answer = { sub: string; ok?: true };
	const answer = (name: string): Promise<Answer> =>
		check(name).then(
			(f) => (f?.refused ? { sub: f.refused } : f?.taken ? { sub: 'That name is taken' } : { sub: `${f?.slug}.getcache.org`, ok: true }),
			(e: Error) => ({ sub: e.message }),
		);
	let loaded = $state(false);
	let view = $state<'grid' | 'join' | 'new' | 'sent'>('grid');
	// Asked again whenever the org list changes, so a list that loads after the page opens still gets its answers.
	const found = $derived(view === 'new' ? new Map(orgs.filter((o) => !mine.has(o.orgKey)).map((o) => [o.orgKey, answer(o.orgName)])) : new Map<string, Promise<Answer>>());
	let paste = $state('');
	let note = $state('');

	async function load() {
		if (!me) return;
		mine = new Map((await companies()).map((c) => [c.orgKey, c]));
		loaded = true;
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	const act = (run: () => Promise<unknown>, then: typeof view = 'grid') => async () => {
		note = '';
		try {
			await run();
			await load();
			view = then;
		} catch (e) {
			note = (e as Error).message;
		}
	};
	// A pasted invite link, or just its code.
	const token = $derived(paste.match(/(?:join\/)?([0-9a-f]{32})/i)?.[1]);
	const ask = act(async () => {
		if (!token || !(await join(token))) throw new Error('That invite link no longer works. Ask for a new one.');
		paste = '';
	}, 'sent');
	const ROLE = { admin: 'Admin', member: 'Member', requested: 'Request sent' };
	// The phone's own words for an org's kinds (messages/en.json account_org_kind_*).
	const KIND: Record<string, string> = {
		plantingCompany: 'planting company',
		consultant: 'consultant / forester',
		mill: 'mill',
		nursery: 'nursery',
		government: 'government',
		ngo: 'NGO',
		contractor: 'contractor',
	};
	const line = (o: Org | undefined, c: Company | undefined) =>
		[...(o?.kinds?.split(',').map((k) => KIND[k] ?? k) ?? []), c && ROLE[c.role]].filter(Boolean).join(' · ');
	// A company joined here before the phone has added it to Contacts: listed after them until it has.
	const joinedOnly = $derived([...mine.values()].filter((c) => !orgs.some((o) => o.orgKey === c.orgKey)));
	const companyHref = (c: Company | undefined) => (c && c.role !== 'requested' ? `${spaceUrl(c.card.slug)}company` : undefined);
	const back = 'small-btn self-start';
	const chevron = 'M15 6l-6 6 6 6';
</script>

{#snippet pick(o: Org, a: Answer)}
	<OrgCard name={o.orgName} color={o.color} sub={a.sub} end={a.ok ? 'Make' : ''} onclick={a.ok ? act(() => makeCompany(o.orgKey)) : undefined} data-make={o.orgName} />
{/snippet}

{#snippet header(title: string, info: string)}
	<div class="mb-7 flex flex-wrap items-center gap-4">
		{#if view === 'grid'}
			<a class={back} href="advanced" data-back><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d={chevron} /></svg>Advanced</a>
		{:else}
			<button class={back} onclick={() => ((view = 'grid'), (note = ''))} data-back><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d={chevron} /></svg>Organizations</button>
		{/if}
		<h1 class="font-display text-5xl text-(--accent)">{title}</h1>
		<Info label="How this works">{info}</Info>
	</div>
{/snippet}

{#if !me}
	{@render header('Organizations', 'An organization is a planting company or crew on Get Cache. Its admins build forms here; its members fill them in on their phones.')}
	{#if ownSignIn}<SignIn done={signedInNow} />{:else}<p class="text-muted" data-why>Sign in to Get Cache in this browser first.</p>{/if}
{:else if !loaded}
	{@render header('Organizations', 'Loading.')}
{:else if view === 'join'}
	{@render header('Join', 'Paste the invite link someone sent you. Got a QR code instead? Scan it with your phone camera.')}
	<div class="flex max-w-xl flex-col gap-5">
		<input class="rounded-2xl border-2 border-[#3a352e] bg-field px-5 py-4 text-xl outline-none focus:border-(--accent)" placeholder="Invite link" bind:value={paste} data-paste-invite />
		<button class="big-btn gold rt-fancy-btn" disabled={!token} onclick={ask} data-ask>Ask to join</button>
	</div>
{:else if view === 'sent'}
	<div class="flex max-w-xl flex-col items-center gap-7 pt-10" data-sent>
		<span class="flex h-36 w-36 items-center justify-center rounded-full bg-(--accent) text-[#111]"
			><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span
		>
		<h1 class="font-display text-5xl">Request sent</h1>
		<button class="big-btn w-full" onclick={() => (view = 'grid')} data-done>Done</button>
	</div>
{:else if view === 'new'}
	{@render header('New organization', 'These are the organizations in your Get Cache app (Account → Contacts → Orgs). Tap one to make it a company: it opens at once.')}
	<div class="org-list max-w-xl" data-orgs>
		{#each orgs.filter((o) => !mine.has(o.orgKey)) as o (o.orgKey)}
			{#await found.get(o.orgKey)}
				{@render pick(o, { sub: 'Checking the name…' })}
			{:then a}
				{@render pick(o, a!)}
			{/await}
		{:else}
			<p class="px-4 py-5 text-muted" data-none>Add one in the Get Cache app first (Account → Contacts → Orgs).</p>
		{/each}
	</div>
{:else}
	{@render header('Organizations', 'An organization is a planting company or crew on Get Cache. Its admins build forms here; its members fill them in on their phones. Most people join one from an invite link.')}
	<div class="org-list mb-8 max-w-xl" data-mine>
		{#each orgs as o (o.orgKey)}
			{@const c = mine.get(o.orgKey)}
			<OrgCard name={o.orgName} color={o.color} logo={c?.card.logo ? logoUrl(c.card) : ''} sub={line(o, c)} end={String(o.maps || '—')} href={companyHref(c)} data-org-tile={c?.card.slug ?? o.orgKey} />
		{/each}
		{#each joinedOnly as c (c.orgKey)}
			<OrgCard name={c.card.name} color={c.card.color ?? ''} logo={c.card.logo ? logoUrl(c.card) : ''} sub={line(undefined, c)} end="—" href={companyHref(c)} data-org-tile={c.card.slug} />
		{/each}
		{#if !orgs.length && !joinedOnly.length}
			<p class="px-4 py-5 text-muted" data-none>{ops ? 'No orgs yet. Add one in the Get Cache app (Account → Contacts → Orgs).' : 'No Get Cache data in this browser yet.'}</p>
		{/if}
	</div>
	<div class="grid gap-6 md:grid-cols-3">
		<button class="tile tile-gold rt-fancy-btn" onclick={() => (view = 'join')} data-join
			><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
				><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg
			>Join with invite link</button
		>
	</div>
	<button class="small-btn mt-12 border-dashed text-[#8a857b]" onclick={() => (view = 'new')} data-new
		><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>Start a new organization</button
	>
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}
