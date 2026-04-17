<script lang="ts">
	import type { ChatAgentProfile, HostedToolInfo } from './types.js';
	import type { PendingAttachment } from './ChatComposer.svelte.ts';
	import ChatAttachmentPill from './ChatAttachmentPill.svelte';
	import * as InputGroup from '$ui/components/ui/input-group/index.js';
	import * as Popover from '$ui/components/ui/popover/index.js';
	import * as Command from '$ui/components/ui/command/index.js';
	import * as Tooltip from '$ui/components/ui/tooltip/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import { Switch } from '$ui/components/ui/switch/index.js';

	interface Props {
		draft: string;
		ondraftchange?: (value: string) => void;
		agents?: readonly ChatAgentProfile[];
		threadParticipants?: readonly ChatAgentProfile[];
		defaultAgent?: ChatAgentProfile | null;
		hostedTools?: readonly HostedToolInfo[];
		disabledControls?: readonly string[];
		canSend?: boolean;
		isSending?: boolean;
		pendingAttachments?: readonly PendingAttachment[];
		onSend?: () => void;
		onAddParticipant?: (agentId: string) => void;
		onRemoveParticipant?: (agentId: string) => void;
		onSetDefaultAgent?: (agentId: string) => void;
		onToggleTool?: (toolName: string, enabled: boolean) => void;
		onFilesAdded?: (files: FileList | File[]) => void;
		onRemoveAttachment?: (localId: string) => void;
		placeholder?: string;
	}

	let {
		draft = $bindable(''),
		ondraftchange,
		agents = [],
		threadParticipants = [],
		defaultAgent = null,
		hostedTools = [],
		disabledControls = [],
		canSend = false,
		isSending = false,
		pendingAttachments = [],
		onSend,
		onAddParticipant,
		onRemoveParticipant,
		onSetDefaultAgent,
		onToggleTool,
		onFilesAdded,
		onRemoveAttachment,
		placeholder = 'Send a message...',
	}: Props = $props();

	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let mentionOpen = $state(false);
	let mentionQuery = $state('');
	let mentionStartIndex = $state(-1);
	let mentionSelectedIdx = $state(0);
	let agentPickerOpen = $state(false);
	let toolPickerOpen = $state(false);
	let isDragOver = $state(false);

	function slugify(name: string): string {
		return name.toLowerCase().replace(/\s+/g, '-');
	}

	let mentionCandidates = $derived(
		threadParticipants.length > 0 ? threadParticipants : agents,
	);

	let filteredMentions = $derived(
		mentionQuery
			? mentionCandidates.filter((a) =>
					a.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
					slugify(a.name).includes(mentionQuery.toLowerCase()),
				)
			: [...mentionCandidates],
	);

	let availableToAdd = $derived(
		agents.filter((a) => !threadParticipants.some((p) => p.id === a.id)),
	);

	let enabledToolCount = $derived(
		hostedTools.filter((t) => t.enabled).length,
	);

	function insertMention(agent: ChatAgentProfile) {
		const slug = slugify(agent.name);
		const before = draft.slice(0, mentionStartIndex);
		const after = draft.slice(
			mentionStartIndex + 1 + mentionQuery.length,
		);
		draft = `${before}@${slug} ${after}`;
		mentionOpen = false;
		mentionQuery = '';
		mentionStartIndex = -1;
		mentionSelectedIdx = 0;
		textareaRef?.focus();
	}

	function handleInput() {
		if (!textareaRef) return;
		const pos = textareaRef.selectionStart;
		const text = draft;

		const textBefore = text.slice(0, pos);
		const atIdx = textBefore.lastIndexOf('@');
		if (atIdx >= 0) {
			const charBefore = atIdx > 0 ? textBefore[atIdx - 1] : ' ';
			if (charBefore === ' ' || charBefore === '\n' || atIdx === 0) {
				const query = textBefore.slice(atIdx + 1);
				if (!/\s/.test(query)) {
					mentionOpen = true;
					mentionQuery = query;
					mentionStartIndex = atIdx;
					mentionSelectedIdx = 0;
					return;
				}
			}
		}
		mentionOpen = false;
		mentionQuery = '';
		mentionStartIndex = -1;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (mentionOpen && filteredMentions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				mentionSelectedIdx = (mentionSelectedIdx + 1) % filteredMentions.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				mentionSelectedIdx =
					(mentionSelectedIdx - 1 + filteredMentions.length) % filteredMentions.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertMention(filteredMentions[mentionSelectedIdx]);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				mentionOpen = false;
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey && canSend) {
			e.preventDefault();
			onSend?.();
		}
	}

	function isControlDisabled(control: string): boolean {
		return disabledControls.includes(control);
	}

	function openFilePicker() {
		fileInputRef?.click();
	}

	function handleFileInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			onFilesAdded?.(input.files);
			input.value = '';
		}
	}

	function handleDragOver(e: DragEvent) {
		if (isControlDisabled('file-attach')) return;
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		if (isControlDisabled('file-attach')) return;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			onFilesAdded?.(e.dataTransfer.files);
		}
	}
</script>

<div
	class="relative {isDragOver ? 'ring-primary ring-2 rounded-lg' : ''}"
	role="region"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<input
		bind:this={fileInputRef}
		type="file"
		multiple
		class="hidden"
		onchange={handleFileInputChange}
	/>
	{#if mentionOpen && filteredMentions.length > 0}
		<div
			class="bg-popover text-popover-foreground border-border absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-md border shadow-md"
		>
			<div class="max-h-48 overflow-y-auto p-1">
				{#each filteredMentions as agent, idx (agent.id)}
					<button
						class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm {idx === mentionSelectedIdx
							? 'bg-accent text-accent-foreground'
							: ''}"
						onmousedown={(e) => { e.preventDefault(); insertMention(agent); }}
					>
						<span class="font-medium">{agent.name}</span>
						<span class="text-muted-foreground text-xs">{agent.modelCard.label}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Participant chips row -->
	{#if threadParticipants.length > 0}
		<div class="mb-1.5 flex flex-wrap items-center gap-1">
			{#each threadParticipants as participant (participant.id)}
				<span
					class="bg-secondary text-secondary-foreground inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
					role="button"
					tabindex="0"
					onclick={() => onSetDefaultAgent?.(participant.id)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSetDefaultAgent?.(participant.id); } }}
					title={participant.id === defaultAgent?.id
						? `${participant.name} (default)`
						: `Set ${participant.name} as default`}
				>
					<span>{participant.name}</span>
					{#if participant.id === defaultAgent?.id}
						<Badge variant="outline" class="ml-0.5 px-1 py-0 text-[9px]">default</Badge>
					{/if}
					{#if threadParticipants.length > 1}
						<button
							class="text-muted-foreground hover:text-destructive -mr-1 ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
							onclick={(e) => { e.stopPropagation(); onRemoveParticipant?.(participant.id); }}
							title="Remove"
						>
							<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
								<path d="M18 6 6 18" /><path d="m6 6 12 12" />
							</svg>
						</button>
					{/if}
				</span>
			{/each}

			<!-- Add participant button (Popover + Command combobox) -->
			{#if availableToAdd.length > 0 && onAddParticipant}
				<Popover.Root bind:open={agentPickerOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground inline-flex h-6 items-center gap-0.5 rounded-full border px-2 text-xs transition-colors"
							>
								<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M5 12h14" /><path d="M12 5v14" />
								</svg>
								<span>Agent</span>
							</button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content side="top" align="start" class="w-64 p-0">
						<Command.Root>
							<Command.Input placeholder="Search agents..." />
							<Command.List>
								<Command.Empty>No agents found.</Command.Empty>
								<Command.Group>
									{#each availableToAdd as agent (agent.id)}
										<Command.Item
											value={agent.name}
											onSelect={() => {
												onAddParticipant?.(agent.id);
												agentPickerOpen = false;
											}}
										>
											<span class="flex-1 truncate">{agent.name}</span>
											<span class="text-muted-foreground text-xs">{agent.modelCard.label}</span>
										</Command.Item>
									{/each}
								</Command.Group>
							</Command.List>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			{/if}
		</div>
	{/if}

	<!-- Pending attachment pills -->
	{#if pendingAttachments.length > 0}
		<div class="mb-1.5 flex flex-wrap items-center gap-1">
			{#each pendingAttachments as att (att.localId)}
				<Badge
					variant={att.classification === 'unsupported' ? 'destructive' : 'secondary'}
					class="gap-1 text-xs"
				>
					<span class="max-w-24 truncate">{att.name}</span>
					<span class="text-muted-foreground text-[10px]">
						{#if att.size < 1024}
							{att.size}B
						{:else if att.size < 1024 * 1024}
							{Math.round(att.size / 1024)}KB
						{:else}
							{(att.size / (1024 * 1024)).toFixed(1)}MB
						{/if}
					</span>
					{#if att.classification === 'unsupported'}
						<span class="text-[10px]" title="Unsupported file type">⚠</span>
					{/if}
					<button
						class="hover:text-destructive -mr-1 ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
						onclick={(e) => { e.stopPropagation(); onRemoveAttachment?.(att.localId); }}
						title="Remove"
					>
						<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 6 6 18" /><path d="m6 6 12 12" />
						</svg>
					</button>
				</Badge>
			{/each}
		</div>
	{/if}

	<InputGroup.Root>
		<InputGroup.Textarea
			bind:ref={textareaRef}
			{placeholder}
			bind:value={draft}
			onkeydown={handleKeydown}
			oninput={handleInput}
			class="min-h-[60px] resize-none"
			disabled={isSending}
		/>
		<InputGroup.Addon align="block-end">
			{#if !isControlDisabled('file-attach')}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<InputGroup.Button {...props} size="icon-xs" disabled={isSending} onclick={openFilePicker}>
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
								</svg>
							</InputGroup.Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Attach file</Tooltip.Content>
				</Tooltip.Root>
			{/if}

			<!-- Tools / Sources picker -->
			{#if hostedTools.length > 0 && !isControlDisabled('tools') && onToggleTool}
				<Popover.Root bind:open={toolPickerOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<InputGroup.Button {...props} variant="ghost" disabled={isSending}>
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
								</svg>
								{#if enabledToolCount > 0}
									<span class="ml-1 text-xs">{enabledToolCount}</span>
								{/if}
							</InputGroup.Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content side="top" align="start" class="w-72 p-0">
						<div class="p-3">
							<h4 class="mb-2 text-sm font-medium">Tools & Sources</h4>
							<div class="space-y-2">
								{#each hostedTools as tool (tool.name)}
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0 flex-1">
											<span class="block truncate text-sm">{tool.label}</span>
											<span class="text-muted-foreground block text-[10px]">{tool.family}</span>
										</div>
										<Switch
											checked={tool.enabled}
											onCheckedChange={(checked) => onToggleTool?.(tool.name, checked)}
											disabled={isSending}
										/>
									</div>
								{/each}
							</div>
						</div>
					</Popover.Content>
				</Popover.Root>
			{/if}

			<!-- Default agent indicator (when participants present) -->
			{#if defaultAgent && threadParticipants.length > 0}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<InputGroup.Button {...props} variant="ghost" disabled class="pointer-events-none text-xs opacity-70">
								{defaultAgent.name}
							</InputGroup.Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Responding agent</Tooltip.Content>
				</Tooltip.Root>
			{:else if agents.length > 0 && threadParticipants.length === 0 && onAddParticipant}
				<!-- Fallback single-agent picker when no thread participants exist -->
				<Popover.Root bind:open={agentPickerOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<InputGroup.Button {...props} variant="ghost" disabled={isSending}>
								{defaultAgent?.name ?? 'Select agent'}
							</InputGroup.Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content side="top" align="start" class="w-64 p-0">
						<Command.Root>
							<Command.Input placeholder="Search agents..." />
							<Command.List>
								<Command.Empty>No agents found.</Command.Empty>
								<Command.Group>
									{#each agents as agent (agent.id)}
										<Command.Item
											value={agent.name}
											onSelect={() => {
												onSetDefaultAgent?.(agent.id);
												agentPickerOpen = false;
											}}
										>
											<span class="flex-1 truncate">{agent.name}</span>
											<span class="text-muted-foreground text-xs">{agent.modelCard.label}</span>
										</Command.Item>
									{/each}
								</Command.Group>
							</Command.List>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			{/if}

			<span class="ms-auto"></span>
			<Separator orientation="vertical" class="!h-4" />

			<InputGroup.Button
				variant="default"
				class="rounded-full"
				size="icon-xs"
				disabled={!canSend}
				onclick={() => onSend?.()}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m5 12 7-7 7 7" />
					<path d="M12 19V5" />
				</svg>
				<span class="sr-only">Send</span>
			</InputGroup.Button>
		</InputGroup.Addon>
	</InputGroup.Root>
</div>
