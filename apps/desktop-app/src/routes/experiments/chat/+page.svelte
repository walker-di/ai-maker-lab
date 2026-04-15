<script lang="ts">
	import {
		Button,
		Separator,
		Sheet,
		Tooltip,
		ChatThreadListItem,
		ChatMessageBubble,
		ChatComposer,
		ChatReplyPreview,
		ChatAgentListItem,
		ChatAgentCard,
		ChatModelBadge,
	} from 'ui/source';
	import { createChatPage } from './chat-page.composition.ts';

	const model = createChatPage();

	let newThreadTitle = $state('');
	let messagesContainer = $state<HTMLDivElement | undefined>(undefined);
	let agentSheetOpen = $state(false);

	$effect(() => {
		const _len = model.chatMessages.length;
		const _msgs = model.messages.length;
		if (messagesContainer) {
			requestAnimationFrame(() => {
				messagesContainer!.scrollTop = messagesContainer!.scrollHeight;
			});
		}
	});

	function handleNewThread() {
		const title = newThreadTitle.trim() || 'New conversation';
		newThreadTitle = '';
		void model.createThread(title);
	}

	function handleSend() {
		void model.sendMessage();
	}
</script>

<svelte:head>
	<title>Chat Experiment</title>
</svelte:head>

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
							ondelete={() => void model.deleteThread(thread.id)}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</aside>

	<!-- Center panel: Messages + Composer -->
	<main class="flex flex-1 flex-col">
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
					{#if model.selectedAgent}
						<p class="text-muted-foreground text-xs">
							{model.selectedAgent.name} &middot; {model.selectedAgent.modelCard.label}
						</p>
					{/if}
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
						class="lg:hidden"
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
				{:else if model.chatMessages.length === 0 && model.messages.length === 0}
					<p class="text-muted-foreground text-center text-sm">
						No messages yet. Start the conversation!
					</p>
				{:else}
					<div class="mx-auto max-w-3xl space-y-4">
						{#if !model.hasChatSessionMessages}
							{#each model.messages as msg (msg.id)}
								{@const agent = msg.agentId
									? model.agents.find((a) => a.id === msg.agentId)
									: undefined}
								<ChatMessageBubble
									role={msg.role}
									content={msg.content}
									agentName={agent?.name}
									agentSource={agent?.source}
									attachments={msg.attachments}
								/>
							{/each}
						{/if}

						{#each model.chatMessages as msg (msg.id)}
							{@const textParts = msg.parts.filter(
								(p: { type: string }) => p.type === 'text'
							)}
							{@const content = textParts
								.map((p: { type: string; text?: string }) => p.text ?? '')
								.join('')}
							<ChatMessageBubble
								role={msg.role === 'user' ? 'user' : 'assistant'}
								{content}
								isStreaming={msg === model.chatMessages[model.chatMessages.length - 1] &&
									msg.role === 'assistant' &&
									model.isStreaming}
							/>
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
					{#if model.replyTarget}
						<ChatReplyPreview
							parentContent={model.replyTarget.content}
							onClear={() => model.clearReply()}
						/>
					{/if}

					{#if model.activePresentation && model.activePresentation.warnings.length > 0}
						<div class="space-y-1">
							{#each model.activePresentation.warnings as warning (warning)}
								<p class="text-xs text-amber-600">{warning}</p>
							{/each}
						</div>
					{/if}

					<ChatComposer
						bind:draft={model.draft}
						agents={model.agents}
						selectedAgentName={model.selectedAgent?.name ?? 'Auto'}
						disabledControls={model.disabledControls}
						canSend={model.canSend}
						isSending={model.isStreaming}
						onSend={handleSend}
						onSelectAgent={(id: string) => model.selectAgent(id)}
					/>
				</div>
			</div>
		{/if}
	</main>

	<!-- Right panel: Agent roster (desktop) -->
	<aside class="border-border hidden w-72 shrink-0 flex-col border-l lg:flex">
		<div class="border-border border-b p-3">
			<h2 class="text-sm font-semibold">Agents</h2>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if model.isLoadingAgents && !model.hasLoaded}
				<p class="text-muted-foreground p-3 text-center text-sm">Loading...</p>
			{:else if model.agents.length === 0}
				<div class="p-3 text-center">
					<p class="text-muted-foreground text-sm">No agents available</p>
					{#if model.errorMessage}
						<p class="mt-1 text-xs text-red-500 dark:text-red-400">{model.errorMessage}</p>
					{/if}
					<Button
						variant="outline"
						size="sm"
						class="mt-2"
						onclick={() => void model.loadInitial()}
					>
						Retry
					</Button>
				</div>
			{:else}
				<div class="space-y-1 p-2">
					{#each model.agents as agent (agent.id)}
						<ChatAgentListItem
							{agent}
							selected={agent.id === model.selectedAgentId}
							onclick={() => model.selectAgent(agent.id)}
						/>
					{/each}
				</div>

				{#if model.selectedAgent}
					<div class="p-3">
						<Separator class="mb-3" />
						<ChatAgentCard
							agent={model.selectedAgent}
							onUse={() => model.selectAgent(model.selectedAgent!.id)}
							onDuplicate={() => void model.duplicateAgent(model.selectedAgent!.id)}
						/>
					</div>
				{/if}
			{/if}
		</div>
	</aside>
</div>

<!-- Mobile agent panel -->
<Sheet.Root bind:open={agentSheetOpen}>
	<Sheet.Content side="right" class="w-80">
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
								model.selectAgent(agent.id);
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
								model.selectAgent(model.selectedAgent!.id);
								agentSheetOpen = false;
							}}
							onDuplicate={() => void model.duplicateAgent(model.selectedAgent!.id)}
						/>
					</div>
				{/if}
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
</Tooltip.Provider>
