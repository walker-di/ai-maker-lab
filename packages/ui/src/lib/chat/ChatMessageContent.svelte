<script lang="ts">
	import { renderChatMarkdown } from './chat-message-markdown.js';

	interface Props {
		content: string;
		enableMarkdown?: boolean;
	}

	let { content, enableMarkdown = false }: Props = $props();

	const renderedMarkdown = $derived(enableMarkdown ? renderChatMarkdown(content) : '');
</script>

{#if enableMarkdown}
	<div
		class="prose prose-sm dark:prose-invert min-w-0 max-w-none text-sm leading-relaxed [overflow-wrap:anywhere] [&_a]:break-all [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-current/20 [&_blockquote]:pl-4 [&_code]:break-words [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-[0.3rem] [&_code]:py-[0.2rem] [&_code]:font-mono [&_code]:text-sm [&_code]:font-semibold [&_code]:text-foreground [&_code]:before:content-none [&_code]:after:content-none [&_li]:my-1 [&_ol]:my-3 [&_p]:my-0 [&_p+p]:mt-4 [&_pre]:bg-muted [&_pre]:text-foreground [&_pre]:border-border [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_tbody]:align-top [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_ul]:my-3"
	>
		{@html renderedMarkdown}
	</div>
{:else}
	<div class="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
		{content}
	</div>
{/if}
