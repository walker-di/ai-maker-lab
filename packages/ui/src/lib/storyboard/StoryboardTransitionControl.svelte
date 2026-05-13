<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import type { StoryboardFrame } from './types.js';
	interface Props { frame: StoryboardFrame; }
	let { frame }: Props = $props();
</script>

<Badge variant="secondary">{frame.transitionTypeAfter} · {frame.transitionDurationMs}ms</Badge>
