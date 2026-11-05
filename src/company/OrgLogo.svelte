<script lang="ts">
	import { logoUrl } from './central';

	let { logo, size = 4.5 }: { logo: string | null | undefined; size?: number } = $props();
</script>

<span class="logo-box" style:width="{size}rem" style:height="{size}rem">
	<img src={logo ? logoUrl({ logo }) : 'org_gold.webp'} alt="" class={logo ? 'h-full w-full object-contain' : 'h-3/5 w-3/5 object-contain'} />
</span>
