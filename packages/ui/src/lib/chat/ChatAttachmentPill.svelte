<script lang="ts">
	import type { AttachmentRef } from './types.js';
	import { Badge } from '$ui/components/ui/badge/index.js';

	interface Props {
		attachment: AttachmentRef;
	}

	let { attachment }: Props = $props();

	const iconMap: Record<string, string> = {
		image: '🖼',
		file: '📄',
		pdf: '📑',
		video: '🎬',
		text: '📝',
	};
</script>

<Badge variant="secondary" class="gap-1 text-xs">
	<span>{iconMap[attachment.type] ?? '📎'}</span>
	<span class="max-w-24 truncate">{attachment.name}</span>
</Badge>
