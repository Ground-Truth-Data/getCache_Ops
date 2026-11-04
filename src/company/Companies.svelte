<script lang="ts">
	import { ownSignIn, signOut } from '../data/auth';
	import { ask, check, create, isApprover, mine, remove, spaceUrl } from './central';
	import SignIn from './SignIn.svelte';

	let { me, signedInNow }: { me: { authId: string } | null; signedInNow: () => void } = $props();
	let list = $state<Awaited<ReturnType<typeof mine>>>([]);
	let approver = $state(false);
	let name = $state('');
	let found = $state<Awaited<ReturnType<typeof check>> | null>(null);
	let note = $state('');

	async function load() {
		if (!me) return;
		[list, approver] = await Promise.all([mine(me.authId), isApprover(me.authId)]);
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	let timer: ReturnType<typeof setTimeout>;
	function typed() {
		clearTimeout(timer);
		found = null;
		note = '';
		if (name.trim().length < 2) return;
		timer = setTimeout(() => check(name.trim()).then((f) => (found = f), (e) => (note = e.message)), 250);
	}

	const act = (run: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await run();
			await load();
		} catch (e) {
			note = (e as Error).message;
		}
	};
	const make = act(async () => {
		await create(name.trim());
		name = '';
		found = null;
	});
</script>

<h1 class="mb-6 font-display text-3xl text-(--accent)">Companies</h1>
{#if !me}
	{#if ownSignIn}<SignIn done={signedInNow} />{:else}<p class="text-muted" data-why>Sign in to Get Cache in this browser to make or join a company.</p>{/if}
{:else}
	{#if approver}<p class="mb-4"><a class="underline" href="#/approve" data-approve-link>Companies waiting for approval</a></p>{/if}
	{#if ownSignIn}<button class="mb-4 text-sm text-muted underline" onclick={() => (signOut(), location.reload())} data-signout>Sign out of Get Cache Ops</button>{/if}

	<ul class="mb-8 flex flex-col gap-2" data-mine>
		{#each list as m (m.companyId)}
			<li class="flex flex-wrap items-center gap-3">
				{#if m.company}<a class="font-display text-xl underline" href={spaceUrl(m.company.slug)}>{m.company.name}</a><span class="text-sm text-muted">{m.company.status}</span>{:else}<span class="font-display text-xl">A company not open yet</span>{/if}
				<span class="text-sm text-muted">{m.role === 'asked' ? 'asked to join' : m.role}</span>
				<button class="text-sm text-muted underline" onclick={act(() => remove(m.companyId, m.authId))} data-leave>{m.role === 'asked' ? 'Withdraw' : 'Leave'}</button>
			</li>
		{:else}
			<li class="text-muted">You are in no company yet.</li>
		{/each}
	</ul>

	<form class="flex max-w-md flex-col gap-2" onsubmit={(e) => (e.preventDefault(), found?.slug && !found.takenId && make())} data-create>
		<label class="font-display text-xl" for="company-name">Make a company</label>
		<input id="company-name" class="rounded-lg border border-rule bg-surface px-3 py-2" placeholder="Company name" bind:value={name} oninput={typed} data-name />
		{#if found?.refused}
			<p class="text-muted" data-refused>{found.refused}</p>
		{:else if found?.takenId}
			<p class="text-muted" data-taken>{found.takenName} already has that address.
				<button type="button" class="underline" onclick={act(() => ask(found!.takenId!, me.authId))} data-ask-join>Ask to join</button>
			</p>
		{:else if found?.slug}
			<p class="text-sm text-muted" data-slug>Its address: {spaceUrl(found.slug)}</p>
			<button class="rt-fancy-btn self-start rounded-lg px-4 py-1 font-display text-lg" data-make>Make it</button>
		{/if}
	</form>
{/if}
{#if note}<p class="mt-4 text-sm text-muted" data-note>{note}</p>{/if}
