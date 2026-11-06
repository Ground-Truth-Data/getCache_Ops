<script lang="ts">
	import { current, download, sheets } from './answers';
	import { keys, type Answers } from './forms';
	import Value from './Value.svelte';

	let {
		load,
		back,
		photo,
		open,
	}: { load: () => Promise<Answers>; back: [href: string, label: string]; photo?: (key: string) => string | undefined; open?: (answerId: string) => string } = $props();

	let got = $state<Answers>({ definition: { elements: [] }, answers: [], rows: [] });
	let note = $state('');
	$effect(() => void load().then((g) => (got = current(g)), (e) => (note = e.message)));

	const cols = $derived(keys(got.definition));
	const groups = $derived(cols.filter((c) => c.type === 'paneldynamic'));
	const plain = $derived(cols.filter((c) => !c.group && c.type !== 'paneldynamic'));
	const when = $derived(new Map(got.answers.map((a) => [a.id, a.filledAt.slice(0, 16).replace('T', ' ')])));
	const td = 'border-b border-rule py-1 pr-4 align-top';
</script>

<a class="small-btn mb-6" href={back[0]} data-back>← {back[1]}</a>
<div class="mb-6 flex flex-wrap items-center gap-4">
	<h1 class="flex-1 font-display text-3xl text-(--accent)">{got.definition.title ?? 'Form'}: answers</h1>
	{#if got.answers.length}<button class="small-btn" onclick={() => download(sheets(got))} data-export>Export CSV</button>{/if}
</div>
{#if note}<p class="text-muted" data-note>{note}</p>{/if}

<div class="overflow-x-auto">
	<table class="text-left text-sm" data-report>
		<thead><tr><th class={td}>filled</th>{#each plain as c (c.key)}<th class={td} data-col={c.key}>{c.label}</th>{/each}</tr></thead>
		<tbody>
			{#each got.answers as a (a.id)}
				<tr data-answer={a.id}>
					<td class={td}>{#if open}<a class="underline" href={open(a.id)} data-open>{when.get(a.id)}</a>{:else}{when.get(a.id)}{/if}</td>
					{#each plain as c (c.key)}<td class={td}><Value v={a.data[c.key]} {photo} /></td>{/each}
				</tr>
			{:else}
				<tr><td class="py-2 text-muted" colspan="99">No answers yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#each groups as g (g.key)}
	{@const own = cols.filter((c) => c.group === g.key)}
	<h2 class="mt-8 mb-2 font-display text-2xl">{g.label}</h2>
	<div class="overflow-x-auto">
		<table class="text-left text-sm" data-group-report={g.key}>
			<thead><tr><th class={td}>filled</th><th class={td}>#</th>{#each own as c (c.key)}<th class={td}>{c.label}</th>{/each}</tr></thead>
			<tbody>
				{#each got.rows.filter((r) => r.groupKey === g.key) as r (r.id)}
					<tr><td class={td}>{when.get(r.answer)}</td><td class={td}>{r.n}</td>{#each own as c (c.key)}<td class={td}><Value v={r.data[c.key]} {photo} /></td>{/each}</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/each}
