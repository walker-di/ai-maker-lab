<script lang="ts">
	interface Props { narrationAudioUrl?: string; bgmUrl?: string; }
	let { narrationAudioUrl, bgmUrl }: Props = $props();
</script>

<div class="space-y-2">
	{#if narrationAudioUrl}<audio src={narrationAudioUrl} controls class="w-full"><track kind="captions" /></audio>{/if}
	{#if bgmUrl}<audio src={bgmUrl} controls class="w-full"><track kind="captions" /></audio>{/if}
	{#if !narrationAudioUrl && !bgmUrl}<p class="text-sm text-muted-foreground">No audio generated yet.</p>{/if}
</div>
