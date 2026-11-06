<script lang="ts">
	import type { El } from '../../_rapper/gc/form';
	import { ago, columns, current, download, sections, sheets } from './answers';
	import type { Answers, At } from './forms';
	import Value from './Value.svelte';

	let {
		load,
		id,
		back,
		photo,
	}: { load: () => Promise<Answers>; id: string; back: [href: string, label: string]; photo?: (key: string) => string | undefined } = $props();

	let got = $state<Answers>();
	let note = $state('');
	$effect(() => void load().then((g) => (got = current(g)), (e) => (note = e.message)));

	const a = $derived(got?.answers.find((x) => x.id === id));
	const v = $derived(got?.versions.find((x) => x.id === a?.form));
	const cols = $derived(v ? columns([v]) : []);
	const at = $derived(a?.lat != null ? a : undefined);
	// This response's lines in each sheet; Export hands over every response.
	const mine = $derived(a && got ? sheets({ versions: got.versions, answers: [a], rows: got.rows.filter((r) => r.answer === a.id) }) : {});
	const lists = $derived(cols.filter((c) => c.type === 'paneldynamic'));
	const entries = (group: string) => got!.rows.filter((r) => r.answer === id && r.groupKey === group);

	const saved = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
</script>

{#snippet gem(size: number, s?: At)}
	<svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="GPS stamped" class="shrink-0" data-gps-mark>
		{#if s}<title>{s.lat?.toFixed(5)}, {s.lng?.toFixed(5)}</title>{/if}
		<path d="M6 4h12l4 5-10 11L2 9z M2 9h20 M9 4l-2 5 5 11 5-11-2-5" fill="none" stroke="#EDE7DA" stroke-width="1.7" stroke-linejoin="round" />
	</svg>
{/snippet}

{#snippet group(g: El)}
	{@const own = cols.filter((c) => c.group === g.name)}
	{@const list = entries(g.name)}
	{@const gps = list.some((r) => r.lat != null)}
	{@const grid = `grid-template-columns: 2rem repeat(${own.length}, minmax(0, 1fr)) ${gps ? '1.5rem' : ''}`}
	<div class="flex flex-col gap-2 rounded-xl border-[1.5px] border-(--rt-rust) bg-[#1c1916] px-3 py-2.5" data-group={g.name}>
		<div class="flex items-center gap-2">
			<span class="flex-1 font-bold text-(--rt-rust)">{g.title || g.name}</span>
			<span class="flex h-6.5 min-w-6.5 items-center justify-center rounded-full bg-(--rt-sage) px-2 text-[13px] font-extrabold text-[#161a10]" data-count>{list.length}</span>
		</div>
		{#if list.length}
			<div class="grid gap-1.5 px-2 text-xs font-bold tracking-wider text-[#9fa88e] uppercase" style={grid}>
				<span>#</span>{#each own as c (c.key)}<span class="truncate">{c.label}</span>{/each}{#if gps}<span></span>{/if}
			</div>
			{#each list as r (r.id)}
				{@const s = r.lat != null ? r : undefined}
				<div class="grid items-center gap-1.5 rounded-[10px] border-[1.5px] border-(--rt-sage)/60 bg-[#1a1d16] px-2 py-2" style={grid} data-entry={r.n}>
					<span class="font-bold text-[#b9cc95]">{r.n}</span>
					{#each own as c (c.key)}<span class="min-w-0 break-words"><Value v={r.data[c.key]} {photo} /></span>{/each}
					{#if gps}<span>{#if s}{@render gem(16, s)}{/if}</span>{/if}
				</div>
			{/each}
		{/if}
	</div>
{/snippet}

<a class="small-btn mb-6" href={back[0]} data-back>← {back[1]}</a>
{#if note}<p class="text-muted" data-note>{note}</p>{/if}
{#if got && !a}<p class="text-muted" data-note>This response isn't in the answers kept here.</p>{/if}

{#if a && v}
	<div class="flex max-w-xl flex-col gap-3.5" data-response={a.id}>
		<div class="flex items-start gap-3.5 rounded-[20px] border-2 border-[#e8e2d4] bg-[#1e1b19] p-4">
			<div class="flex h-13.5 w-13.5 shrink-0 items-center justify-center rounded-[14px] border-2 border-(--rt-yellow)">
				<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
					><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="var(--rt-yellow)" stroke-width="1.8" /><path d="M9 8h6M9 12h6M9 16h4" stroke="var(--rt-yellow)" stroke-width="1.8" stroke-linecap="round" /></svg
				>
			</div>
			<div class="flex flex-1 flex-col gap-1.5">
				<span class="text-[21px] font-extrabold">{v.definition.title || 'Untitled'}</span>
				<span class="self-start rounded-full border-2 border-(--rt-yellow) px-3 text-[15px] font-bold text-(--rt-yellow)">v{v.version}</span>
			</div>
			<div class="flex flex-col items-end gap-2">
				<span class="text-sm text-(--rt-sage)" title={a.filledAt}>{ago(a.filledAt)}</span>
				{#if at}{@render gem(22)}{/if}
			</div>
		</div>

		<div class="flex items-center gap-2 px-1 text-sm text-[#cfc8ba]" data-where>
			{#if at}{@render gem(16)}{at.lat?.toFixed(4)}, {at.lng?.toFixed(4)}{at.accuracyM != null ? ` · ±${Math.round(at.accuracyM)} m` : ''}{' · '}{/if}saved {saved(a.filledAt)}
		</div>

		{#each sections(v.definition) as s, i (i)}
			<div class="flex flex-col gap-2.5 rounded-[18px] border-2 border-(--rt-yellow) bg-[#1c1a12] px-4 py-3.5" data-section={s.title}>
				<span class="self-start rounded-full bg-[#3a3215] px-2.5 py-0.5 text-[13px] font-bold text-(--rt-yellow)">{s.title}</span>
				{#each s.elements as e (e.name)}
					{#if e.type === 'paneldynamic'}
						{@render group(e)}
					{:else}
						<div class="flex justify-between gap-3 rounded-xl border-[1.5px] border-(--rt-rust) bg-[#1c1916] px-3 py-2.5" data-row={e.name}>
							<span class="font-bold text-(--rt-rust)">{e.title || e.name}</span>
							<span class="text-right font-semibold"><Value v={a.data[e.name]} {photo} /></span>
						</div>
					{/if}
				{/each}
			</div>
		{/each}

		<div class="flex flex-col gap-2.5 rounded-[18px] border-2 border-dashed border-[#4a4236] bg-[#171615] px-4 py-3.5" data-export-box>
			<span class="text-base font-bold">Export as spreadsheet</span>
			<span class="text-sm text-[#b7b0a2]"
				>{Object.keys(mine).length === 1 ? 'One sheet' : `${Object.keys(mine).length} sheets`}. Responses: one row each.{#each lists as g (g.key)}
					{' '}{g.label}: one row per entry, linked by response ID, each with its own GPS.{/each}</span
			>
			<pre class="overflow-x-auto rounded-[10px] bg-[#0e0e0d] p-2.5 font-mono text-[11px] leading-relaxed text-[#d8d2c4]" data-csv-preview>{Object.entries(mine)
					.map(([name, body]) => `${name}\n${body.replaceAll('\r\n', '\n')}`)
					.join('\n')}</pre>
			<button class="min-h-12.5 rounded-[14px] border-2 border-(--rt-yellow) text-base font-bold text-(--rt-yellow)" onclick={() => got && download(sheets(got))} data-export>Export CSV</button>
		</div>
	</div>
{/if}
