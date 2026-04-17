<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { tick } from 'svelte';
	import { toAssistantMessageParts } from '$lib/adapters/chat/ai-sdk-message-parts';
	import { getRenderedAssistantParts } from '$lib/adapters/chat/tool-preview-parts';
	import {
		toPersistedToolInvocationInfos,
		toToolInvocationInfos,
	} from '$lib/adapters/chat/tool-invocation-view-model';
	import type { ChatAttachmentRef } from 'ui/source';
	import {
		Button,
		Dialog,
		Separator,
		Sheet,
		Tooltip,
		ChatThreadListItem,
		ChatMessageBubble,
		ChatComposer,
		ChatSubthreadPreview,
		ChatSubthreadPanel,
		ChatSubthreadMessageList,
		ChatSubthreadEmptyState,
		ChatAgentListItem,
		ChatAgentCard,
		ChatToolInvocationDialog,
	} from 'ui/source';
	import { createChatPage } from './chat-page.composition.ts';

	const model = createChatPage({
		initialAgentId: page.url.searchParams.get('agent'),
		initialThreadId: page.url.searchParams.get('thread'),
		onThreadChange(threadId) {
			const url = new URL(page.url);
			if (threadId) {
				url.searchParams.set('thread', threadId);
			} else {
				url.searchParams.delete('thread');
			}
			replaceState(url, {});
		},
	});

	let newThreadTitle = $state('');
	let messagesContainer = $state<HTMLDivElement | undefined>(undefined);
	let agentSheetOpen = $state(false);
	let renameDialogOpen = $state(false);
	let renameThreadId = $state<string | null>(null);
	let renameThreadTitle = $state('');
	let renameTitleInput = $state<HTMLInputElement | undefined>(undefined);

	$effect(() => {
		const _len = model.chatMessages.length;
		const _msgs = model.messages.length;
		if (messagesContainer) {
			requestAnimationFrame(() => {
				messagesContainer!.scrollTop = messagesContainer!.scrollHeight;
			});
		}
	});

	$effect(() => {
		if (!renameDialogOpen && renameThreadId !== null) {
			renameThreadId = null;
			renameThreadTitle = '';
		}
	});

	function handleNewThread() {
		const title = newThreadTitle;
		newThreadTitle = '';
		void model.createThread(title);
	}

	function handleSend() {
		void model.sendMessage();
	}

	async function openRenameThreadDialog(threadId: string, title: string) {
		renameThreadId = threadId;
		renameThreadTitle = title;
		renameDialogOpen = true;
		await tick();
		renameTitleInput?.focus();
		renameTitleInput?.select();
	}

	function closeRenameThreadDialog() {
		renameDialogOpen = false;
	}

	async function handleRenameThreadSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!renameThreadId) {
			return;
		}

		const originalTitle =
			model.threads.find((thread) => thread.id === renameThreadId)?.title.trim() ?? '';
		const nextTitle = renameThreadTitle.trim();

		if (!nextTitle) {
			return;
		}

		if (nextTitle === originalTitle) {
			closeRenameThreadDialog();
			return;
		}

		await model.updateThreadTitle(renameThreadId, nextTitle);
		if (!model.errorMessage) {
			closeRenameThreadDialog();
		}
	}

</script>

<svelte:head>
	<title>Chat Experiment</title>
</svelte:head>

{#snippet modelCardWarnings()}
	{#if model.activePresentation && model.activePresentation.warnings.length > 0}
		<div class="space-y-1">
			{#each model.activePresentation.warnings as warning (warning)}
				<p class="text-xs text-amber-600">{warning}</p>
			{/each}
		</div>
	{/if}
{/snippet}

<Tooltip.Provider>
<div class="flex h-screen overflow-hidden">
	<!-- Left sidebar: Thread list -->
	<aside class="border-border flex w-64 shrink-0 flex-col border-r">
		<div class="border-border flex items-center justify-between border-b p-3">
			<h2 class="text-sm font-semibold">Threads</h2>
		</div>

		<div class="flex gap-2 p-3">
			<input
				class="border-input bg-background placeholder:text-muted-foreground flex-1 rounded-md border px-2.5 py-1.5 text-sm"
				placeholder="New thread..."
				bind:value={newThreadTitle}
				disabled={!model.canCreateThread}
				onkeydown={(e) => {
					if (e.key === 'Enter') handleNewThread();
				}}
			/>
			<Button
				variant="default"
				size="sm"
				onclick={handleNewThread}
				disabled={!model.canCreateThread}
			>+</Button>
		</div>

		<div class="flex-1 overflow-y-auto px-2 pb-2">
			{#if model.isLoadingThreads && !model.hasLoaded}
				<p class="text-muted-foreground p-3 text-center text-sm">Loading...</p>
			{:else if model.threads.length === 0}
				<p class="text-muted-foreground p-3 text-center text-sm">No threads yet</p>
			{:else}
				<div class="space-y-1">
					{#each model.threads as thread (thread.id)}
						<ChatThreadListItem
							{thread}
							active={thread.id === model.activeThreadId}
							onclick={() => void model.selectThread(thread.id)}
							ontitleedit={() => openRenameThreadDialog(thread.id, thread.title)}
							ondelete={() => void model.deleteThread(thread.id)}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</aside>

	<!-- Center panel: Messages + Composer -->
	<main class="flex min-w-0 flex-1 flex-col">
		{#if model.errorMessage}
			<div
				class="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
			>
				<span>{model.errorMessage}</span>
				<button
					class="ml-2 shrink-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
					onclick={() => model.dismissError()}
				>
					✕
				</button>
			</div>
		{/if}

		{#if !model.activeThread}
			<div class="flex flex-1 items-center justify-center">
				<div class="text-center">
					{#if model.errorMessage && !model.agents.length}
						<h2 class="text-foreground text-lg font-semibold">Something went wrong</h2>
						<p class="text-muted-foreground mt-1 text-sm">{model.errorMessage}</p>
						<Button
							variant="outline"
							size="sm"
							class="mt-3"
							onclick={() => void model.loadInitial()}
						>
							Retry
						</Button>
					{:else}
						<h2 class="text-foreground text-lg font-semibold">Select or create a thread</h2>
						<p class="text-muted-foreground mt-1 text-sm">
							Pick a conversation from the sidebar or start a new one.
						</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Thread header -->
			<div class="border-border flex items-center justify-between border-b px-4 py-3">
				<div>
					<h2 class="text-sm font-semibold">{model.activeThread?.title}</h2>
					<div class="flex items-center gap-2">
						{#if model.defaultAgent}
							<p class="text-muted-foreground text-xs">
								{model.defaultAgent.name} &middot; {model.defaultAgent.modelCard.label}
							</p>
						{/if}
						{#if model.threadParticipants.length > 1}
							<span class="text-muted-foreground text-xs">({model.threadParticipants.length} agents)</span>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if model.isStreaming}
						<Button variant="outline" size="sm" onclick={() => model.stopStreaming()}>
							Stop
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (agentSheetOpen = true)}
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
							<path d="M16 3.13a4 4 0 0 1 0 7.75" />
						</svg>
						<span class="sr-only">Agents</span>
					</Button>
				</div>
			</div>

			<!-- Messages area -->
			<div class="flex-1 overflow-y-auto px-4 py-4" bind:this={messagesContainer}>
				{#if model.isLoadingMessages}
					<p class="text-muted-foreground text-center text-sm">Loading messages...</p>
				{:else if model.timelineSessionMessages.length === 0 && model.timelineMessages.length === 0}
					<p class="text-muted-foreground text-center text-sm">
						No messages yet. Start the conversation!
					</p>
				{:else}
					<div class="mx-auto max-w-3xl space-y-4">
						{#each model.timelineMessages as msg (msg.id)}
							{@const agent = msg.agentId
								? model.agents.find((a) => a.id === msg.agentId)
								: undefined}
							{@const assistantParts = toAssistantMessageParts(msg.parts ?? [])}
							{@const toolInvocations = toPersistedToolInvocationInfos(msg.toolInvocations)}
							{@const renderedAssistantParts = getRenderedAssistantParts(
								assistantParts,
								toolInvocations,
							)}
							{@const replySummary = model.getReplySummary(msg.id)}

							<div class="space-y-2">
								{#if msg.role !== 'user' && renderedAssistantParts.length > 0}
									<ChatMessageBubble
										role={msg.role}
										assistantParts={renderedAssistantParts}
										agentName={agent?.name}
										agentSource={agent?.source}
										attachments={msg.attachments}
										{toolInvocations}
										onAttachmentOpen={(attachment: ChatAttachmentRef) =>
											void model.openAttachmentPreview(attachment)}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{:else}
									<ChatMessageBubble
										role={msg.role}
										content={msg.content}
										agentName={agent?.name}
										agentSource={agent?.source}
										attachments={msg.attachments}
										{toolInvocations}
										onAttachmentOpen={(attachment: ChatAttachmentRef) =>
											void model.openAttachmentPreview(attachment)}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{/if}

								{#if msg.role !== 'user'}
									<div class="max-w-[80%] space-y-2">
										<Button
											variant="ghost"
											size="sm"
											class="px-2 text-xs"
											onclick={() => void model.openSubthread(msg)}
										>
											Reply in thread
										</Button>

										{#if replySummary}
											<ChatSubthreadPreview
												replyCount={replySummary.replyCount}
												latestReplyPreview={replySummary.latestReply.content}
												participantNames={replySummary.participantNames}
												active={model.activeSubthread?.parentMessage.id === msg.id}
												onOpen={() => void model.openSubthread(msg)}
											/>
										{/if}
									</div>
								{/if}
							</div>
						{/each}

						{#each model.timelineSessionMessages as msg (msg.id)}
							{@const assistantParts = toAssistantMessageParts(msg.parts)}
							{@const textContent = assistantParts
								.filter((part) => part.type === 'text')
								.map((part) => part.text)
								.join('\n\n')}
							{@const toolParts = toToolInvocationInfos(msg.parts)}
							{@const renderedAssistantParts = getRenderedAssistantParts(assistantParts, toolParts)}

							{#if msg.role === 'user'}
								<ChatMessageBubble
									role="user"
									content={textContent}
									toolInvocations={toolParts}
									onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
								/>
							{:else if renderedAssistantParts.length > 0}
								<ChatMessageBubble
									role="assistant"
									assistantParts={renderedAssistantParts}
									toolInvocations={toolParts}
									agentName={model.defaultAgent?.name}
									agentSource={model.defaultAgent?.source}
									isStreaming={msg === model.chatMessages[model.chatMessages.length - 1] &&
										msg.role === 'assistant' &&
										model.isStreaming}
									onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
								/>
							{:else if toolParts.length > 0}
								<ChatMessageBubble
									role="assistant"
									content=""
									toolInvocations={toolParts}
									agentName={model.defaultAgent?.name}
									agentSource={model.defaultAgent?.source}
									isStreaming={msg === model.chatMessages[model.chatMessages.length - 1] &&
										msg.role === 'assistant' &&
										model.isStreaming}
									onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
								/>
							{/if}
						{/each}

						{#if model.chatError}
							<div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
								<p class="font-medium">Failed to get a response</p>
								<p class="mt-1 text-xs opacity-80">{model.chatError.message}</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Composer area -->
			<div class="border-border border-t px-4 py-3">
				<div class="mx-auto max-w-3xl space-y-2">
					{@render modelCardWarnings()}

					<ChatComposer
						bind:draft={model.draft}
						agents={model.agents}
						threadParticipants={model.threadParticipants}
						defaultAgent={model.defaultAgent}
						hostedTools={model.hostedTools}
						disabledControls={model.disabledControls}
						canSend={model.canSend}
						isSending={model.isStreaming}
						pendingAttachments={model.pendingAttachments}
						onSend={handleSend}
						onAddParticipant={(agentId: string) => void model.addAgentToThread(agentId)}
						onRemoveParticipant={(agentId: string) => void model.removeAgentFromThread(agentId)}
						onSetDefaultAgent={(agentId: string) => void model.setDefaultAgent(agentId)}
						onToggleTool={(name: string, enabled: boolean) => model.toggleTool(name, enabled)}
						onFilesAdded={(files: FileList | File[]) => model.addFiles(files)}
						onRemoveAttachment={(localId: string) => model.removeAttachment(localId)}
					/>
				</div>
			</div>
		{/if}
	</main>

	{#if model.activeThread && model.isSubthreadOpen && model.activeSubthread}
		{@const activeSubthread = model.activeSubthread}
		<div class="h-full w-[420px] max-w-[38vw] shrink-0">
			<ChatSubthreadPanel
				title="Thread"
				replyCount={model.activeSubthreadReplies.length + model.activeSubthreadSessionMessages.length}
				onClose={() => model.closeSubthread()}
			>
				{#snippet parent()}
					{@const parentAgent = activeSubthread.parentMessage.agentId
						? model.agents.find((a) => a.id === activeSubthread.parentMessage.agentId)
						: undefined}
					{@const parentAssistantParts = toAssistantMessageParts(activeSubthread.parentMessage.parts ?? [])}
					{@const parentToolInvocations = toPersistedToolInvocationInfos(
						activeSubthread.parentMessage.toolInvocations,
					)}
					{@const parentRenderedAssistantParts = getRenderedAssistantParts(
						parentAssistantParts,
						parentToolInvocations,
					)}
					{#if activeSubthread.parentMessage.role !== 'user' && parentRenderedAssistantParts.length > 0}
						<ChatMessageBubble
							role={activeSubthread.parentMessage.role}
							assistantParts={parentRenderedAssistantParts}
							agentName={parentAgent?.name}
							agentSource={parentAgent?.source}
							attachments={activeSubthread.parentMessage.attachments}
							toolInvocations={parentToolInvocations}
							onAttachmentOpen={(attachment: ChatAttachmentRef) =>
								void model.openAttachmentPreview(attachment)}
							onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
						/>
					{:else}
						<ChatMessageBubble
							role={activeSubthread.parentMessage.role}
							content={activeSubthread.parentMessage.content}
							agentName={parentAgent?.name}
							agentSource={parentAgent?.source}
							attachments={activeSubthread.parentMessage.attachments}
							toolInvocations={parentToolInvocations}
							onAttachmentOpen={(attachment: ChatAttachmentRef) =>
								void model.openAttachmentPreview(attachment)}
							onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
						/>
					{/if}
				{/snippet}

				{#snippet content()}
					<ChatSubthreadMessageList>
						{#if model.isLoadingSubthread}
							<p class="text-muted-foreground text-sm">Loading replies...</p>
						{:else if model.subthreadErrorMessage}
							<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
								{model.subthreadErrorMessage}
							</div>
						{:else if model.activeSubthreadReplies.length === 0 && model.activeSubthreadSessionMessages.length === 0}
							<ChatSubthreadEmptyState />
						{:else}
							{#each model.activeSubthreadReplies as reply (reply.id)}
								{@const replyAgent = reply.agentId
									? model.agents.find((a) => a.id === reply.agentId)
									: undefined}
								{@const replyAssistantParts = toAssistantMessageParts(reply.parts ?? [])}
								{@const replyToolInvocations = toPersistedToolInvocationInfos(reply.toolInvocations)}
								{@const replyRenderedAssistantParts = getRenderedAssistantParts(
									replyAssistantParts,
									replyToolInvocations,
								)}
								{#if reply.role !== 'user' && replyRenderedAssistantParts.length > 0}
									<ChatMessageBubble
										role={reply.role}
										assistantParts={replyRenderedAssistantParts}
										agentName={replyAgent?.name}
										agentSource={replyAgent?.source}
										attachments={reply.attachments}
										toolInvocations={replyToolInvocations}
										onAttachmentOpen={(attachment: ChatAttachmentRef) =>
											void model.openAttachmentPreview(attachment)}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{:else}
									<ChatMessageBubble
										role={reply.role}
										content={reply.content}
										agentName={replyAgent?.name}
										agentSource={replyAgent?.source}
										attachments={reply.attachments}
										toolInvocations={replyToolInvocations}
										onAttachmentOpen={(attachment: ChatAttachmentRef) =>
											void model.openAttachmentPreview(attachment)}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{/if}
							{/each}

							{#each model.activeSubthreadSessionMessages as msg (msg.id)}
								{@const assistantParts = toAssistantMessageParts(msg.parts)}
								{@const textContent = assistantParts
									.filter((part) => part.type === 'text')
									.map((part) => part.text)
									.join('\n\n')}
								{@const toolParts = toToolInvocationInfos(msg.parts)}
								{@const renderedAssistantParts = getRenderedAssistantParts(assistantParts, toolParts)}

								{#if msg.role === 'user'}
									<ChatMessageBubble
										role="user"
										content={textContent}
										toolInvocations={toolParts}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{:else if renderedAssistantParts.length > 0}
									<ChatMessageBubble
										role="assistant"
										assistantParts={renderedAssistantParts}
										toolInvocations={toolParts}
										agentName={model.defaultAgent?.name}
										agentSource={model.defaultAgent?.source}
										isStreaming={msg === model.activeSubthreadSessionMessages[model.activeSubthreadSessionMessages.length - 1] &&
											msg.role === 'assistant' &&
											model.isStreaming}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{:else if toolParts.length > 0}
									<ChatMessageBubble
										role="assistant"
										content=""
										toolInvocations={toolParts}
										agentName={model.defaultAgent?.name}
										agentSource={model.defaultAgent?.source}
										isStreaming={msg === model.activeSubthreadSessionMessages[model.activeSubthreadSessionMessages.length - 1] &&
											msg.role === 'assistant' &&
											model.isStreaming}
										onToolInvocationOpen={(invocation) => model.inspectToolInvocation(invocation)}
									/>
								{/if}
							{/each}
						{/if}
					</ChatSubthreadMessageList>
				{/snippet}

				{#snippet footer()}
					{@render modelCardWarnings()}
					<ChatComposer
						bind:draft={model.subthreadDraft}
						agents={model.agents}
						threadParticipants={model.threadParticipants}
						defaultAgent={model.defaultAgent}
						hostedTools={model.hostedTools}
						disabledControls={model.disabledControls}
						canSend={model.canSendSubthread}
						isSending={model.isStreaming}
						pendingAttachments={model.subthreadPendingAttachments}
						placeholder="Reply in thread..."
						onSend={() => void model.sendSubthreadMessage()}
						onAddParticipant={(agentId: string) => void model.addAgentToThread(agentId)}
						onRemoveParticipant={(agentId: string) => void model.removeAgentFromThread(agentId)}
						onSetDefaultAgent={(agentId: string) => void model.setDefaultAgent(agentId)}
						onToggleTool={(name: string, enabled: boolean) => model.toggleTool(name, enabled)}
						onFilesAdded={(files: FileList | File[]) => model.addSubthreadFiles(files)}
						onRemoveAttachment={(localId: string) => model.removeSubthreadAttachment(localId)}
					/>
				{/snippet}
			</ChatSubthreadPanel>
		</div>
	{/if}

</div>

<!-- Agent panel -->
<Sheet.Root bind:open={agentSheetOpen}>
	<Sheet.Content side="right" class="w-80" data-testid="agent-sheet">
		<Sheet.Header>
			<Sheet.Title>Agents</Sheet.Title>
			<Sheet.Description>Select an agent for this conversation.</Sheet.Description>
		</Sheet.Header>

		<div class="flex-1 overflow-y-auto py-2">
			{#if model.agents.length === 0}
				<p class="text-muted-foreground p-3 text-center text-sm">No agents available</p>
			{:else}
				<div class="space-y-1">
					{#each model.agents as agent (agent.id)}
						<ChatAgentListItem
							{agent}
							selected={agent.id === model.selectedAgentId}
							onclick={() => {
								void model.setDefaultAgent(agent.id);
								agentSheetOpen = false;
							}}
						/>
					{/each}
				</div>

				{#if model.selectedAgent}
					<div class="pt-3">
						<Separator class="mb-3" />
						<ChatAgentCard
							agent={model.selectedAgent}
							onUse={() => {
								void model.setDefaultAgent(model.selectedAgent!.id);
								agentSheetOpen = false;
							}}
							onDuplicate={() => void model.duplicateAgent(model.selectedAgent!.id)}
							onInherit={() => void model.inheritAgent(model.selectedAgent!.id)}
						/>
					</div>
				{/if}
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

<Dialog.Root bind:open={renameDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Rename thread</Dialog.Title>
			<Dialog.Description>Update the conversation title shown in the sidebar and header.</Dialog.Description>
		</Dialog.Header>

		<form class="space-y-4" onsubmit={handleRenameThreadSubmit}>
			<input
				bind:this={renameTitleInput}
				class="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
				placeholder="Thread title"
				bind:value={renameThreadTitle}
			/>

			<div class="flex items-center justify-end gap-2">
				<Button type="button" variant="ghost" onclick={closeRenameThreadDialog}>
					Cancel
				</Button>
				<Button type="submit" disabled={!renameThreadTitle.trim()}>
					Save
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={model.attachmentPreviewOpen}>
	{#if model.previewedAttachment}
		<Dialog.Content class="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
			<Dialog.Header class="border-border border-b px-4 py-3 pr-12">
				<Dialog.Title class="truncate text-base">{model.previewedAttachment.name}</Dialog.Title>
				<Dialog.Description class="truncate">
					{model.previewedAttachment.mimeType}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-4 p-4">
				{#if model.isLoadingAttachmentPreview}
					<div class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
						Loading preview...
					</div>
				{:else if model.attachmentPreviewLoadError}
					<div class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
						{model.attachmentPreviewLoadError}
					</div>
				{:else if model.attachmentPreviewKind === 'image' && model.attachmentPreviewUrl}
					<div class="bg-muted flex max-h-[65vh] justify-center overflow-auto rounded-md p-2">
						<img
							src={model.attachmentPreviewUrl}
							alt={model.previewedAttachment.name}
							class="max-h-[60vh] w-auto rounded-md object-contain"
						/>
					</div>
				{:else if model.attachmentPreviewKind === 'video' && model.attachmentPreviewUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						controls
						src={model.attachmentPreviewUrl}
						class="max-h-[65vh] w-full rounded-md bg-black"
					></video>
				{:else if model.attachmentPreviewKind === 'pdf' && model.attachmentPreviewUrl}
					<iframe
						title={`Preview ${model.previewedAttachment.name}`}
						src={model.attachmentPreviewUrl}
						class="h-[65vh] w-full rounded-md border"
					></iframe>
				{:else if model.attachmentPreviewKind === 'text'}
					<pre class="bg-muted max-h-[65vh] overflow-auto rounded-md p-4 text-xs whitespace-pre-wrap">{model.attachmentPreviewText ?? 'No preview available.'}</pre>
				{:else}
					<div class="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
						This file type does not have an in-app preview yet.
					</div>
				{/if}

				<div class="border-border flex items-center justify-between gap-3 border-t pt-3 text-xs">
					<div class="text-muted-foreground min-w-0 space-y-1">
						<p class="truncate">Type: {model.previewedAttachment.mimeType}</p>
						<p>Status: {model.previewedAttachment.status}</p>
					</div>
					{#if model.attachmentPreviewUrl}
						<a
							href={model.attachmentPreviewUrl}
							target="_blank"
							rel="noreferrer"
							class="text-primary hover:underline"
						>
							Open in new tab
						</a>
					{/if}
				</div>
			</div>
		</Dialog.Content>
	{/if}
</Dialog.Root>
<ChatToolInvocationDialog
	bind:open={model.toolDetailOpen}
	invocation={model.inspectedToolInvocation}
	availability={model.inspectedToolAvailability}
/>
</Tooltip.Provider>
