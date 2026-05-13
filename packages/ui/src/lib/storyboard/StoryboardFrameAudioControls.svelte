<script lang="ts">
	interface Props { narrationAudioUrl?: string; bgmUrl?: string; }
	let { narrationAudioUrl, bgmUrl }: Props = $props();
</script>

<div class="space-y-2" aria-label="Storyboard audio playback">
	{#if narrationAudioUrl}
		<div class="space-y-1">
			<p class="text-xs font-medium text-muted-foreground">Narration audio</p>
			<audio src={narrationAudioUrl} controls class="w-full" aria-label="Play generated narration audio"><track kind="captions" /></audio>
		</div>
	{/if}
	{#if bgmUrl}
		<div class="space-y-1">
			<p class="text-xs font-medium text-muted-foreground">Background music</p>
			<audio src={bgmUrl} controls class="w-full" aria-label="Play generated background music"><track kind="captions" /></audio>
		</div>
	{/if}
	{#if !narrationAudioUrl && !bgmUrl}<p class="text-sm text-muted-foreground">No audio generated yet. Use Generate narration to create frame audio.</p>{/if}
</div>
