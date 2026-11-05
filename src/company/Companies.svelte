<script lang="ts">
	import { renderSVG } from 'uqr';
	import { ownSignIn, signOut } from '../data/auth';
	import { check, create, decide, drafts, inviteToken, isApprover, logoUrl, members, mine, myOrgs, remove, spaceUrl, type Org } from './central';
	import SignIn from './SignIn.svelte';

	let { me, signedInNow }: { me: { authId: string } | null; signedInNow: () => void } = $props();
	type Mine = Awaited<ReturnType<typeof mine>>[number] & { asking: number };
	let list = $state<Mine[]>([]);
	let owned = $state(0);
	let orgs = $state<(Org & { found?: Awaited<ReturnType<typeof check>> })[]>([]);
	let waiting = $state<Awaited<ReturnType<typeof drafts>>>([]);
	let approver = $state(false);
	let loaded = $state(false);
	let invites = $state<Record<string, string>>({});
	let note = $state('');

	async function load() {
		if (!me) return;
		const [m, o, a] = await Promise.all([mine(me.authId), myOrgs(me.authId), isApprover(me.authId)]);
		// An admin of an open organization sees how many people ask to join it.
		list = await Promise.all(
			m.map(async (x) => ({ ...x, asking: x.role === 'admin' && x.orgSpace?.status === 'approved' ? (await members(x.orgKey)).filter((p) => p.role === 'requested').length : 0 })),
		);
		[owned, approver] = [o.length, a];
		const spaced = new Set(m.map((x) => x.orgKey));
		orgs = await Promise.all(o.filter((x) => !spaced.has(x.orgKey)).map(async (x) => ({ ...x, found: await check(x.orgName) })));
		waiting = a ? await drafts() : [];
		loaded = true;
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	const act = (run: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await run();
			await load();
		} catch (e) {
			note = (e as Error).message;
		}
	};
	const invite = (m: Mine) => async () => {
		if (invites[m.orgKey]) return void delete invites[m.orgKey];
		const token = await inviteToken(m.orgKey).catch((e) => void (note = e.message));
		if (token && m.orgSpace) invites[m.orgKey] = `${spaceUrl(m.orgSpace.slug)}#/join/${token}`;
	};
	const ROLE = { admin: 'Admin', member: 'Member', requested: 'Request sent' };
</script>

<h1 class="mb-6 flex items-center gap-3 font-display text-3xl text-(--accent)"><img src="org_gold.webp" alt="" class="h-10" />Organizations</h1>
{#if !me}
	{#if ownSignIn}<SignIn done={signedInNow} />{:else}<p class="text-muted" data-why>Sign in to Get Cache in this browser to make or join an organization's space.</p>{/if}
{:else if loaded}
	{#if approver}
		<section class="mb-10" data-drafts>
			<h2 class="mb-3 font-display text-2xl">Waiting for your approval ({waiting.length})</h2>
			{#each waiting as c (c.orgKey)}
				<div class="mb-3 flex max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-rule bg-surface p-4" data-draft={c.slug}>
					<div class="min-w-0 flex-1">
						<p class="font-display text-xl">{c.name}</p>
						<p class="text-sm break-all text-muted">{spaceUrl(c.slug)} · asked {new Date(c.createdAt).toLocaleDateString()}</p>
					</div>
					<button class="rt-fancy-btn rounded-lg px-4 py-1 font-display" onclick={act(() => decide(c.orgKey, 'approved'))} data-approve>Approve</button>
					<button class="btn-line" onclick={act(() => decide(c.orgKey, 'rejected'))} data-reject>Decline</button>
				</div>
			{:else}
				<p class="text-muted">Nothing is waiting. A new organization's space shows here until you approve or decline it.</p>
			{/each}
		</section>
	{/if}

	{#if list.length}
		<section class="mb-10 flex max-w-2xl flex-col gap-3" data-mine>
			<h2 class="font-display text-2xl">Yours</h2>
			{#each list as m (m.orgKey)}
				{@const s = m.orgSpace}
				<div class="rounded-xl border border-rule bg-surface p-4" data-org-card={s?.slug}>
					<div class="flex items-center gap-3">
						<img src={s?.logo ? logoUrl(s) : 'org_gold.webp'} alt="" class="h-12 w-12 shrink-0 object-contain" />
						<p class="min-w-0 flex-1 font-display text-xl">{s?.name ?? 'An organization not open yet'}</p>
						<span class="rounded-full border border-(--accent) px-2.5 py-0.5 text-sm text-(--accent)" data-role>{ROLE[m.role]}</span>
					</div>
					<p class="my-3 text-sm text-muted" data-status>
						{#if m.role === 'requested'}Your request to join is sent. An admin of {s?.name ?? 'this organization'} lets you in.
						{:else if s?.status === 'draft'}Waiting for approval. You can build forms and preview; members can't see it yet.
						{:else if s?.status === 'rejected'}Get Cache didn't approve this organization's space.
						{:else if m.role === 'admin'}Open: your members fill its forms in Get Cache, under Plugins.
						{:else}Open: fill its forms in Get Cache, under Plugins.{/if}
					</p>
					<div class="flex flex-wrap items-center gap-2">
						{#if s && m.role !== 'requested' && s.status !== 'rejected'}
							<a class="rt-fancy-btn rounded-lg px-4 py-1 font-display" href="{spaceUrl(s.slug)}#/company" data-open>Open</a>
						{/if}
						{#if s?.status === 'approved' && m.role === 'admin'}
							<button class="btn-line" onclick={invite(m)} data-invite-btn>Invite people</button>
							<a class="btn-line" href="{spaceUrl(s.slug)}#/company" data-requests>Requests ({m.asking})</a>
						{/if}
						<button class="ml-auto text-sm text-muted hover:text-ink" onclick={act(() => remove(m.orgKey, m.authId))} data-leave>{m.role === 'requested' ? 'Withdraw' : 'Leave'}</button>
					</div>
					{#if invites[m.orgKey]}
						<div class="mt-4 flex flex-wrap items-center gap-4" data-invite>
							<div class="h-32 w-32 bg-white p-1">{@html renderSVG(invites[m.orgKey])}</div>
							<div class="min-w-0 flex-1">
								<p class="mb-1 text-sm text-muted">Send this link, or let them scan the code. Opening it asks to join; you let them in under Requests.</p>
								<code class="text-sm break-all" data-link>{invites[m.orgKey]}</code>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}

	<section class="max-w-2xl" data-orgs>
		<h2 class="mb-1 font-display text-2xl">Make a space for another organization</h2>
		<p class="mb-3 text-sm text-muted">A space gives an organization its own web address, its forms and its members, who join from a private invite link.</p>
		{#each orgs as o (o.orgKey)}
			<div class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-surface p-4" data-org={o.orgName}>
				<img src="org_gold.webp" alt="" class="h-10 w-10 shrink-0 object-contain" />
				<div class="min-w-0 flex-1">
					<p class="font-display text-lg">{o.orgName || 'Unnamed organization'}</p>
					{#if o.found?.refused}<p class="text-sm text-muted" data-refused>{o.found.refused}</p>
					{:else if o.found?.taken}<p class="text-sm text-muted" data-taken>That name is taken: rename it in Get Cache to make its space.</p>
					{:else if o.found?.slug}<p class="text-sm break-all text-muted" data-slug>Its address: {spaceUrl(o.found.slug)}</p>{/if}
				</div>
				{#if o.found?.slug && !o.found.taken && !o.found.refused}
					<button class="rt-fancy-btn rounded-lg px-4 py-1 font-display" onclick={act(() => create(o.orgKey))} data-make>Make its space</button>
				{/if}
			</div>
		{:else}
			<p class="text-muted" data-none>
				{#if owned}Every organization you have in Get Cache already has a space.
				{:else}Add your organization in the Get Cache app first: Account → Contacts → Orgs. It shows here after your phone backs up.{/if}
			</p>
		{/each}
	</section>

	{#if ownSignIn}<button class="btn-line mt-10 text-sm" onclick={() => (signOut(), location.reload())} data-signout>Sign out of Get Cache Ops</button>{/if}
{/if}
{#if note}<p class="mt-4 text-sm text-muted" data-note>{note}</p>{/if}
