<script lang="ts">
	import type { StoryboardFrame } from './types.js';

	interface Props {
		frame: StoryboardFrame;
	}
	let { frame }: Props = $props();
</script>

<div class="flex items-center gap-1" aria-label="Asset status">
	<span
		class="h-2 w-2 rounded-full {frame.mainImageUrl ? 'bg-green-500' : 'bg-muted-foreground/30'}"
		title={frame.mainImageUrl ? 'Main image ready' : 'Main image missing'}
	></span>
	<span
		class="h-2 w-2 rounded-full {frame.backgroundImageUrl ? 'bg-green-500' : 'bg-muted-foreground/30'}"
		title={frame.backgroundImageUrl ? 'Background ready' : 'Background missing'}
	></span>
	<span
		class="h-2 w-2 rounded-full {frame.narrationAudioUrl ? 'bg-green-500' : 'bg-muted-foreground/30'}"
		title={frame.narrationAudioUrl ? 'Narration ready' : 'Narration missing'}
	></span>
	<span
		class="h-2 w-2 rounded-full {frame.bgmUrl ? 'bg-green-500' : 'bg-muted-foreground/30'}"
		title={frame.bgmUrl ? 'BGM ready' : 'BGM missing'}
	></span>
</div>
