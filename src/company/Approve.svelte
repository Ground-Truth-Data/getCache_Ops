<script lang="ts">
	import { decide, drafts } from './central';

	let list = $state<Awaited<ReturnType<typeof drafts>>>([]);
	let note = $state('');
	const load = () => drafts().then((d) => (list = d), (e) => (note = e.message));
	load();
	const act = (id: string, status: 'approved' | 'rejected') => decide(id, status).then(load, (e) => (note = e.message));
</script>

<h1 class="mb-6 font-display text-3xl text-(--accent)">Approve companies</h1>
<ul class="flex flex-col gap-3" data-drafts>
	{#each list as c (c.id)}
		<li class="flex flex-wrap items-center gap-3" data-draft={c.slug}>
			<span class="font-display text-xl">{c.name}</span>
			<span class="text-sm text-muted">{c.slug} · {new Date(c.createdAt).toLocaleDateString()}</span>
			<button class="rt-fancy-btn rounded-lg px-3 py-0.5 font-display" onclick={() => act(c.id, 'approved')} data-approve>Approve</button>
			<button class="text-sm text-muted underline" onclick={() => act(c.id, 'rejected')} data-reject>Reject</button>
		</li>
	{:else}
		<li class="text-muted">Nothing waiting. Only Get Cache's approvers see drafts here.</li>
	{/each}
</ul>
{#if note}<p class="mt-4 text-sm text-muted" data-note>{note}</p>{/if}
