<script lang="ts">
	import FormView from '../../_rapper/gc/FormView.svelte';
	import type { Snippet } from 'svelte';
	import { blank, fromDefinition, keys, KINDS, toDefinition, type Field, type Kind, type Store, type Version } from './forms';

	let { store, back, logo, byline, meta }: {
		store: Store;
		back: [href: string, label: string];
		logo?: Snippet;
		byline?: Snippet;
		/** Kept beside the form (credit, logo): a change to it saves like a change to a field. */
		meta?: unknown;
	} = $props();

	let versions = $state<Version[]>([]);
	let title = $state('');
	let fields = $state<Field[]>([]);
	let rest = $state<ReturnType<typeof fromDefinition>['rest']>({});
	let note = $state('');
	// A refusal flashes red, again on every press, so a second tap is not met with silence.
	let refusals = $state(0);
	let selected = $state<Field>();
	const latest = $derived(versions.at(-1));
	const draft = $derived(latest && !latest.publishedAt ? latest : undefined);
	// A key is locked once any version holding it is published.
	const locked = $derived(new Set(versions.filter((v) => v.publishedAt).flatMap((v) => keys(v.definition).map((k) => k.key))));
	const definition = $derived(toDefinition(title, fields, rest));

	// What the store holds: an autosaving store is written only when this changes.
	let kept = '';
	const now = () => JSON.stringify([$state.snapshot(definition), meta]);

	async function load() {
		versions = await store.load();
		if (latest) ({ title, fields, rest } = fromDefinition(latest.definition));
		kept = now();
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	$effect(() => {
		const key = now();
		if (!store.autosave || !kept || key === kept) return;
		const t = setTimeout(async () => {
			try {
				kept = key;
				await store.save(JSON.parse(key)[0], draft?.id);
				versions = await store.load();
			} catch (e) {
				note = (e as Error).message;
				refusals++;
			}
		}, 400);
		return () => clearTimeout(t);
	});

	const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 40);
	function relabel(f: Field, label: string) {
		if (!locked.has(f.key) && (!f.key || f.key === keyOf(f.label))) f.key = keyOf(label);
		f.label = label;
	}
	const move = (i: number, by: number) => fields.splice(i + by, 0, ...fields.splice(i, 1));
	// GPS is named by what it is, never by the maker, and a form asks for location once.
	const hasGps = $derived(fields.some((f) => f.kind === 'gps'));
	function add(kind: Kind) {
		fields.push(kind === 'gps' ? { ...blank(kind), key: 'gps', label: 'GPS' } : blank(kind));
		selected = fields.at(-1);
	}

	async function save(then?: 'publish') {
		note = '';
		try {
			if (!store.autosave || now() !== kept) await store.save($state.snapshot(definition), draft?.id);
			versions = await store.load();
			if (then) await store.publish(draft?.id);
			await load();
			note = then ? `Published version ${latest?.version}.` : `Saved draft version ${latest?.version}.`;
			refusals = 0;
		} catch (e) {
			note = (e as Error).message;
			refusals++;
		}
	}

	const ADD: [Kind, string][] = [['text', 'Text'], ['number', 'Number'], ['dropdown', 'Choice'], ['checkbox', 'Checkboxes'], ['date', 'Date'], ['file', 'Photo'], ['gps', 'GPS'], ['section', 'Section']];
	const CHOICE = 'M8 6h12M8 12h12M8 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2';
	const ICON: Record<Kind, string> = {
		text: 'M4 7V5h16v2M12 5v14M9 19h6',
		number: 'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
		dropdown: CHOICE,
		radiogroup: CHOICE,
		checkbox: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12l3 3 5-6',
		date: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
		file: 'M4 8h3l2-3h6l2 3h3v11H4zM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
		gps: '',
		section: 'M4 5h16M4 10h10M4 15h16M4 20h10',
	};
	const input = 'rounded-lg border border-rule bg-surface px-3 py-2';
	const ghost = 'rounded-lg border border-rule px-3 py-2 text-muted';
</script>

{#snippet icon(kind: Kind, size = 22)}
	{#if kind === 'gps'}<img src="locate_icon_gold.webp" alt="" style:height="{size}px" style:width="auto" />
	{:else}<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={kind === 'section' ? 'var(--rt-rust)' : 'var(--accent)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICON[kind]} /></svg>{/if}
{/snippet}
{#snippet gpsNote()}<span class="block text-sm text-muted" data-gps-note>Needs location services on to collect field data.</span>{/snippet}

{#snippet card(f: Field, i: number, inSection: boolean)}
	{@const on = selected === f}
	{@const section = f.kind === 'section'}
	<div class="card {on ? 'on' : ''} {section ? 'section' : ''} {inSection ? 'ml-8' : ''}" data-build={f.key} data-kind={f.kind}>
		{#if on}
			<div class="flex flex-wrap items-center gap-3">
				{@render icon(f.kind)}
				{#if f.kind === 'gps'}<span class="flex-1 text-xl font-semibold">GPS{@render gpsNote()}</span>
				{:else}<input class="label" placeholder={KINDS.find(([k]) => k === f.kind)?.[1]} value={f.label} oninput={(e) => relabel(f, e.currentTarget.value)} data-label />{/if}
				<button class="trash" onclick={() => (fields.splice(i, 1), (selected = undefined))} aria-label="Remove field" data-remove-field>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
				</button>
			</div>
			{#if f.kind !== 'gps'}<input class="{input} w-full" placeholder="Description (optional)" bind:value={f.description} data-description />{/if}
			<div class="flex flex-wrap items-center gap-3 text-sm">
				{#if f.kind !== 'gps'}<input class="{input} w-36 font-mono" placeholder="key" bind:value={f.key} disabled={locked.has(f.key)} title={locked.has(f.key) ? 'Published: this key is locked' : 'The column name in reports'} data-key />{/if}
				{#if !section}<label class="flex items-center gap-2"><input type="checkbox" class="tick" bind:checked={f.required} data-required /><span class="text-base"><span class="req">*</span>&nbsp;required</span></label>{/if}
				{#if f.kind === 'number'}
					<input class="{input} w-24" type="number" placeholder="min" value={f.min ?? ''} onchange={(e) => (f.min = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-min />
					<input class="{input} w-24" type="number" placeholder="max" value={f.max ?? ''} onchange={(e) => (f.max = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-max />
				{/if}
				<button class={ghost} disabled={i === 0} onclick={() => move(i, -1)} aria-label="Up">↑</button>
				<button class={ghost} disabled={i === fields.length - 1} onclick={() => move(i, 1)} aria-label="Down">↓</button>
			</div>
			{#if f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox'}
				<textarea class="{input} w-full max-w-sm text-base" rows="4" placeholder="One choice per line" value={f.choices.join('\n')}
					oninput={(e) => (f.choices = e.currentTarget.value.split('\n').map((c) => c.trim()).filter(Boolean))} data-choices></textarea>
			{/if}
		{:else}
			<button class="pick" onclick={() => (selected = f)} data-pick>
				{@render icon(f.kind)}
				<span class="flex-1 text-left">{f.label || KINDS.find(([k]) => k === f.kind)?.[1]}{#if f.kind === 'gps'}{@render gpsNote()}{:else if f.description}<span class="block text-sm font-normal text-muted">{f.description}</span>{/if}</span>
				{#if f.required}<span class="text-sm text-muted"><span class="req">*</span>&nbsp;required</span>{/if}
			</button>
		{/if}
	</div>
{/snippet}

<header class="mb-6 flex flex-wrap items-center gap-4 border-b border-rule pb-5">
	<a class="small-btn" href={back[0]} data-back
		><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{back[1]}</a
	>
	{@render logo?.()}
	<div class="flex min-w-56 flex-1 flex-col gap-1">
		<input class="title" placeholder="Name" bind:value={title} data-title />
		{@render byline?.()}
	</div>
	{#if !store.autosave}<button class="small-btn" onclick={() => save()} data-save>Save draft</button>{/if}
	<button class="rt-fancy-btn rounded-2xl px-9 py-3 font-display text-2xl" onclick={() => save('publish')} data-publish>Publish</button>
</header>
{#if note}{#key refusals}<p class="-mt-3 mb-4 {refusals ? 'refused' : 'text-muted'}" data-note>{note}</p>{/key}{/if}

<div class="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)_20rem]">
	<aside class="flex flex-wrap gap-2.5 lg:flex-col" aria-label="Add a field">
		<span class="w-full text-sm font-bold tracking-wider text-muted">ADD</span>
		{#each ADD as [kind, name] (kind)}
			<button class="add {kind === 'section' ? 'section' : ''}" disabled={kind === 'gps' && hasGps} onclick={() => add(kind)} data-add-field={kind}>{@render icon(kind, 24)}{name}</button>
		{/each}
	</aside>
	<section class="flex min-w-0 flex-col gap-3" aria-label="The form" data-fields>
		{#each fields as f, i (f)}{@render card(f, i, f.kind !== 'section' && fields.slice(0, i).some((s) => s.kind === 'section'))}{/each}
	</section>
	<aside class="phone" aria-label="Phone preview" data-preview>
		<FormView {definition} onsubmit={() => {}} />
	</aside>
</div>

<style>
	.title {
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		outline: none;
		font-family: var(--font-display, inherit);
		font-size: 2.1rem;
		line-height: 1.1;
	}
	.title:focus {
		border-bottom-color: var(--accent);
	}
	.req {
		color: #ff4d55;
		font-size: 1.4em;
		font-weight: 800;
		line-height: 0;
		vertical-align: -0.25em;
	}
	/* The browser's white box vanished on the dark card: black box, thick grey rim, gold tick. */
	.tick {
		appearance: none;
		display: grid;
		place-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border: 3px solid #6b6458;
		border-radius: 0.4rem;
		background: #000;
		cursor: pointer;
	}
	.tick:checked {
		border-color: var(--accent);
	}
	.tick:checked::before {
		content: '';
		width: 0.85rem;
		height: 0.85rem;
		background: var(--accent);
		clip-path: polygon(14% 44%, 0 65%, 40% 100%, 100% 22%, 84% 6%, 39% 69%);
	}
	.add {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-radius: 0.9rem;
		border: 2px solid #3a352e;
		background: #1a1a1a;
		font-weight: 600;
		font-size: 1.2rem;
	}
	.add.section {
		border-color: var(--rt-rust);
	}
	.add:disabled {
		opacity: 0.35;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border: 2px solid #3a352e;
		border-radius: 1rem;
		background: #1a1a1a;
	}
	.card.on {
		padding: 1rem 1.25rem;
		border-color: var(--accent);
		background: #1f1c14;
	}
	.card.section {
		border-color: var(--rt-rust);
	}
	.refused {
		color: #ff4d55;
		font-weight: 700;
		animation: flash 0.9s ease-out;
	}
	@keyframes flash {
		0%, 40% { background: color-mix(in srgb, #ff4d55 30%, transparent); }
		100% { background: transparent; }
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		width: 100%;
		padding: 1rem 1.25rem;
		font-size: 1.3rem;
		font-weight: 600;
	}
	.label {
		flex: 1;
		min-width: 10rem;
		background: transparent;
		border: none;
		border-bottom: 2px solid var(--accent);
		outline: none;
		font-size: 1.3rem;
		font-weight: 600;
	}
	.trash {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid #4a443c;
		border-radius: 0.75rem;
		color: #c9c3b7;
	}
	.phone {
		align-self: start;
		max-height: 44rem;
		overflow-y: auto;
		padding: 1.1rem;
		border: 3px solid #3a352e;
		border-radius: 2.25rem;
		background: #0a0a0a;
	}
</style>
