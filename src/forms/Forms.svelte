<script lang="ts">
	import { copyForm, forms, type FormRow } from './forms';

	let { orgKey }: { orgKey: string } = $props();
	let list = $state<FormRow[]>([]);
	let paste = $state('');
	let note = $state('');

	$effect(() => void forms(orgKey).then((f) => (list = f), (e) => (note = e.message)));

	async function copy() {
		note = '';
		const source = paste.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
		if (!source) return void (note = 'Paste the copy link another organization gave you.');
		try {
			location.hash = `#/company/form/${await copyForm(source, orgKey)}`;
		} catch (e) {
			note = (e as Error).message;
		}
	}
</script>

<section class="mt-8" data-forms>
	<h2 class="mb-2 font-display text-2xl">Forms</h2>
	<ul class="mb-3 flex flex-col gap-2">
		{#each list as f (f.id)}
			<li class="flex flex-wrap items-baseline gap-3" class:text-muted={f.replacedBy} data-form-row={f.definition.title}>
				<a class="font-display text-lg underline" href="#/company/form/{f.id}">{f.definition.title || 'Untitled form'}</a>
				<span class="text-sm text-muted">{f.publishedAt ? (f.lockedAt ? 'locked' : 'open') : 'not published'}{f.copiedFrom ? ' · a copy' : ''}</span>
				{#if f.replacedBy}<a class="text-sm underline" href="#/company/form/{f.replacedBy.id}" data-replaced-by>Replaced by {f.replacedBy.title || 'Untitled form'}</a>{/if}
				{#if f.publishedAt}
					<a class="text-sm underline" href="#/company/report/{f.id}" data-report-link>Answers</a>
					<span class="text-sm text-muted" title="Give this to another organization's admin to copy the form">copy link: <code data-copy-link>{f.id}</code></span>
				{/if}
			</li>
		{:else}
			<li class="text-muted">No forms yet.</li>
		{/each}
	</ul>
	<a class="rt-fancy-btn inline-block rounded-lg px-4 py-1 font-display" href="#/company/form/new" data-new-form>New form</a>
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<input class="w-80 rounded border border-rule bg-surface px-2 py-1 text-sm" placeholder="Paste a copy link from another organization" bind:value={paste} data-paste />
		<button class="text-sm underline" onclick={copy} data-copy>Copy into this organization</button>
	</div>
	{#if note}<p class="mt-2 text-sm text-muted" data-note>{note}</p>{/if}
</section>
