<script lang="ts">
	import { renderSVG } from 'uqr';
	import { ask, invite, invites, join, members, remove, setRole, spaceUrl, uploadLogo, withdraw, type Invite, type Member, type Space } from './central';
	import SignIn from './SignIn.svelte';

	let { slug, company, me, token, reload, signedInNow }: {
		slug: string;
		company: Space | null | undefined;
		me: { authId: string } | null;
		token?: string;
		reload: () => Promise<void>;
		signedInNow: () => void;
	} = $props();

	let people = $state<Member[]>([]);
	let links = $state<Invite[]>([]);
	let note = $state('');
	const admin = $derived(company?.role === 'admin');
	const link = (t: string) => `${spaceUrl(slug)}#/join/${t}`;

	async function loadAdmin() {
		if (company && admin) [people, links] = await Promise.all([members(company.orgKey), invites(company.orgKey)]);
	}
	$effect(() => void loadAdmin().catch((e) => (note = e.message)));

	// Opening an invite link signed in joins at once.
	$effect(() => {
		if (!token || !me) return;
		join(token).then(
			async () => ((location.hash = '#/company'), await reload()),
			(e) => (note = e.message),
		);
	});

	const act = (run: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await run();
			await reload();
			await loadAdmin();
		} catch (e) {
			note = (e as Error).message;
		}
	};
	const pickLogo = (e: Event & { currentTarget: HTMLInputElement }) => {
		const file = e.currentTarget.files?.[0];
		if (file && company) act(() => uploadLogo(company.orgKey, file))();
	};
</script>

{#if company === undefined}
	<p class="text-muted">Opening {slug}…</p>
{:else if company === null}
	<h1 class="mb-4 font-display text-3xl text-(--accent)" data-notfound>Not found</h1>
	<p class="text-muted">No company has the address {slug}.{me ? '' : ' A company still in draft shows only to its admins: sign in to see yours.'}</p>
	{#if !me}<div class="mt-6"><SignIn done={signedInNow} /></div>{/if}
{:else}
	<h1 class="mb-2 font-display text-3xl text-(--accent)">{company.name}</h1>
	{#if company.status !== 'approved'}
		<p class="mb-4 text-muted" data-status>{company.status === 'draft' ? 'Draft: only its admins see it until Get Cache approves it.' : 'Get Cache did not approve this company.'}</p>
	{/if}

	{#if !me}
		<SignIn done={signedInNow} />
	{:else if token}
		<p class="text-muted">Joining…</p>
	{:else if company.role === null}
		<button class="rt-fancy-btn rounded-lg px-4 py-1 font-display text-lg" onclick={act(() => ask(company.orgKey, me.authId))} data-ask-join>Ask to join</button>
	{:else if company.role === 'asked'}
		<p class="text-muted" data-role>Your request to join is with its admins.</p>
		<button class="mt-2 text-sm text-muted underline" onclick={act(() => remove(company.orgKey, me.authId))} data-leave>Withdraw</button>
	{:else}
		<p class="text-muted" data-role>You are {company.role === 'admin' ? 'an admin' : company.role} here.
			<button class="text-sm underline" onclick={act(() => remove(company.orgKey, me.authId))} data-leave>Leave</button>
		</p>
	{/if}

	{#if admin}
		<section class="mt-8 flex flex-col gap-2">
			<h2 class="font-display text-2xl">Logo</h2>
			<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={pickLogo} data-logo />
		</section>

		<section class="mt-8" data-members>
			<h2 class="mb-2 font-display text-2xl">People</h2>
			<table class="text-left">
				<tbody>
					{#each people as p (p.authId)}
						<tr class="border-b border-rule" data-member={p.email}>
							<td class="py-1 pr-4">{p.email}</td>
							<td class="pr-4">
								{#if p.role === 'asked'}
									<button class="underline" onclick={act(() => setRole(company.orgKey, p.authId, 'crew'))} data-let-in>Let in</button>
								{:else}
									<select value={p.role} onchange={(e) => act(() => setRole(company.orgKey, p.authId, e.currentTarget.value as Member['role']))()} data-role-pick>
										<option value="admin">admin</option>
										<option value="crew">crew</option>
										<option value="follower">follower</option>
									</select>
								{/if}
							</td>
							<td>{#if p.authId !== me?.authId}<button class="text-sm text-muted underline" onclick={act(() => remove(company.orgKey, p.authId))} data-remove>Remove</button>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="mt-8" data-invites>
			<h2 class="mb-2 font-display text-2xl">Invite crew</h2>
			<p class="mb-2 text-sm text-muted">Anyone who opens a link, or scans its code, joins as crew. Withdraw a link to stop it working.</p>
			{#each links as l (l.token)}
				<div class="mb-4 flex flex-wrap items-center gap-4" data-invite>
					<div class="h-32 w-32 bg-white p-1">{@html renderSVG(link(l.token))}</div>
					<div class="flex flex-col gap-1">
						<code class="text-sm break-all" data-link>{link(l.token)}</code>
						<button class="self-start text-sm text-muted underline" onclick={act(() => withdraw(l.token))} data-withdraw>Withdraw</button>
					</div>
				</div>
			{/each}
			<button class="rt-fancy-btn rounded-lg px-4 py-1 font-display text-lg" onclick={act(() => invite(company.orgKey))} data-new-invite>New invite link</button>
		</section>
	{/if}
{/if}
{#if note}<p class="mt-4 text-sm text-muted" data-note>{note}</p>{/if}
