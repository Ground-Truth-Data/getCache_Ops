<script lang="ts">
	import { ownSignIn } from '../data/auth';
	import { check, create, decide, drafts, isApprover, join, mine, myOrgs, spaceUrl, type Org } from './central';
	import Info from './Info.svelte';
	import OrgLogo from './OrgLogo.svelte';
	import SignIn from './SignIn.svelte';

	let { me, signedInNow }: { me: { authId: string } | null; signedInNow: () => void } = $props();
	let list = $state<Awaited<ReturnType<typeof mine>>>([]);
	let orgs = $state<(Org & { found?: Awaited<ReturnType<typeof check>> })[]>([]);
	let waiting = $state<Awaited<ReturnType<typeof drafts>>>([]);
	let loaded = $state(false);
	let view = $state<'grid' | 'join' | 'new' | 'sent'>('grid');
	let paste = $state('');
	let note = $state('');

	async function load() {
		if (!me) return;
		const [m, o, a] = await Promise.all([mine(me.authId), myOrgs(me.authId), isApprover(me.authId)]);
		list = m;
		const spaced = new Set(m.map((x) => x.orgKey));
		orgs = await Promise.all(o.filter((x) => !spaced.has(x.orgKey)).map(async (x) => ({ ...x, found: await check(x.orgName) })));
		waiting = a ? await drafts() : [];
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
	const back = 'small-btn self-start';
	const chevron = 'M15 6l-6 6 6 6';
</script>

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
	{@render header('New organization', 'These are the organizations in your Get Cache app (Account → Contacts → Orgs). Each gets its own space here once Get Cache approves it.')}
	<div class="grid max-w-4xl gap-5 md:grid-cols-2" data-orgs>
		{#each orgs as o (o.orgKey)}
			{@const why = o.found?.refused ?? (o.found?.taken ? 'That name is taken' : null)}
			<button class="big-btn justify-start text-left disabled:opacity-40" disabled={!!why || !o.found?.slug} title={why ?? ''} onclick={act(() => create(o.orgKey))} data-make={o.orgName}>
				<OrgLogo logo={null} size={3.5} />{o.orgName || 'Unnamed organization'}
			</button>
		{:else}
			<p class="text-xl text-muted" data-none>Add one in the Get Cache app first.</p>
		{/each}
	</div>
{:else}
	{@render header('Organizations', 'An organization is a planting company or crew on Get Cache. Its admins build forms here; its members fill them in on their phones. Most people join one from an invite link.')}
	{#if waiting.length}
		{@const c = waiting[0]}
		<section class="mb-7 flex flex-wrap items-center gap-5 rounded-2xl border-2 border-(--rust) bg-[#1e1713] px-6 py-5" aria-label="Waiting for you" data-draft={c.slug}>
			<span class="badge">{waiting.length}</span>
			<span class="flex-1 text-2xl font-semibold">New: {c.name}</span>
			<button class="rt-fancy-btn rounded-2xl px-8 py-3 font-display text-2xl" onclick={act(() => decide(c.orgKey, 'approved'))} data-approve>Approve</button>
			<button class="small-btn rounded-2xl border-2 px-7 py-3 text-xl" onclick={act(() => decide(c.orgKey, 'rejected'))} data-reject>Decline</button>
		</section>
	{/if}
	<div class="grid gap-6 md:grid-cols-3" data-mine>
		{#each list as m (m.orgKey)}
			{@const s = m.orgSpace}
			<a class="tile items-start justify-start text-left" href={s ? `${spaceUrl(s.slug)}company` : undefined} data-org-tile={s?.slug}>
				<OrgLogo logo={s?.logo} />
				<span>{s?.name ?? 'Not open yet'}</span>
				<span class="flex flex-wrap gap-2.5">
					<span class="chip {m.role === 'requested' ? 'chip-rust' : 'chip-gold'}" data-role>{ROLE[m.role]}</span>
					{#if s?.status === 'draft'}
						<span class="chip chip-rust" data-status
							><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9" /></svg>Waiting for approval</span
						>
					{:else if s?.status === 'rejected'}<span class="chip chip-rust" data-status>Not approved</span>{/if}
				</span>
			</a>
		{/each}
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
