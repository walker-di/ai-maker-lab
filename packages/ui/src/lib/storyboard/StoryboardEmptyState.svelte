<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import ClapperboardIcon from '@lucide/svelte/icons/clapperboard';

	interface Props { onCreate: () => void; }
	let { onCreate }: Props = $props();
</script>

<div class="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
	<ClapperboardIcon class="h-10 w-10 text-muted-foreground" />
	<div>
		<h2 class="font-semibold">No storyboards yet</h2>
		<p class="text-muted-foreground text-sm">Create a prompt-first storyboard and generate your first frames.</p>
	</div>
	<Button type="button" onclick={onCreate}>Create storyboard</Button>
</div>
