<script lang="ts">
	import FormView from '../../_rapper/gc/FormView.svelte';
	import RowGrip from '../../_rapper/gc/RowGrip.svelte';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { SvelteSet } from 'svelte/reactivity';
	import { blank, branches, CENTRAL_KEY, fromDefinition, keyFor, keys, KINDS, toDefinition, type Field, type Form, type Kind, type Store } from './forms';

	let { store, edit, back, logo, byline, meta, born = '' }: {
		store: Store;
		/** Where another form of this kind opens: the one that replaced this one, or a new one made from it. */
		edit: (id: string) => string;
		/** The name it saves under while the title is left empty, shown greyed in the empty title. */
		born?: string;
		back: [href: string, label: string];
		logo?: Snippet;
		byline?: Snippet;
		/** Kept beside the form (credit, logo): a change to it saves like a change to a field. */
		meta?: unknown;
	} = $props();

	let form = $state<Form>();
	let title = $state('');
	let fields = $state<Field[]>([]);
	let rest = $state<ReturnType<typeof fromDefinition>['rest']>({});
	let note = $state('');
	// A refusal flashes red, again on every press, so a second tap is not met with silence.
	let refusals = $state(0);
	let viewer = $state<HTMLDialogElement>();
	// A fresh query string restarts the one-shot blink; the dialog opens once the lid is back up.
	let blink = $state('');
	function view() {
		blink = `eye_blink.webp?${Date.now()}`;
		setTimeout(() => viewer?.showModal(), 1000);
	}
	/** The field being edited, or 'head': the form's own title and description, which are section 1. */
	let selected = $state<Field | 'head'>();
	// A question's key is its answers' identity: once published, a rename changes only its title.
	let fixed = new Set<string>();
	const definition = $derived(toDefinition(title.trim() || born, fields, rest));
	let titleBox = $state<HTMLInputElement>();

	// What the store holds: an autosaving store is written only when this changes.
	let kept = '';
	const now = () => JSON.stringify([$state.snapshot(definition), meta]);

	async function load() {
		form = await store.load();
		if (form) ({ title, fields, rest } = fromDefinition(form.definition));
		fixed = new Set(form?.publishedAt ? keys(form.definition).map((k) => k.key) : []);
		if (!title) titleBox?.focus();
		kept = now();
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	$effect(() => {
		const key = now();
		if (!store.autosave || !kept || key === kept || form?.lockedAt) return;
		const t = setTimeout(async () => {
			try {
				kept = key;
				await store.save(JSON.parse(key)[0]);
				note = 'Saved.';
				refusals = 0;
			} catch (e) {
				refused(e, 'autosave');
			}
		}, 400);
		return () => clearTimeout(t);
	});

	// The key is never shown: it follows the title until published.
	function relabel(f: Field, label: string) {
		if (f.kind !== 'section' && !fixed.has(f.key)) f.key = keyFor(label, f.kind, fields, f);
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
	// The head, a section or a nested group folds shut behind its chevron, as in the inbox.
	const folded = new SvelteSet<Field | 'head'>();
	/** How many cards the fold at `i` holds; -1 is the head. */
	const held = (i: number) => {
		const whole = i < 0 || fields[i].kind === 'section';
		let j = i + 1;
		while (j < fields.length && (whole ? fields[j].kind !== 'section' : depths[j] === 2)) j++;
		return j - i - 1;
	};
	/** The section (or head) each card sits in, and the nested group it sits in, if any. */
	const owners = $derived.by(() => {
		let sec: Field | 'head' = 'head';
		let group: Field | undefined;
		return fields.map((f, i) => {
			if (f.kind === 'section') sec = f;
			if (f.kind === 'nested') group = f;
			return { sec, group: f.kind === 'nested' || depths[i] === 2 ? group : undefined };
		});
	});
	const hidden = $derived(
		fields.map((f, i) => f.kind !== 'section' && (folded.has(owners[i].sec) || (depths[i] === 2 && folded.has(owners[i].group!)))),
	);
	// The type picker open at the foot of a section or a nested group: where its pick lands.
	let picking = $state<{ at: number; group: boolean }>();
	// With a nested group (or one of its questions) picked, a new question lands at the end of that group.
	function add(kind: Kind, at?: number) {
		const f = { ...blank(kind), key: keyFor('', kind, fields), label: '' };
		if (at === undefined) {
			at = fields.length;
			const i = selected && selected !== 'head' ? fields.indexOf(selected) : -1;
			if (i >= 0 && depths[i] >= 1 && (fields[i].kind === 'nested' || depths[i] === 2) && kind !== 'section' && kind !== 'nested') {
				at = i + 1;
				while (depths[at] === 2) at++;
			}
		}
		fields.splice(at, 0, f);
		selected = fields[at];
		picking = undefined;
	}

	async function save(then?: 'publish') {
		note = '';
		try {
			if (!store.autosave || now() !== kept) await store.save($state.snapshot(definition));
			if (then) await store.publish();
			await load();
			note = then ? 'Published.' : 'Saved.';
			refusals = 0;
		} catch (e) {
			refused(e, then ?? 'save');
		}
	}
	async function copy() {
		note = '';
		try {
			location.hash = edit(await store.copy());
		} catch (e) {
			refused(e, 'copy');
		}
	}
	function refused(e: unknown, what: string) {
		note = (e as Error).message;
		refusals++;
		const bad = fields.filter((f) => !CENTRAL_KEY.test(f.key)).map((f) => `${f.kind} "${f.label}" key="${f.key}"`);
		console.warn(`[forms] ${what} refused: ${note}`, bad.length ? { badKeys: bad } : '');
	}

	const ADD: [Kind, string][] = [['text', 'Text'], ['number', 'Number'], ['dropdown', 'Choice'], ['checkbox', 'Checkboxes'], ['date', 'Date'], ['file', 'Photo'], ['section', 'Section'], ['nested', 'Nested']];
	const CHOICE = 'M8 6h12M8 12h12M8 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2';
	const ICON: Record<Kind, string> = {
		text: 'M4 7V5h16v2M12 5v14M9 19h6',
		number: 'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
		dropdown: CHOICE,
		radiogroup: CHOICE,
		checkbox: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12l3 3 5-6',
		date: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
		file: 'M4 8h3l2-3h6l2 3h3v11H4zM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
		section: '',
		nested: '',
	};
	const tone = (f: Field, i: number) => (f.kind === 'section' ? 'gold' : f.kind === 'nested' || depths[i] === 2 ? 'sage' : 'rust');
	// A renamed choice keeps where it goes.
	function rename(f: Field, k: number, v: string) {
		const was = f.choices[k];
		f.choices[k] = v;
		if (f.jumps && was in f.jumps) ((f.jumps[v] = f.jumps[was]), delete f.jumps[was]);
	}
</script>

{#snippet icon(kind: Kind, size = 22)}
	<!-- Section and Nested are the form's shape: drawn bigger than any one field's icon. -->
	{#if kind === 'section' || kind === 'nested'}<img src={kind === 'nested' ? 'form_in_form_icon.webp' : 'section_flow_icon.webp'} alt="" style:height="{size * 2}px" style:width="auto" />
	{:else}<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICON[kind]} /></svg>{/if}
{/snippet}
{#snippet tile(kind: Kind, tone: string)}<span class={['mark', tone]}>{@render icon(kind, 22)}</span>{/snippet}
{#snippet nth(n: number)}<span class="nth">Section {n} of {sections}</span>{/snippet}
{#snippet text(name: string, description: string, required = false, n = 0)}
	<span class="text">
		<span class="line"><span class="name">{name}{#if required}<span class="req">*</span>{/if}</span>{#if n}{@render nth(n)}{/if}</span>
		<span class="desc" class:none={!description}>{description || 'Add a description'}</span>
	</span>
{/snippet}

{#snippet fold(key: Field | 'head', n: number, sage = false)}
	{@const shut = folded.has(key)}
	<button class="fold" class:sage aria-expanded={!shut} aria-label={shut ? 'Open' : 'Fold'} onclick={() => (shut ? folded.delete(key) : folded.add(key))} data-fold>
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style:transform="rotate({shut ? 0 : 90}deg)"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
		{#if shut}<span class="count">{n}</span>{/if}
	</button>
{/snippet}

{#snippet foot(at: number, label: string, group?: Field)}
	<div class="foot" class:sage={group} style:margin-left="{group ? 4 : 2}rem">
		{#if picking?.at === at && picking.group === !!group}
			<div class="picker">
				<span class="text-sm font-bold">Add to {label}: pick a type</span>
				<div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
					{#each ADD.filter(([k]) => !group || (k !== 'section' && k !== 'nested')) as [kind, name] (kind)}
						<button class="add" onclick={() => add(kind, at)} data-pick-type={kind}>{@render icon(kind, 20)}{name}</button>
					{/each}
					<button class="add text-muted" onclick={() => (picking = undefined)}>Cancel</button>
				</div>
			</div>
		{:else}
			<button class="more" onclick={() => (picking = { at, group: !!group })} data-foot={group ? 'group' : 'section'}><span class="plus">+</span></button>
		{/if}
	</div>
{/snippet}

{#snippet card(f: Field, i: number)}
	{@const on = selected === f}
	{@const section = f.kind === 'section'}
	<!-- The inbox's row: the card on a grey track whose grip pokes out on the right. -->
	<div class="rt-row-track rt-row-track--grip track" class:rt-row-track--dragging={dragging === i} style:margin-left="{depths[i] * 2}rem"
		role="listitem" ondragover={(e) => over(e, i)} ondrop={(e) => e.preventDefault()}>
	<div class="card depth-{depths[i]} {on ? 'on' : ''}" data-build={f.key} data-kind={f.kind} data-depth={depths[i]}>
		{#if section || f.kind === 'nested'}{@render fold(f, held(i), f.kind === 'nested')}{/if}
		<div class="body">
		{#if on}
			{@const branchy = branches(f) && depths[i] === 1}
			<div class="flex items-center gap-3">
				{@render tile(f.kind, tone(f, i))}
				<input class="label" placeholder={KINDS.find(([k]) => k === f.kind)?.[1]} value={f.label} oninput={(e) => relabel(f, e.currentTarget.value)} data-label />
				{#if !section && f.kind !== 'nested'}
					<button class="star" class:on={f.required} aria-pressed={f.required} aria-label="Required" title="Required" onclick={() => (f.required = !f.required)} data-required>*</button>
				{/if}
				{#if section}{@render nth(sectionNo[i])}{/if}
				<button class="trash" onclick={() => (fields.splice(i, 1), (selected = undefined))} aria-label="Remove field" data-remove-field>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
				</button>
			</div>
			<input class="field" placeholder="Description (optional)" bind:value={f.description} data-description />
			{#if f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox'}
				<div class="flex flex-col gap-2" data-choices>
					{#each f.choices as c, k (k)}
						<div class="flex items-center gap-2.5">
							<span class="num">{k + 1}.</span>
							<input class="field min-w-0 flex-1" value={c} oninput={(e) => rename(f, k, e.currentTarget.value)} aria-label="Option" data-option={k} />
							{#if branchy && f.jumps}
								<select class="field jump" aria-label="Go to" value={f.jumps[c] ?? ''} onchange={(e) => (e.currentTarget.value ? (f.jumps![c] = e.currentTarget.value) : delete f.jumps![c])} data-jump={k}>
									<option value="">Continue to next section</option>
									<!-- A skip only goes forward, so only later sections are offered. -->
									{#each fields as s, j (s)}{#if s.kind === 'section' && j > i}<option value={s.key}>{sectionNo[j]}. {s.label || `Section ${sectionNo[j]}`}</option>{/if}{/each}
									<option value="submit">Submit form</option>
								</select>
							{/if}
						</div>
					{/each}
					<div class="ml-9 flex gap-2">
						<button class="row-btn" onclick={() => f.choices.push(`Option ${f.choices.length + 1}`)} data-add-option>+ row</button>
						<button class="row-btn" disabled={f.choices.length < 2} onclick={() => f.choices.pop()} aria-label="Remove last option" data-remove-option>− row</button>
					</div>
				</div>
			{/if}
			{#if f.kind === 'number' || branchy}
				<div class="flex flex-wrap items-center gap-2">
					{#if f.kind === 'number'}
						<input class="field w-24" type="number" placeholder="min" value={f.min ?? ''} onchange={(e) => (f.min = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-min />
						<input class="field w-24" type="number" placeholder="max" value={f.max ?? ''} onchange={(e) => (f.max = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-max />
					{/if}
					{#if branchy}
						<button class="branch ml-auto" class:on={f.jumps} aria-pressed={!!f.jumps} aria-label="Go to section based on answer" title="Go to section based on answer" onclick={() => (f.jumps = f.jumps ? undefined : {})} data-branch>
							<img src={f.jumps ? 'redirect_icon_gold.webp' : 'redirect_icon_rust.webp'} alt="" />
						</button>
					{/if}
				</div>
			{/if}
		{:else}
			<button class="pick" onclick={() => (selected = f)} data-pick>
				{@render tile(f.kind, tone(f, i))}
				{@render text(f.label || KINDS.find(([k]) => k === f.kind)![1], f.description, f.required, section ? sectionNo[i] : 0)}
				
			</button>
		{/if}
		</div>
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
		<input class="title" aria-label="Name" placeholder={born || 'Name'} bind:value={title} bind:this={titleBox} readonly={!!form?.lockedAt} data-title />
		{@render byline?.()}
	</div>
	{#if form?.replacedBy}<a class="text-lg text-(--accent) underline" href={edit(form.replacedBy.id)} data-replaced-by>Replaced by {form.replacedBy.title || 'Untitled'}</a>{/if}
	{#if form?.lockedAt}
		<button class="rt-fancy-btn rounded-2xl px-9 py-3 font-display text-2xl" onclick={copy} data-copy-form>Make a new form from this one</button>
	{:else}
		{#if !store.autosave}<button class="small-btn" onclick={() => save()} data-save>Save</button>{/if}
		<button class="view" onclick={view} aria-label="View the form" data-view><img src={blink || 'eye.webp'} alt="" /></button>
		{#if !form?.publishedAt}<button class="rt-fancy-btn rounded-2xl px-9 py-3 font-display text-2xl" onclick={() => save('publish')} data-publish>Publish</button>{/if}
	{/if}
</header>
{#if note}{#key refusals}<p class="-mt-3 mb-4 {refusals ? 'refused' : 'text-muted'}" data-note>{note}</p>{/key}{/if}

{#if form?.lockedAt}
	<p class="mb-6 text-lg text-muted" data-locked>Locked: two people other than its maker have sent answers, so it never changes again.</p>
	<div class="phone w-96" data-preview><FormView {definition} onsubmit={() => {}} /></div>
{:else}

<div class="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)_20rem]">
	<aside class="flex flex-wrap gap-2.5 self-start rounded-2xl border-2 border-dashed border-[#6b6458] p-3 lg:flex-col" aria-label="Add a field">
		<span class="w-full text-sm font-bold tracking-wider text-muted">ADD</span>
		{#each ADD as [kind, name] (kind)}
			<button class="add {kind === 'section' ? 'section' : kind === 'nested' ? 'nest' : ''}" onclick={() => add(kind)} data-add-field={kind}>{@render icon(kind, 24)}{name}</button>
		{/each}
	</aside>
	<section class="flex min-w-0 flex-col gap-3" aria-label="The form" data-fields>
		{#if selected === 'head'}
			<div class="card depth-0 on" data-head>
				<div class="flex items-center gap-3">
					{@render fold('head', held(-1))}
					{@render tile('section', 'gold')}
					<input class="label" placeholder={born || 'Name'} bind:value={title} />
					{@render nth(1)}
				</div>
				<input class="field" placeholder="Description (optional)" bind:value={rest.description} data-form-description />
			</div>
		{:else}
			<div class="card depth-0 head">
				{@render fold('head', held(-1))}
				<button class="pick" onclick={() => (selected = 'head')} data-head>
					{@render tile('section', 'gold')}
					{@render text(title || born || 'Name', rest.description ?? '', false, 1)}
				</button>
			</div>
		{/if}
		{#if !folded.has('head') && (!fields.length || fields[0].kind === 'section')}{@render foot(0, title || 'Section 1')}{/if}
		{#each fields as f, i (f)}
			{@const { sec, group } = owners[i]}
			{#if !hidden[i]}{@render card(f, i)}{/if}
			<!-- Every nested group and every section ends in its own add button: what it adds lands there, as its last. -->
			{#if group && depths[i + 1] !== 2 && !folded.has(sec) && !folded.has(group)}{@render foot(i + 1, group.label || 'this list', group)}{/if}
			{#if (i + 1 === fields.length || fields[i + 1].kind === 'section') && !folded.has(sec)}
				{@render foot(i + 1, sec === 'head' ? title || 'Section 1' : sec.label || `Section ${sectionNo[fields.indexOf(sec)]}`)}
			{/if}
		{/each}
	</section>
	<aside class="phone" aria-label="Phone preview" data-preview>
		<FormView {definition} onsubmit={() => {}} />
	</aside>
</div>
{/if}
<dialog bind:this={viewer} class="viewer" closedby="any" data-viewer>
	<button class="small-btn close" onclick={() => viewer?.close()}>Close</button>
	<div class="phone"><FormView {definition} onsubmit={() => viewer?.close()} /></div>
</dialog>

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
		margin-left: 0.2em;
		color: #ff4d55;
		font-size: 1.4em;
		font-weight: 800;
		line-height: 0;
		vertical-align: -0.25em;
	}
	/* The star is the switch, always red: faint when optional, full when required. */
	.star {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 999px;
		color: #ff4d55;
		opacity: 0.4;
		font-size: 2rem;
		font-weight: 800;
		line-height: 1;
		padding-top: 0.6rem;
	}
	.star.on {
		opacity: 1;
	}
	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		overflow: hidden;
		border-radius: 14px;
	}
	.mark.rust {
		--accent: var(--rt-rust);
	}
	.mark.sage {
		--accent: #b9cc95;
	}
	.mark img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 28px;
	}
	.desc {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		color: #bdb6a8;
		font-size: 1rem;
		font-weight: 400;
		line-height: 22px;
	}
	.desc.none {
		color: #8c857a;
		font-style: italic;
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
	/* A big shape icon runs into the padding, nearly to the border, instead of making its button taller. */
	.add img {
		margin-block: -0.6rem;
	}
	/* Every folded card in the list is one height: a title line and two lines of description. */
	[data-fields] {
		--row: 104px;
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
	/* A wider track than the inbox's, so the grip dots sit clear of the card's edge. */
	.track {
		border-radius: 1rem;
		--rt-row-grip-w: 2.25rem;
	}
	.card[data-build] {
		flex-direction: row;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.fold {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding-left: 1rem;
		color: var(--accent);
	}
	.card.on .fold {
		padding-left: 0;
	}
	.fold.sage {
		color: var(--rt-sage);
	}
	.fold svg {
		flex: none;
		transition: transform 0.15s;
	}
	.count {
		min-width: 1.6rem;
		height: 1.6rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--accent);
		color: #161a10;
		font-size: 0.9rem;
		font-weight: 800;
		line-height: 1.6rem;
	}
	.fold.sage .count {
		background: var(--rt-sage);
	}
	/* The open card glows in its own colour: gold a section, rust a question, sage inside a list. */
	.card.on {
		--edge: var(--accent);
		--line: var(--accent);
		--glow: color-mix(in srgb, var(--accent) 30%, transparent);
		--well: #14120d;
		--rim: #5a4e2c;
		padding: 18px 20px;
		border: 2.5px solid var(--edge);
		background: #1f1c14;
		box-shadow: 0 0 24px 2px var(--glow), 0 14px 30px rgb(0 0 0 / 0.55);
	}
	.card.on.depth-1 {
		--edge: var(--rt-rust);
		--line: var(--rt-rust);
		--glow: color-mix(in srgb, var(--rt-rust) 40%, transparent);
		--well: #14100d;
		--rim: #5a3e2c;
		background: #261c15;
	}
	.card.on.depth-2 {
		--edge: #c8dca4;
		--line: var(--rt-sage);
		--glow: rgb(159 178 127 / 0.3);
		--well: #10130d;
		--rim: #4a5640;
		background: #20261a;
	}
	.field {
		height: 48px;
		padding: 0 14px;
		border: 1.5px solid var(--rim);
		border-radius: 12px;
		background: var(--well);
		font-size: 1.05rem;
	}
	.num {
		flex: none;
		width: 26px;
		color: #b7b0a2;
		font-size: 1.05rem;
		text-align: right;
	}
	.jump {
		flex: none;
		width: 15rem;
		padding: 0 10px;
	}
	.row-btn,
	.branch {
		height: 44px;
		border: 1.5px solid var(--rim);
		border-radius: 12px;
	}
	.row-btn {
		min-width: 88px;
		padding: 0 16px;
		background: color-mix(in srgb, var(--edge) 15%, #121212);
		color: var(--edge);
		font-weight: 700;
	}
	.row-btn:disabled {
		opacity: 0.35;
	}
	.branch {
		width: 66px;
		padding: 4px 6px;
		border-color: #4a4540;
	}
	.branch img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.branch.on {
		border-color: var(--accent);
		background: #2a2410;
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
	/* A section's foot is rust, a nested group's sage: the colour of what it adds. */
	.foot {
		--tone: var(--rt-rust);
		display: flex;
		gap: 0.6rem;
		margin-right: 1.5rem;
	}
	.foot.sage {
		--tone: var(--rt-sage);
	}
	.more,
	.picker {
		border: 2px solid var(--tone);
		border-radius: 1rem;
		background: color-mix(in srgb, var(--tone) 12%, #121212);
	}
	.more {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		min-height: 3.75rem;
		font-size: 1.1rem;
		font-weight: 700;
	}
	.plus {
		--plus: 34px;
		width: var(--plus);
		height: var(--plus);
		border-radius: 999px;
		background: var(--tone);
		color: #161a10;
		font-size: 26px;
		font-weight: 700;
		line-height: var(--plus);
	}
	.foot.sage .plus {
		--plus: 32px;
		font-size: 24px;
	}
	.picker {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		color: var(--tone);
	}
	.picker .add {
		color: var(--rt-cream, #f3efe6);
	}
	.add svg,
	.add img {
		flex: none;
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
		gap: 1rem;
		width: 100%;
		min-width: 0;
		/* Less the card's border, so the folded card is exactly --row. */
		height: calc(var(--row) - 4px);
		padding: 0 1.25rem;
	}
	.label {
		flex: 1;
		min-width: 0;
		height: 48px;
		background: transparent;
		border: none;
		border-bottom: 2px solid var(--line);
		outline: none;
		font-size: 1.45rem;
		font-weight: 700;
	}
	.trash {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: 1.5px solid var(--rim);
		border-radius: 0.75rem;
		color: #c9c3b7;
	}
	.view {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 3.6rem;
		border: 3px solid var(--accent);
		border-radius: 1rem;
		background: #000;
		box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.view img {
		width: 2.9rem;
	}
	.viewer {
		margin: auto;
		padding: 0;
		border: none;
		background: transparent;
	}
	.viewer::backdrop {
		background: rgb(0 0 0 / 0.75);
	}
	.viewer .phone {
		width: 24rem;
		max-height: 85vh;
	}
	.close {
		display: block;
		margin: 0 0 0.75rem auto;
	}
	.phone {
		align-self: start;
		max-height: 44rem;
		overflow-y: auto;
		/* A phone shows none, and the bar ran up past the rounded corner. */
		scrollbar-width: none;
		padding: 1.1rem;
		border: 3px solid #3a352e;
		border-radius: 2.25rem;
		background: #0a0a0a;
	}
</style>
