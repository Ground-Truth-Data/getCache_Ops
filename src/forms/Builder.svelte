<script lang="ts">
	import { split } from '../../_rapper/gc/form';
	import FormView from '../../_rapper/gc/FormView.svelte';
	import { blank, forms, fromDefinition, keys, KINDS, publish, saveDraft, toDefinition, type Field, type FormRow, type Kind } from './forms';

	let { orgKey, formId }: { orgKey: string; formId: string } = $props();

	// A new form gets its id when its first draft is saved.
	let id = $state(formId === 'new' ? undefined : formId);
	let versions = $state<FormRow[]>([]);
	let title = $state('');
	let fields = $state<Field[]>([]);
	let note = $state('');
	let preview = $state(false);
	let saved = $state<ReturnType<typeof split>>();
	const latest = $derived(versions.at(-1));
	const draft = $derived(latest && !latest.publishedAt ? latest : undefined);
	// A key is locked once any version holding it is published.
	const locked = $derived(new Set(versions.filter((v) => v.publishedAt).flatMap((v) => keys(v.definition).map((k) => k.key))));
	const definition = $derived(toDefinition(title, fields));

	async function load() {
		versions = id ? (await forms(orgKey)).filter((f) => f.formId === id) : [];
		if (latest) ({ title, fields } = fromDefinition(latest.definition));
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 40);
	function relabel(f: Field, label: string) {
		if (!locked.has(f.key) && (!f.key || f.key === keyOf(f.label))) f.key = keyOf(label);
		f.label = label;
	}
	const move = (list: Field[], i: number, by: number) => list.splice(i + by, 0, ...list.splice(i, 1));
	const add = (list: Field[], kind: string) => kind && list.push(blank(kind as Kind));

	async function save(then?: 'publish') {
		note = '';
		try {
			const made = await saveDraft(orgKey, $state.snapshot(definition), id, draft?.id);
			if (!id && Array.isArray(made)) history.replaceState(null, '', `#/company/form/${(id = made[0].formId)}`);
			await load();
			if (then && draft) await publish(draft.id);
			await load();
			note = then ? `Published version ${latest?.version}.` : `Saved draft version ${latest?.version}.`;
		} catch (e) {
			note = (e as Error).message;
		}
	}
	const input = 'rounded border border-rule bg-surface px-2 py-1';
</script>

{#snippet list(items: Field[], inGroup: boolean)}
	<ol class="flex flex-col gap-3">
		{#each items as f, i (f)}
			<li class="flex flex-col gap-2 border-b border-rule pb-3" data-build={f.key}>
				<div class="flex flex-wrap items-center gap-2">
					<span class="w-32 text-sm text-muted">{KINDS.find(([k]) => k === f.kind)?.[1]}</span>
					<input class={input} placeholder="Label" value={f.label} oninput={(e) => relabel(f, e.currentTarget.value)} data-label />
					<input class="{input} w-32 font-mono text-sm" placeholder="key" bind:value={f.key} disabled={locked.has(f.key)} title={locked.has(f.key) ? 'Published: this key is locked' : 'The column name in reports'} data-key />
					{#if f.kind !== 'group'}<label class="flex items-center gap-1 text-sm"><input type="checkbox" bind:checked={f.required} />required</label>{/if}
					<button class="text-sm text-muted" disabled={i === 0} onclick={() => move(items, i, -1)} aria-label="Up">↑</button>
					<button class="text-sm text-muted" disabled={i === items.length - 1} onclick={() => move(items, i, 1)} aria-label="Down">↓</button>
					<button class="text-sm text-muted underline" onclick={() => items.splice(i, 1)} data-remove-field>Remove</button>
				</div>
				{#if f.kind === 'dropdown' || f.kind === 'radiogroup' || f.kind === 'checkbox'}
					<textarea class="{input} ml-34 w-64 text-sm" rows="3" placeholder="One choice per line" value={f.choices.join('\n')}
						oninput={(e) => (f.choices = e.currentTarget.value.split('\n').map((c) => c.trim()).filter(Boolean))} data-choices></textarea>
				{:else if f.kind === 'number'}
					<div class="ml-34 flex gap-2 text-sm">
						<input class="{input} w-24" type="number" placeholder="min" value={f.min ?? ''} onchange={(e) => (f.min = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-min />
						<input class="{input} w-24" type="number" placeholder="max" value={f.max ?? ''} onchange={(e) => (f.max = e.currentTarget.value === '' ? undefined : +e.currentTarget.value)} data-max />
					</div>
				{:else if f.kind === 'group'}
					<div class="ml-8 border-l-2 border-rule pl-4" data-group={f.key}>{@render list(f.fields, true)}</div>
				{/if}
			</li>
		{/each}
	</ol>
	<select class="{input} mt-2 self-start text-sm" value="" onchange={(e) => (add(items, e.currentTarget.value), (e.currentTarget.value = ''))} data-add-field>
		<option value="">Add a field…</option>
		{#each KINDS.filter(([k]) => !inGroup || k !== 'group') as [k, name] (k)}<option value={k}>{name}</option>{/each}
	</select>
{/snippet}

<a class="small-btn mb-6" href="#/company/forms" data-back>← Forms</a>
<h1 class="mb-2 font-display text-3xl text-(--accent)">{title || 'New form'}</h1>
<p class="mb-6 text-sm text-muted" data-version>
	{#if !latest}Not saved yet.{:else if draft}Draft of version {draft.version}.{:else}Version {latest.version} is published and locked: saving starts version {latest.version + 1}.{/if}
</p>

<div class="flex flex-col gap-4">
	<input class="{input} max-w-xl font-display text-xl" placeholder="Form title" bind:value={title} data-title />
	<div class="flex flex-col">{@render list(fields, false)}</div>
	<div class="flex flex-wrap gap-4">
		<button class="underline" onclick={() => save()} data-save>Save draft</button>
		<button class="rt-fancy-btn rounded-lg px-4 py-1 font-display" onclick={() => save('publish')} data-publish>Publish</button>
		<button class="underline" onclick={() => ((preview = !preview), (saved = undefined))} data-preview>{preview ? 'Hide preview' : 'Preview'}</button>
	</div>
	{#if note}<p class="text-sm text-muted" data-note>{note}</p>{/if}
	{#if preview}
		<section class="mt-4 rounded-lg border border-rule p-4" data-previewing>
			{#key definition}<FormView definition={definition} onsubmit={(d) => (saved = split(definition, d))} />{/key}
			{#if saved}<pre class="mt-4 text-sm whitespace-pre-wrap" data-saved>{JSON.stringify(saved, null, 1)}</pre>{/if}
		</section>
	{/if}
</div>
