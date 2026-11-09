<script lang="ts">
	import { renderSVG } from 'uqr';
	import { appHome, dropFromSuite, inviteToken, join, members, opsHome, remove, resetInvite, setRole, spaceUrl, suiteLink, uploadLogo, type Member, type Space } from './central';
	import { companyPlugins, type PluginRow } from '../forms/plugins';
	import Info from './Info.svelte';
	import OrgLogo from './OrgLogo.svelte';
	import SignIn from './SignIn.svelte';
	import Builder from '../forms/Builder.svelte';
	import Forms from '../forms/Forms.svelte';
	import Report from '../forms/Report.svelte';
	import { orgAnswers, orgStore } from '../forms/forms';
	import { go, route } from '../app/route.svelte';

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
	const link = $derived(invite && `${spaceUrl(slug)}join/${invite}`);
	// company/<forms|invite|requests|people>, company/form/<formId|new>, company/report/<formId>.
	const [, sub, formId] = $derived(route.path.split('?')[0].split('/'));

	let suite = $state<string>();
	let suiteForms = $state<PluginRow[]>([]);
	async function loadSpace() {
		if (company && (company.role === 'admin' || company.role === 'member'))
			[suite, suiteForms] = await Promise.all([suiteLink(company.orgKey), companyPlugins(company.orgKey)]);
		if (company && admin) [people, invite] = await Promise.all([members(company.orgKey), inviteToken(company.orgKey)]);
	}
	$effect(() => void loadSpace().catch((e) => (note = e.message)));

	const act = (run: () => Promise<unknown>) => async () => {
		note = '';
		try {
			await run();
			await reload();
			await loadSpace();
		} catch (e) {
			note = (e as Error).message;
		}
	};
	const ask = act(async () => {
		if (!(await join(token!))) throw new Error('This invite link no longer works. Ask for a new one.');
		go('company', true);
	});
	const pickLogo = (e: Event & { currentTarget: HTMLInputElement }) => {
		const file = e.currentTarget.files?.[0];
		if (file && company) act(() => uploadLogo(company.orgKey, file))();
	};
	let copied = $state('');
	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = text;
		setTimeout(() => (copied = ''), 1500);
	}
</script>


{#snippet back(href: string, label: string)}
	<a class="small-btn mb-7 print:hidden" {href} data-back
		><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{label}</a
	>
{/snippet}

{#snippet chips(c: Space)}
	<span class="flex flex-wrap gap-2.5">
		{#if c.role === 'admin' || c.role === 'member'}<span class="chip chip-gold" data-role>{c.role === 'admin' ? 'Admin' : 'Member'}</span>{/if}
	</span>
{/snippet}

{#snippet tile(href: string, label: string, path: string, gold = false, count = 0)}
	<a class="tile {gold ? 'tile-gold rt-fancy-btn' : ''}" {href} data-tile={label}>
		{#if count}<span class="badge absolute top-4 right-4" data-count>{count}</span>{/if}
		<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={gold ? 'currentColor' : 'var(--accent)'} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={path} /></svg>
		{label}
	</a>
{/snippet}

{#if company === undefined}
	<p class="text-muted">Opening {slug}…</p>
{:else if company === null}
	<div class="flex flex-col items-start gap-4">
		<h1 class="font-display text-4xl text-(--accent)" data-notfound>Not found</h1>
		{#if !me}<SignIn done={signedInNow} />{/if}
	</div>
{:else if !me}
	<div class="mx-auto flex max-w-sm flex-col items-center gap-7 pt-6">
		<OrgLogo logo={company.logo} size={8.75} />
		<h1 class="text-center font-display text-4xl">{company.name}</h1>
		<SignIn done={signedInNow} />
	</div>
{:else if company.role === null || company.role === 'requested'}
	<!-- What a phone sees from an invite link: who, one button, then done. -->
	<div class="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center gap-7 pt-6" data-join-flow>
		{#if company.role === 'requested'}
			<span class="flex h-36 w-36 items-center justify-center rounded-full bg-(--accent) text-[#111]"
				><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span
			>
			<h1 class="text-center font-display text-5xl" data-sent>Request sent</h1>
			<span class="text-center text-xl text-[#c9c3b7]">{company.name}</span>
			<a class="big-btn mt-auto w-full" href={appHome} data-done>Done</a>
		{:else}
			<OrgLogo logo={company.logo} size={8.75} />
			<h1 class="text-center font-display text-4xl">{company.name}</h1>
			{#if token}
				<button class="big-btn gold rt-fancy-btn mt-auto w-full" onclick={ask} data-ask>Ask to join</button>
			{:else}
				<Info label="How to join">Ask an admin of {company.name} for the invite link or its QR code.</Info>
			{/if}
		{/if}
	</div>
{:else if admin && sub === 'form'}
	{#key formId}<Builder store={orgStore(company.orgKey, formId)} edit={(id) => `company/form/${id}`} back={['company/forms', 'Forms']} />{/key}
{:else if admin && sub === 'report'}
	<Report load={() => orgAnswers(formId)} back={['company/forms', 'Forms']} />
{:else if admin && sub === 'forms'}
	{@render back('company', company.name)}
	<Forms orgKey={company.orgKey} />
{:else if admin && sub === 'invite'}
	{@render back('company', company.name)}
	<div class="mb-6 flex items-center gap-4 print:hidden">
		<h1 class="font-display text-5xl text-(--accent)">Invite people</h1>
		<Info label="How inviting works">Anyone who opens the link or scans the code can ask to join. You let them in under Requests. A new link stops the old one.</Info>
	</div>
	{#if link}
		<div class="flex flex-wrap items-center gap-12 print:hidden" data-invite>
			<div class="h-80 w-80 rounded-3xl bg-[#f4efe6] p-6" data-qr>{@html renderSVG(link)}</div>
			<div class="flex w-full max-w-md flex-col gap-5">
				<button class="big-btn gold rt-fancy-btn" onclick={() => copy(link)} data-copy-link>{copied === link ? 'Copied' : 'Copy link'}</button>
				<button class="big-btn" onclick={() => print()} data-print>Print poster</button>
				<button class="small-btn justify-center py-4 text-lg" onclick={act(() => resetInvite(company.orgKey))} data-reset>New link (old one stops working)</button>
			</div>
		</div>
		<!-- The poster: only what prints. -->
		<div class="hidden flex-col items-center gap-10 pt-10 text-black print:flex" data-poster>
			<h1 class="text-center font-display text-6xl">{company.name}</h1>
			<div class="h-[28rem] w-[28rem]">{@html renderSVG(link)}</div>
			<p class="font-display text-3xl">Scan to join</p>
		</div>
	{/if}
{:else if admin && sub === 'requests'}
	{@render back('company', company.name)}
	<h1 class="mb-6 font-display text-5xl text-(--accent)">Requests</h1>
	<div class="flex max-w-3xl flex-col gap-4" data-requests>
		{#each requests as p (p.authId)}
			<div class="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[#3a352e] bg-[#1a1a1a] px-6 py-4" data-request={p.email}>
				<span class="flex-1 text-xl break-all">{p.email}</span>
				<button class="rt-fancy-btn rounded-2xl px-7 py-2.5 font-display text-2xl" onclick={act(() => setRole(company.orgKey, p.authId, 'member'))} data-let-in>Let in</button>
				<button class="small-btn rounded-2xl border-2 px-6 py-2.5 text-lg" onclick={act(() => remove(company.orgKey, p.authId))} data-decline>Decline</button>
			</div>
		{:else}
			<p class="text-xl text-muted">No one is waiting.</p>
		{/each}
	</div>
{:else if admin && sub === 'people'}
	{@render back('company', company.name)}
	<h1 class="mb-6 font-display text-5xl text-(--accent)">People</h1>
	<div class="flex max-w-3xl flex-col gap-3" data-members>
		{#each team as p (p.authId)}
			<div class="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[#3a352e] bg-[#1a1a1a] px-6 py-3" data-member={p.email}>
				<span class="flex-1 text-xl break-all">{p.email}</span>
				<select class="rounded-lg border border-rule bg-field px-3 py-2 text-lg" value={p.role} onchange={(e) => act(() => setRole(company.orgKey, p.authId, e.currentTarget.value as Member['role']))()} data-role-pick>
					<option value="admin">Admin</option>
					<option value="member">Member</option>
				</select>
				{#if p.authId !== me.authId}<button class="small-btn" onclick={act(() => remove(company.orgKey, p.authId))} data-remove>Remove</button>{/if}
			</div>
		{/each}
	</div>
{:else}
	{@render back(`${opsHome}organizations`, 'Organizations')}
	<div class="mb-8 flex items-center gap-5">
		{#if admin}
			<label class="cursor-pointer" title="Change the logo" data-logo-pick>
				<OrgLogo logo={company.logo} size={5.25} />
				<input type="file" class="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={pickLogo} data-logo />
			</label>
		{:else}
			<OrgLogo logo={company.logo} size={5.25} />
		{/if}
		<div class="flex flex-col gap-2.5">
			<h1 class="font-display text-5xl text-(--accent)">{company.name}</h1>
			{@render chips(company)}
		</div>
	</div>
	{#if admin}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-tiles>
			{@render tile('company/forms', 'Forms', 'M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4', true)}
			{@render tile('company/invite', 'Invite people', 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3')}
			{@render tile('company/requests', 'Requests', 'M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M18 8v6M15 11h6', false, requests.length)}
			{@render tile('company/people', 'People', 'M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM2.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5M14.5 14.2c.8-.5 1.6-.7 2.5-.7 2.5 0 4.5 2 4.5 4.8')}
		</div>
	{:else}
		<Info label="Where the forms are">Fill this organization's forms in the Get Cache app, under its button at the bottom.</Info>
	{/if}
	{#if suite}
		<section class="mt-12 flex flex-wrap items-start gap-10" data-suite>
			<div class="h-56 w-56 shrink-0 rounded-3xl bg-[#f4efe6] p-5" data-suite-qr>{@html renderSVG(suite)}</div>
			<div class="flex max-w-xl min-w-0 flex-1 flex-col gap-4">
				<div class="flex items-center gap-4">
					<h2 class="font-display text-3xl text-(--accent)">The suite</h2>
					<Info label="What the suite is">Anyone who opens this link or scans the code gets {company.name}'s forms on their phone, with no sign-in. A dropped form greys out there; its answers stay.</Info>
				</div>
				<code class="rounded-xl border-2 border-[#3a352e] bg-[#1a1a1a] px-4 py-3 text-lg break-all text-[#d8d2c6]" data-suite-link>{suite}</code>
				<button class="big-btn gold rt-fancy-btn self-start px-10" onclick={() => copy(suite!)} data-copy-suite>{copied === suite ? 'Copied' : 'Copy link'}</button>
			</div>
		</section>
		<div class="mt-8 flex max-w-3xl flex-col gap-3" data-suite-forms>
			{#each suiteForms as p (p.id)}
				<div class="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[#3a352e] bg-[#1a1a1a] px-6 py-3" data-suite-form={p.id} data-dropped={!!p.droppedAt}>
					<span class="flex-1 text-xl" class:dropped={p.droppedAt}>{p.definition.title || 'Untitled'}{#if p.droppedAt}<span class="ml-3 text-base">dropped</span>{/if}</span>
					{#if admin}<button class="small-btn" onclick={act(() => dropFromSuite(p.id, !p.droppedAt))} data-drop>{p.droppedAt ? 'Back in suite' : 'Drop from suite'}</button>{/if}
				</div>
			{:else}
				<p class="text-lg text-muted">No forms published as {company.name} yet.</p>
			{/each}
		</div>
	{/if}
	<div class="mt-12 flex justify-end">
		<button class="small-btn" onclick={act(() => remove(company.orgKey, me.authId))} data-leave>Leave</button>
	</div>
{/if}
{#if note}<p class="mt-4 text-lg text-muted" data-note>{note}</p>{/if}

<style>
	.dropped {
		color: #6b6458;
	}
</style>
