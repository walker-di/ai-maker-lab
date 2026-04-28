<script lang="ts">
	import * as Tabs from '$ui/components/ui/tabs/index.js';
	import type { StoryboardFrame } from './types.js';
	interface Props { frame: StoryboardFrame; }
	let { frame }: Props = $props();
</script>

<Tabs.Root value="narration">
	<Tabs.List>
		<Tabs.Trigger value="narration">Narration</Tabs.Trigger>
		<Tabs.Trigger value="main">Main image</Tabs.Trigger>
		<Tabs.Trigger value="background">Background</Tabs.Trigger>
		<Tabs.Trigger value="bgm">BGM</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="narration" class="text-sm">{frame.narration}</Tabs.Content>
	<Tabs.Content value="main" class="text-sm">{frame.mainImagePrompt}</Tabs.Content>
	<Tabs.Content value="background" class="text-sm">{frame.backgroundImagePrompt}</Tabs.Content>
	<Tabs.Content value="bgm" class="text-sm">{frame.bgmPrompt}</Tabs.Content>
</Tabs.Root>
