<script lang="ts">
	import FormView from '../../_rapper/gc/FormView.svelte';
	import RowGrip from '../../_rapper/gc/RowGrip.svelte';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
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
	/** The field being edited, or 'head': the form's own title and description, which are section 1. */
	let selected = $state<Field | 'head'>();
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
		if (f.kind === 'section') f.key ||= keyFor('section');
		else if (!locked.has(f.key) && (!f.key || f.key === keyOf(f.label))) f.key = keyOf(label);
		f.label = label;
	}
	// Dragged by its grip, a card takes each place it passes: where it lands decides its section and group.
	let dragging = $state<number>();
	const grip = (i: number): Attachment<HTMLElement> => (el) => {
		el.draggable = true;
		el.ondragstart = (e) => ((dragging = i), e.dataTransfer?.setDragImage(el.parentElement!, 24, 24));
		el.ondragend = () => (dragging = undefined);
	};
	function over(e: DragEvent, i: number) {
		if (dragging === undefined) return;
		e.preventDefault();
		if (dragging !== i) (fields.splice(i, 0, ...fields.splice(dragging, 1)), (dragging = i));
	}
	// GPS is named by what it is, never by the maker, and a form asks for location once.
	const hasGps = $derived(fields.some((f) => f.kind === 'gps'));
	// As in the inbox: the form's head and each section are gold parents, every question is rust, and a nested
	// group's repeated questions sit a level deeper in sage.
	// Numbered like Google Forms: the form's head is section 1.
	const sectionNo = $derived.by(() => {
		let n = 1;
		return fields.map((f) => (f.kind === 'section' ? ++n : 0));
	});
	const sections = $derived(1 + fields.filter((f) => f.kind === 'section').length);
	const depths = $derived.by(() => {
		let deep = false;
		return fields.map((f) => (f.kind === 'section' ? ((deep = false), 0) : f.kind === 'nested' ? ((deep = true), 1) : deep ? 2 : 1));
	});
	// A section is only a heading: its key is never shown, but SurveyJS still needs one.
	const keyFor = (kind: Kind) => (kind === 'gps' ? 'gps' : kind === 'section' ? `section_${crypto.randomUUID().slice(0, 8)}` : '');
	function add(kind: Kind) {
		fields.push({ ...blank(kind), key: keyFor(kind), label: kind === 'gps' ? 'GPS' : '' });
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

	const ADD: [Kind, string][] = [['text', 'Text'], ['number', 'Number'], ['dropdown', 'Choice'], ['checkbox', 'Checkboxes'], ['date', 'Date'], ['file', 'Photo'], ['gps', 'GPS'], ['section', 'Section'], ['nested', 'Nested']];
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
		section: '',
		nested: '',
	};
	const input = 'rounded-lg border border-rule bg-surface px-3 py-2';
</script>

{#snippet icon(kind: Kind, size = 22)}
	<!-- Section and Nested are the form's shape: drawn bigger than any one field's icon. -->
	{#if kind === 'section' || kind === 'nested'}<img src="{kind}_icon.webp" alt="" style:height="{Math.round(size * 1.6)}px" style:width="auto" />
	{:else if kind === 'gps'}<img src="locate_icon_gold.webp" alt="" style:height="{size}px" style:width="auto" />
	{:else}<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICON[kind]} /></svg>{/if}
{/snippet}
{#snippet nth(n: number)}<span class="nth">Section {n} of {sections}</span>{/snippet}
{#snippet gpsNote()}<span class="block text-sm text-muted" data-gps-note>Needs location services on to collect field data.</span>{/snippet}

{#snippet card(f: Field, i: number)}
	{@const on = selected === f}
	{@const section = f.kind === 'section'}
	<!-- The inbox's row: the card on a grey track whose grip pokes out on the right. -->
	<div class="rt-row-track rt-row-track--grip track" class:rt-row-track--dragging={dragging === i} style:margin-left="{depths[i] * 2}rem"
		role="listitem" ondragover={(e) => over(e, i)} ondrop={(e) => e.preventDefault()}>
	<div class="card depth-{depths[i]} {on ? 'on' : ''}" data-build={f.key} data-kind={f.kind} data-depth={depths[i]}>
		{#if on}
			<div class="flex flex-wrap items-center gap-3">
				{@render icon(f.kind)}
				{#if f.kind === 'gps'}<span class="flex-1 text-xl font-semibold">GPS{@render gpsNote()}</span>
				{:else}<input class="label" placeholder={KINDS.find(([k]) => k === f.kind)?.[1]} value={f.label} oninput={(e) => relabel(f, e.currentTarget.value)} data-label />{/if}
				{#if section}{@render nth(sectionNo[i])}{/if}
				{#if f.kind === 'nested'}<input class="{input} w-36 font-bold" placeholder="+ Add" title="The add button's text on the phone" bind:value={f.addText} data-add-text />{/if}
				<button class="trash" onclick={() => (fields.splice(i, 1), (selected = undefined))} aria-label="Remove field" data-remove-field>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
				</button>
			</div>
			{#if f.kind !== 'gps'}<input class="{input} w-full" placeholder="Description (optional)" bind:value={f.description} data-description />{/if}
			<div class="flex flex-wrap items-center gap-3 text-sm">
				{#if f.kind !== 'gps' && !section}<input class="{input} w-36 font-mono" placeholder="key" bind:value={f.key} disabled={locked.has(f.key)} title={locked.has(f.key) ? 'Published: this key is locked' : 'The column name in reports'} data-key />{/if}
				{#if !section && f.kind !== 'nested'}<label class="flex items-center gap-2"><input type="checkbox" class="tick" bind:checked={f.required} data-required /><span class="text-base"><span class="req">*</span>&nbsp;required</span></label>{/if}
				{#if f.kind === 'number'}
					<input class="{input} w-24" type="number" placeholder="min" value={f.min ?? ''} onchange={(e) => (f.min = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-min />
					<input class="{input} w-24" type="number" placeholder="max" value={f.max ?? ''} onchange={(e) => (f.max = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-max />
				{/if}
			</div>
			{#if f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox'}
				<textarea class="{input} w-full max-w-sm text-base" rows="4" placeholder="One choice per line" value={f.choices.join('\n')}
					oninput={(e) => (f.choices = e.currentTarget.value.split('\n').map((c) => c.trim()).filter(Boolean))} data-choices></textarea>
			{/if}
		{:else}
			<button class="pick" onclick={() => (selected = f)} data-pick>
				{@render icon(f.kind)}
				{#if section}{@render nth(sectionNo[i])}{/if}
				<span class="flex-1 text-left">{f.label || KINDS.find(([k]) => k === f.kind)?.[1]}{#if f.kind === 'gps'}{@render gpsNote()}{:else if f.description}<span class="block text-sm font-normal text-muted">{f.description}</span>{/if}</span>
				{#if f.required}<span class="text-sm text-muted"><span class="req">*</span>&nbsp;required</span>{/if}
				{#if f.kind === 'nested'}<span class="add-text">{f.addText || '+ Add'}</span>{/if}
			</button>
		{/if}
	</div>
	<RowGrip attach={grip(i)} label="Drag to move" dragging={dragging === i} />
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
			<button class="add {kind === 'section' ? 'section' : kind === 'nested' ? 'nest' : ''}" disabled={kind === 'gps' && hasGps} onclick={() => add(kind)} data-add-field={kind}>{@render icon(kind, 24)}{name}</button>
		{/each}
	</aside>
	<section class="flex min-w-0 flex-col gap-3" aria-label="The form" data-fields>
		{#if selected === 'head'}
			<div class="card depth-0 on" data-head>
				<div class="flex flex-wrap items-center gap-3">
					<img src="plugin_gold.webp" alt="" class="h-6 w-6 object-contain" />
					<input class="label" placeholder="Name" bind:value={title} />
					{@render nth(1)}
				</div>
				<input class="{input} w-full" placeholder="Description (optional)" bind:value={rest.description} data-form-description />
			</div>
		{:else}
			<button class="card depth-0 head pick" onclick={() => (selected = 'head')} data-head>
				<img src="plugin_gold.webp" alt="" class="h-6 w-6 object-contain" />
				<span class="flex-1 text-left">{title || 'Name'}{#if rest.description}<span class="block text-sm font-normal text-muted">{rest.description}</span>{/if}</span>
				{@render nth(1)}
			</button>
		{/if}
		{#each fields as f, i (f)}{@render card(f, i)}{/each}
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
		border-color: var(--accent);
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
	.track {
		border-radius: 1rem;
	}
	.card.on {
		padding: 1rem 1.25rem;
		border-color: var(--accent);
		background: #1f1c14;
	}
	.nth {
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.card.head {
		flex-direction: row;
	}
	.card.depth-0 {
		border-color: var(--accent);
	}
	.card.depth-1:not(.on) {
		border-color: var(--rt-rust);
	}
	.card.depth-2:not(.on) {
		border-color: var(--rt-sage);
	}
	.add.nest {
		border-color: var(--rt-rust);
	}
	.add-text {
		padding: 0.3rem 0.8rem;
		border: 2px dashed var(--rt-sage);
		border-radius: 0.6rem;
		color: var(--rt-sage);
		font-size: 1rem;
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
