<script lang="ts">
	import { copyForm, forms, type FormRow } from './forms';

	let { orgKey }: { orgKey: string } = $props();
	let list = $state<FormRow[][]>([]);
	let paste = $state('');
	let note = $state('');

	async function load() {
		const by = new Map<string, FormRow[]>();
		for (const f of await forms(orgKey)) by.set(f.formId, [...(by.get(f.formId) ?? []), f]);
		list = [...by.values()];
	}
	$effect(() => void load().catch((e) => (note = e.message)));

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
		{#each list as versions (versions[0].formId)}
			{@const last = versions.at(-1)!}
			{@const live = versions.findLast((v) => v.publishedAt)}
			<li class="flex flex-wrap items-baseline gap-3" data-form-row={last.definition.title}>
				<a class="font-display text-lg underline" href="#/company/form/{last.formId}">{last.definition.title || 'Untitled form'}</a>
				<span class="text-sm text-muted">{live ? `version ${live.version}` : 'not published'}{last.publishedAt ? '' : ' · draft'}{last.copiedFrom || versions[0].copiedFrom ? ' · a copy' : ''}</span>
				{#if live}
					<a class="text-sm underline" href="#/company/report/{last.formId}" data-report-link>Answers</a>
					<span class="text-sm text-muted" title="Give this to another organization's admin to copy the form">copy link: <code data-copy-link>{live.id}</code></span>
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
