<script lang="ts">
	import { renderSVG } from 'uqr';
	import { inviteToken, join, members, remove, resetInvite, setRole, spaceUrl, uploadLogo, type Member, type Space } from './central';
	import SignIn from './SignIn.svelte';
	import Builder from '../forms/Builder.svelte';
	import Forms from '../forms/Forms.svelte';
	import Report from '../forms/Report.svelte';

	let { slug, company, me, token, reload, signedInNow }: {
		slug: string;
		company: Space | null | undefined;
		me: { authId: string } | null;
		token?: string;
		reload: () => Promise<void>;
		signedInNow: () => void;
	} = $props();

	let people = $state<Member[]>([]);
	let invite = $state<string>();
	let note = $state('');
	const admin = $derived(company?.role === 'admin');
	const requests = $derived(people.filter((p) => p.role === 'requested'));
	const team = $derived(people.filter((p) => p.role !== 'requested'));
	const link = $derived(invite && `${spaceUrl(slug)}#/join/${invite}`);
	// #/company/form/<formId|new> and #/company/report/<formId>: an admin's form pages.
	let hash = $state(location.hash);
	const [, sub, formId] = $derived(hash.replace(/^#\/?/, '').split('/'));

	async function loadAdmin() {
		if (company && admin) [people, invite] = await Promise.all([members(company.orgKey), inviteToken(company.orgKey)]);
	}
	$effect(() => void loadAdmin().catch((e) => (note = e.message)));

	// Opening the invite link signed in sends a join request.
	$effect(() => {
		if (!token || !me) return;
		join(token).then(
			async (org) => {
				if (!org) note = 'This invite link no longer works: ask an admin for the new one.';
				await reload();
				location.hash = '#/company';
			},
			(e) => ((note = e.message), (location.hash = '#/company')),
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

<svelte:window onhashchange={() => (hash = location.hash)} />

{#if company === undefined}
	<p class="text-muted">Opening {slug}…</p>
{:else if company === null}
	<h1 class="mb-4 font-display text-3xl text-(--accent)" data-notfound>Not found</h1>
	<p class="text-muted">No company has the address {slug}.{me ? '' : ' A company still in draft shows only to its admins: sign in to see yours.'}</p>
	{#if !me}<div class="mt-6"><SignIn done={signedInNow} /></div>{/if}
{:else if admin && sub === 'form'}
	{#key formId}<Builder orgKey={company.orgKey} {formId} />{/key}
{:else if admin && sub === 'report'}
	<Report orgKey={company.orgKey} {formId} />
{:else}
	<h1 class="mb-2 font-display text-3xl text-(--accent)">{company.name}</h1>
	{#if company.status !== 'approved'}
		<p class="mb-4 text-muted" data-status>{company.status === 'draft' ? 'Draft: only its admins see it until Get Cache approves it.' : 'Get Cache did not approve this company.'}</p>
	{/if}

	{#if !me}
		<SignIn done={signedInNow} />
	{:else if token}
		<p class="text-muted">Sending your request…</p>
	{:else if company.role === null}
		<p class="text-muted" data-role>To join, ask an admin of {company.name} for its invite link.</p>
	{:else if company.role === 'requested'}
		<p class="text-muted" data-role>Request sent. An admin of {company.name} lets you in.</p>
		<button class="mt-2 text-sm text-muted underline" onclick={act(() => remove(company.orgKey, me.authId))} data-leave>Withdraw</button>
	{:else}
		<p class="text-muted" data-role>You are {company.role === 'admin' ? 'an admin' : 'a member'} here.
			<button class="text-sm underline" onclick={act(() => remove(company.orgKey, me.authId))} data-leave>Leave</button>
		</p>
	{/if}

	{#if admin}
		{#if requests.length}
			<section class="mt-8" data-requests>
				<h2 class="mb-2 font-display text-2xl">Asking to join</h2>
				{#each requests as p (p.authId)}
					<div class="flex flex-wrap items-center gap-4 border-b border-rule py-1" data-request={p.email}>
						<span>{p.email}</span>
						<button class="underline" onclick={act(() => setRole(company.orgKey, p.authId, 'member'))} data-let-in>Approve</button>
						<button class="text-sm text-muted underline" onclick={act(() => remove(company.orgKey, p.authId))} data-decline>Decline</button>
					</div>
				{/each}
			</section>
		{/if}

		<Forms orgKey={company.orgKey} />

		<section class="mt-8" data-members>
			<h2 class="mb-2 font-display text-2xl">People</h2>
			<table class="text-left">
				<tbody>
					{#each team as p (p.authId)}
						<tr class="border-b border-rule" data-member={p.email}>
							<td class="py-1 pr-4">{p.email}</td>
							<td class="pr-4">
								<select value={p.role} onchange={(e) => act(() => setRole(company.orgKey, p.authId, e.currentTarget.value as Member['role']))()} data-role-pick>
									<option value="admin">admin</option>
									<option value="member">member</option>
								</select>
							</td>
							<td>{#if p.authId !== me?.authId}<button class="text-sm text-muted underline" onclick={act(() => remove(company.orgKey, p.authId))} data-remove>Remove</button>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="mt-8" data-invites>
			<h2 class="mb-2 font-display text-2xl">Invite link</h2>
			<p class="mb-2 text-sm text-muted">Send it, or show the code, only to people you want. Opening it sends you a request to approve here. Reset it and the old link stops working at once.</p>
			{#if link}
				<div class="mb-4 flex flex-wrap items-center gap-4" data-invite>
					<div class="h-32 w-32 bg-white p-1">{@html renderSVG(link)}</div>
					<code class="text-sm break-all" data-link>{link}</code>
				</div>
			{/if}
			<button class="text-sm text-muted underline" onclick={act(() => resetInvite(company.orgKey))} data-reset>Reset the link</button>
		</section>

		<section class="mt-8 flex flex-col gap-2">
			<h2 class="font-display text-2xl">Logo</h2>
			<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={pickLogo} data-logo />
		</section>
	{/if}
{/if}
{#if note}<p class="mt-4 text-sm text-muted" data-note>{note}</p>{/if}
