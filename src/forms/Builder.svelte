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
			}
		}, 400);
		return () => clearTimeout(t);
	});

	const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 40);
	function relabel(f: Field, label: string) {
		if (!locked.has(f.key) && (!f.key || f.key === keyOf(f.label))) f.key = keyOf(label);
		f.label = label;
	}
	const move = (list: Field[], i: number, by: number) => list.splice(i + by, 0, ...list.splice(i, 1));
	// A new field goes into the repeat group being worked on, else at the end of the form.
	const groupOf = (f?: Field) => (f?.kind === 'group' ? f : fields.find((g) => g.kind === 'group' && g.fields.includes(f!)));
	function add(kind: Kind) {
		const list = groupOf(selected)?.fields ?? fields;
		list.push(blank(kind));
		selected = list.at(-1);
	}

	async function save(then?: 'publish') {
		note = '';
		try {
			if (!store.autosave || now() !== kept) await store.save($state.snapshot(definition), draft?.id);
			versions = await store.load();
			if (then) await store.publish(draft?.id);
			await load();
			note = then ? `Published version ${latest?.version}.` : `Saved draft version ${latest?.version}.`;
		} catch (e) {
			note = (e as Error).message;
		}
	}

	const ADD: [Kind, string][] = [['text', 'Text'], ['number', 'Number'], ['dropdown', 'Choice'], ['date', 'Date'], ['file', 'Photo'], ['gps', 'GPS'], ['group', 'Repeat']];
	const CHOICE = 'M8 6h12M8 12h12M8 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2';
	const ICON: Record<Kind, string> = {
		text: 'M4 7V5h16v2M12 5v14M9 19h6',
		number: 'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
		dropdown: CHOICE,
		radiogroup: CHOICE,
		checkbox: CHOICE,
		date: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
		file: 'M4 8h3l2-3h6l2 3h3v11H4zM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
		gps: 'M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
		group: 'M5.5 4h13A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4zM5.5 14h13a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14z',
	};
	const input = 'rounded-lg border border-rule bg-surface px-3 py-2';
	const ghost = 'rounded-lg border border-rule px-3 py-2 text-muted';
</script>

{#snippet icon(kind: Kind, size = 22)}
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={kind === 'group' ? 'var(--repeat)' : 'var(--accent)'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICON[kind]} /></svg>
{/snippet}

{#snippet card(f: Field, list: Field[], i: number, inGroup: boolean)}
	{@const on = selected === f}
	{@const group = f.kind === 'group'}
	<div class="card {on ? 'on' : ''} {group ? 'group' : ''} {inGroup && !on ? 'chip' : ''}" data-build={f.key} data-kind={f.kind}>
		{#if on}
			<div class="flex flex-wrap items-center gap-3">
				{@render icon(f.kind)}
				<input class="label" placeholder={KINDS.find(([k]) => k === f.kind)?.[1]} value={f.label} oninput={(e) => relabel(f, e.currentTarget.value)} data-label />
				{#if group}<input class="{input} w-32 font-bold" placeholder="+ Add" title="The add button's text on the phone" bind:value={f.addText} data-add-text />{/if}
				<button class="trash" onclick={() => (list.splice(i, 1), (selected = undefined))} aria-label="Remove field" data-remove-field>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
				</button>
			</div>
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<input class="{input} w-36 font-mono" placeholder="key" bind:value={f.key} disabled={locked.has(f.key)} title={locked.has(f.key) ? 'Published: this key is locked' : 'The column name in reports'} data-key />
				{#if !group}<label class="flex items-center gap-2"><input type="checkbox" class="h-5 w-5" bind:checked={f.required} data-required />must fill</label>{/if}
				{#if f.kind === 'number'}
					<input class="{input} w-24" type="number" placeholder="min" value={f.min ?? ''} onchange={(e) => (f.min = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-min />
					<input class="{input} w-24" type="number" placeholder="max" value={f.max ?? ''} onchange={(e) => (f.max = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-max />
				{/if}
				<button class={ghost} disabled={i === 0} onclick={() => move(list, i, -1)} aria-label="Up">↑</button>
				<button class={ghost} disabled={i === list.length - 1} onclick={() => move(list, i, 1)} aria-label="Down">↓</button>
			</div>
			{#if f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox'}
				<textarea class="{input} w-full max-w-sm text-base" rows="4" placeholder="One choice per line" value={f.choices.join('\n')}
					oninput={(e) => (f.choices = e.currentTarget.value.split('\n').map((c) => c.trim()).filter(Boolean))} data-choices></textarea>
			{/if}
		{:else}
			<button class="pick" onclick={() => (selected = f)} data-pick>
				{#if !inGroup}{@render icon(f.kind)}{/if}
				<span class="flex-1 text-left">{f.label || KINDS.find(([k]) => k === f.kind)?.[1]}</span>
				{#if f.required}<span class="text-sm text-muted">must fill</span>{/if}
				{#if group}<span class="add-text">{f.addText || '+ Add'}</span>{/if}
			</button>
		{/if}
		{#if group}
			<div class="flex flex-wrap gap-2.5 pl-9" data-group={f.key}>
				{#each f.fields as c, j (c)}{@render card(c, f.fields, j, true)}{/each}
			</div>
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
{#if note}<p class="-mt-3 mb-4 text-muted" data-note>{note}</p>{/if}

<div class="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)_20rem]">
	<aside class="flex flex-wrap gap-2.5 lg:flex-col" aria-label="Add a field">
		<span class="w-full text-sm font-bold tracking-wider text-muted">ADD</span>
		{#each ADD as [kind, name] (kind)}
			<button class="add {kind === 'group' ? 'group' : ''}" disabled={kind === 'group' && !!groupOf(selected)} onclick={() => add(kind)} data-add-field={kind}>{@render icon(kind, 24)}{name}</button>
		{/each}
	</aside>
	<section class="flex min-w-0 flex-col gap-3" aria-label="The form" data-fields>
		{#each fields as f, i (f)}{@render card(f, fields, i, false)}{/each}
	</section>
	<aside class="phone" aria-label="Phone preview" data-preview>
		<FormView {definition} onsubmit={() => {}} />
	</aside>
</div>

<style>
	:global(:root) {
		--repeat: #e08a5b;
	}
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
	.add.group {
		border-color: var(--repeat);
		background: #1e1713;
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
	.card.group {
		border-color: var(--repeat);
		background: #1e1713;
		padding-bottom: 1rem;
	}
	.card.chip {
		border: none;
		background: #2a221c;
		border-radius: 0.75rem;
	}
	.card.chip .pick {
		padding: 0.6rem 1rem;
		font-size: 1.05rem;
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
	.add-text {
		padding: 0.45rem 1rem;
		border: 2px dashed var(--repeat);
		border-radius: 0.75rem;
		color: #f0a57e;
		font-size: 1.05rem;
		font-weight: 700;
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
