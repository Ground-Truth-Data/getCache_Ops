<script lang="ts">
	import type { Model, PanelModel, Question } from 'survey-core';
	import type { Definition } from './forms';
	import { loadSurvey } from './survey';

	let { definition, onsubmit, keep = async (f: File) => f.name }: {
		definition: Definition;
		onsubmit: (data: Record<string, unknown>) => void;
		/** Saves a photo and returns its blob key: answers never hold the picture itself. */
		keep?: (file: File) => Promise<string>;
	} = $props();

	let model = $state.raw<Model>();
	let tick = $state(0);
	let failed = $state('');
	$effect(() => {
		const def = $state.snapshot(definition);
		loadSurvey().then(({ Model }) => {
			const m = new Model(def);
			m.onValueChanged.add(() => tick++);
			m.onDynamicPanelAdded.add(() => tick++);
			m.onDynamicPanelRemoved.add(() => tick++);
			model = m;
			tick++;
		}, (e) => (failed = e.message));
	});

	type View = { q: Question; type: string; input: string; title: string; required: boolean; visible: boolean; value: unknown; errors: string[];
		choices: { value: unknown; text: string }[]; panels: { p: PanelModel; items: View[] }[] };
	const view = (q: Question): View => ({
		q, type: q.getType(), input: q.inputType, title: q.title, required: q.isRequired, visible: q.isVisible, value: q.value,
		errors: q.errors.map((e) => e.getText()),
		choices: (q.visibleChoices ?? []).map((c: { value: unknown; text: string }) => ({ value: c.value, text: c.text })),
		panels: (q.panels ?? []).map((p: PanelModel) => ({ p, items: p.questions.map(view) })),
	});
	// A fresh view each change: survey-core's objects are not reactive.
	const top = $derived(tick && model ? model.getAllQuestions(false).filter((q) => !q.parentQuestion).map(view) : []);

	const set = (q: Question, v: unknown) => (q.value = v === '' ? undefined : v);
	const toggle = (v: View, c: unknown, on: boolean) => set(v.q, on ? [...((v.value as unknown[]) ?? []), c] : ((v.value as unknown[]) ?? []).filter((x) => x !== c));
	async function photo(q: Question, file?: File) {
		if (file) set(q, [{ name: file.name, type: file.type, content: await keep(file) }]);
	}
	function locate(q: Question) {
		navigator.geolocation.getCurrentPosition(
			({ coords }) => set(q, { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
			(e) => console.warn('[forms] gps', e.message),
			{ enableHighAccuracy: true, timeout: 20_000 },
		);
	}
	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (model?.validate(true)) onsubmit(model.data);
		tick++;
	}
	const input = 'rounded border border-rule bg-surface px-2 py-1';
</script>

{#snippet field(v: View)}
	{#if v.visible}
		<div class="flex flex-col gap-1" data-field={v.q.name}>
			<span class="font-display">{v.title}{v.required ? ' *' : ''}</span>
			{#if v.type === 'text'}
				<input class={input} aria-label={v.title} type={v.input === 'number' || v.input === 'date' ? v.input : 'text'} value={v.value ?? ''}
					onchange={(e) => set(v.q, v.input === 'number' && e.currentTarget.value !== '' ? Number(e.currentTarget.value) : e.currentTarget.value)} />
			{:else if v.type === 'dropdown'}
				<select class={input} aria-label={v.title} value={v.value ?? ''} onchange={(e) => set(v.q, e.currentTarget.value)}>
					<option value=""></option>
					{#each v.choices as c (c.value)}<option value={c.value}>{c.text}</option>{/each}
				</select>
			{:else if v.type === 'radiogroup' || v.type === 'checkbox'}
				<div class="flex flex-wrap gap-x-4">
					{#each v.choices as c (c.value)}
						<label class="flex items-center gap-1">
							{#if v.type === 'radiogroup'}
								<input type="radio" name={v.q.id} checked={v.value === c.value} onchange={() => set(v.q, c.value)} />
							{:else}
								<input type="checkbox" checked={((v.value as unknown[]) ?? []).includes(c.value)} onchange={(e) => toggle(v, c.value, e.currentTarget.checked)} />
							{/if}
							{c.text}
						</label>
					{/each}
				</div>
			{:else if v.type === 'file'}
				<input type="file" accept="image/*" capture="environment" aria-label={v.title} onchange={(e) => photo(v.q, e.currentTarget.files?.[0])} />
			{:else if v.type === 'gps'}
				<div class="flex items-center gap-3">
					<button type="button" class="underline" onclick={() => locate(v.q)}>Use where I am</button>
					{#if v.value}{@const g = v.value as { lat: number; lng: number }}<span class="text-sm text-muted" data-gps>{g.lat.toFixed(5)}, {g.lng.toFixed(5)}</span>{/if}
				</div>
			{:else if v.type === 'paneldynamic'}
				{#each v.panels as panel, i (panel.p.id)}
					<fieldset class="flex flex-col gap-3 border-l-2 border-rule pl-3" data-entry={i + 1}>
						{#each panel.items as item (item.q.id)}{@render field(item)}{/each}
						<button type="button" class="self-start text-sm text-muted underline" onclick={() => v.q.removePanel(panel.p)}>Remove</button>
					</fieldset>
				{/each}
				<button type="button" class="self-start underline" onclick={() => v.q.addPanel()} data-add>Add another</button>
			{/if}
			{#each v.errors as e (e)}<span class="text-sm text-(--accent)" data-error>{e}</span>{/each}
		</div>
	{/if}
{/snippet}

{#if failed}
	<p class="text-muted">{failed}</p>
{:else if !model}
	<p class="text-muted">Opening the form…</p>
{:else}
	<form class="flex max-w-xl flex-col gap-4" onsubmit={submit} novalidate data-form>
		{#if definition.title}<h2 class="font-display text-2xl">{definition.title}</h2>{/if}
		{#each top as v (v.q.id)}{@render field(v)}{/each}
		<button class="rt-fancy-btn self-start rounded-lg px-4 py-1 font-display">Save</button>
	</form>
{/if}
