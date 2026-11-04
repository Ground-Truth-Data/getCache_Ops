<script lang="ts">
	import { sendCode, verifyCode } from '../data/auth';

	let { done }: { done: () => void } = $props();
	let email = $state('');
	let code = $state('');
	let sent = $state(false);
	let note = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		note = '';
		try {
			if (!sent) {
				await sendCode(email.trim());
				sent = true;
				note = `We sent a code to ${email.trim()}.`;
			} else {
				await verifyCode(email.trim(), code.trim());
				done();
			}
		} catch (err) {
			note = (err as Error).message;
		}
	}
</script>

<form class="flex max-w-sm flex-col gap-3" onsubmit={submit} data-signin>
	<p class="text-muted">Sign in with the email you use in Get Cache.</p>
	<input class="rounded-lg border border-rule bg-surface px-3 py-2" type="email" required placeholder="you@example.com" bind:value={email} disabled={sent} data-email />
	{#if sent}
		<input class="rounded-lg border border-rule bg-surface px-3 py-2 tracking-widest" inputmode="numeric" autocomplete="one-time-code" required placeholder="6-digit code" bind:value={code} data-code />
	{/if}
	<button class="rt-fancy-btn self-start rounded-lg px-4 py-1 font-display text-lg">{sent ? 'Sign in' : 'Email me a code'}</button>
	{#if note}<p class="text-sm text-muted" data-note>{note}</p>{/if}
</form>
