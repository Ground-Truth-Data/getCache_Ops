<script lang="ts">
	import { ownSignIn, signOut } from '../data/auth';
	import { ask, check, create, isApprover, mine, myOrgs, remove, spaceUrl, type Org } from './central';
	import SignIn from './SignIn.svelte';

	let { me, signedInNow }: { me: { authId: string } | null; signedInNow: () => void } = $props();
	let list = $state<Awaited<ReturnType<typeof mine>>>([]);
	let orgs = $state<(Org & { found?: Awaited<ReturnType<typeof check>> })[]>([]);
	let approver = $state(false);
	let note = $state('');

	async function load() {
		if (!me) return;
		const [m, o, a] = await Promise.all([mine(me.authId), myOrgs(me.authId), isApprover(me.authId)]);
		[list, approver] = [m, a];
		// An org already a space you belong to is listed above, not offered again.
		const spaced = new Set(m.map((x) => x.orgKey));
		orgs = await Promise.all(o.filter((x) => !spaced.has(x.orgKey)).map(async (x) => ({ ...x, found: await check(x.orgName) })));
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
</script>

<h1 class="mb-6 font-display text-3xl text-(--accent)">Companies</h1>
{#if !me}
	{#if ownSignIn}<SignIn done={signedInNow} />{:else}<p class="text-muted" data-why>Sign in to Get Cache in this browser to make or join a company.</p>{/if}
{:else}
	{#if approver}<p class="mb-4"><a class="underline" href="#/approve" data-approve-link>Companies waiting for approval</a></p>{/if}
	{#if ownSignIn}<button class="mb-4 text-sm text-muted underline" onclick={() => (signOut(), location.reload())} data-signout>Sign out of Get Cache Ops</button>{/if}

	<ul class="mb-8 flex flex-col gap-2" data-mine>
		{#each list as m (m.orgKey)}
			<li class="flex flex-wrap items-center gap-3">
				{#if m.orgSpace}<a class="font-display text-xl underline" href={spaceUrl(m.orgSpace.slug)}>{m.orgSpace.name}</a><span class="text-sm text-muted">{m.orgSpace.status}</span>{:else}<span class="font-display text-xl">A company not open yet</span>{/if}
				<span class="text-sm text-muted">{m.role === 'asked' ? 'asked to join' : m.role}</span>
				<button class="text-sm text-muted underline" onclick={act(() => remove(m.orgKey, m.authId))} data-leave>{m.role === 'asked' ? 'Withdraw' : 'Leave'}</button>
			</li>
		{:else}
			<li class="text-muted">You are in no company yet.</li>
		{/each}
	</ul>

	<h2 class="mb-1 font-display text-xl">Your organizations in Get Cache</h2>
	<p class="mb-3 text-sm text-muted">Make one a company space: it gets its own web address, and crew join it from a link.</p>
	<ul class="flex max-w-xl flex-col gap-3" data-orgs>
		{#each orgs as o (o.orgKey)}
			<li class="flex flex-col gap-1" data-org={o.orgName}>
				<span class="font-display text-lg">{o.orgName || 'Unnamed organization'}</span>
				{#if o.found?.refused}
					<span class="text-sm text-muted" data-refused>{o.found.refused}</span>
				{:else if o.found?.takenKey}
					<span class="text-sm text-muted" data-taken>{o.found.takenName} already has that address.
						<button class="underline" onclick={act(() => ask(o.found!.takenKey!, me.authId))} data-ask-join>Ask to join</button>
					</span>
				{:else if o.found?.slug}
					<span class="text-sm text-muted" data-slug>Its address: {spaceUrl(o.found.slug)}</span>
					<button class="rt-fancy-btn self-start rounded-lg px-4 py-1 font-display" onclick={act(() => create(o.orgKey))} data-make>Make it a company space</button>
				{/if}
			</li>
		{:else}
			<li class="text-muted">No organizations yet. Add your company in Get Cache first; it shows here once your phone backs up.</li>
		{/each}
	</ul>
{/if}
{#if note}<p class="mt-4 text-sm text-muted" data-note>{note}</p>{/if}
