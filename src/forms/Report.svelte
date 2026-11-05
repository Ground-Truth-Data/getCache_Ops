<script lang="ts">
	import { answerRows, answers, forms, keys, type Answer, type AnswerRow, type FormRow } from './forms';

	let { orgKey, formId }: { orgKey: string; formId: string } = $props();

	let versions = $state<FormRow[]>([]);
	let header = $state<Answer[]>([]);
	let rows = $state<AnswerRow[]>([]);
	let note = $state('');

	async function load() {
		versions = (await forms(orgKey)).filter((f) => f.formId === formId && f.publishedAt);
		const all = await answers(versions.map((v) => v.id));
		// A fix replaces the row it names: the report shows the latest, history stays in Central.
		const fixed = new Set(all.map((a) => a.replaces));
		header = all.filter((a) => !fixed.has(a.id));
		const r = await answerRows(header.map((a) => a.id));
		const rowFixed = new Set(r.map((x) => x.replaces));
		const at = new Map(header.map((a, i) => [a.id, i]));
		rows = r.filter((x) => !rowFixed.has(x.id)).sort((x, y) => at.get(x.answer)! - at.get(y.answer)! || x.n - y.n);
	}
	$effect(() => void load().catch((e) => (note = e.message)));

	// Columns join every version by key, newest label wins; a key a version lacks shows blank.
	const columns = $derived.by(() => {
		const cols = new Map<string, { key: string; label: string; group?: string }>();
		for (const v of versions) for (const k of keys(v.definition)) cols.set(`${k.group ?? ''}/${k.key}`, k);
		return [...cols.values()];
	});
	const groups = $derived(columns.filter((c) => !c.group && columns.some((g) => g.group === c.key)));
	const version = $derived(new Map(versions.map((v) => [v.id, v.version])));
	const when = $derived(new Map(header.map((a) => [a.id, a.filledAt.slice(0, 16).replace('T', ' ')])));
	const plain = $derived(columns.filter((c) => !c.group && !groups.includes(c)));

	function cell(v: unknown): string {
		if (v == null) return '';
		if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? ((x as { name?: string }).name ?? '') : String(x))).join(', ');
		if (typeof v === 'object' && 'lat' in v) {
			const g = v as { lat: number; lng: number };
			return `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
		}
		return String(v);
	}
	const td = 'border-b border-rule py-1 pr-4 align-top';
</script>

<a class="small-btn mb-6" href="#/company/forms" data-back>← Forms</a>
<h1 class="mb-6 font-display text-3xl text-(--accent)">{versions.at(-1)?.definition.title ?? 'Form'}: answers</h1>
{#if note}<p class="text-muted" data-note>{note}</p>{/if}

<div class="overflow-x-auto">
	<table class="text-left text-sm" data-report>
		<thead><tr><th class={td}>version</th><th class={td}>filled</th>{#each plain as c (c.key)}<th class={td} data-col={c.key}>{c.label}</th>{/each}</tr></thead>
		<tbody>
			{#each header as a (a.id)}
				<tr data-answer={version.get(a.form)}>
					<td class={td}>v{version.get(a.form)}</td><td class={td}>{when.get(a.id)}</td>
					{#each plain as c (c.key)}<td class={td}>{cell(a.data[c.key])}</td>{/each}
				</tr>
			{:else}
				<tr><td class="py-2 text-muted" colspan="99">No answers yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#each groups as g (g.key)}
	<h2 class="mt-8 mb-2 font-display text-2xl">{g.label}</h2>
	<div class="overflow-x-auto">
		<table class="text-left text-sm" data-group-report={g.key}>
			<thead><tr><th class={td}>filled</th><th class={td}>#</th>{#each columns.filter((c) => c.group === g.key) as c (c.key)}<th class={td}>{c.label}</th>{/each}</tr></thead>
			<tbody>
				{#each rows.filter((r) => r.groupKey === g.key) as r (r.id)}
					<tr><td class={td}>{when.get(r.answer)}</td><td class={td}>{r.n}</td>{#each columns.filter((c) => c.group === g.key) as c (c.key)}<td class={td}>{cell(r.data[c.key])}</td>{/each}</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}
