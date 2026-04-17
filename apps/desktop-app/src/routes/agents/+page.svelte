<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		Button,
		AgentRegistryActionBar,
		AgentRegistryDetailCard,
		AgentRegistryEmptyState,
		AgentRegistryFilters,
		AgentRegistryListItem,
	} from 'ui/source';
	import { createAgentRegistryPage } from './agent-registry-page.composition';

	const model = createAgentRegistryPage();
</script>

<svelte:head>
	<title>{m.agent_registry_title()}</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10 lg:px-8">
	<section class="max-w-3xl space-y-3">
		<p class="text-muted-foreground text-sm font-medium uppercase tracking-wide">
			{m.agent_registry_section_label()}
		</p>
		<h1 class="text-4xl font-semibold tracking-tight">{m.agent_registry_title()}</h1>
		<p class="text-muted-foreground text-base leading-7">{m.agent_registry_intro()}</p>
	</section>

	{#if model.errorMessage}
		<div
			class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
		>
			<span>{model.errorMessage}</span>
			<Button variant="ghost" size="sm" onclick={() => model.dismissError()}>
				{m.agent_registry_dismiss()}
			</Button>
		</div>
	{/if}

	<div class="grid gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
		<section class="space-y-4">
			<AgentRegistryFilters
				searchValue={model.searchQuery}
				sourceFilter={model.sourceFilter}
				statusFilter={model.statusFilter}
				providerFilter={model.providerFilter}
				providers={model.providers}
				onSearchChange={(value) => model.setSearchQuery(value)}
				onSourceChange={(value) => model.setSourceFilter(value)}
				onStatusChange={(value) => model.setStatusFilter(value)}
				onProviderChange={(value) => model.setProviderFilter(value)}
			/>

			<div class="space-y-3 rounded-2xl border p-3">
				<div class="flex items-center justify-between px-1 pt-1">
					<div>
						<h2 class="text-sm font-semibold">{m.agent_registry_list_title()}</h2>
						<p class="text-muted-foreground text-xs">
							{m.agent_registry_list_count({
								visible: model.filteredAgents.length,
								total: model.agents.length,
							})}
						</p>
					</div>
					<Button variant="outline" size="sm" onclick={() => model.startCreateAgent()}>
						{m.agent_registry_new_agent()}
					</Button>
				</div>

				{#if model.isLoading && !model.hasLoaded}
					<div class="px-3 py-10 text-center">
						<p class="text-muted-foreground text-sm">{m.agent_registry_loading()}</p>
					</div>
				{:else if model.filteredAgents.length === 0}
					<AgentRegistryEmptyState
						title={model.hasActiveFilters
							? m.agent_registry_empty_filtered_title()
							: m.agent_registry_empty_title()}
						description={
							model.hasActiveFilters
								? m.agent_registry_empty_filtered_description()
								: m.agent_registry_empty_description()
						}
						actionLabel={m.agent_registry_empty_action()}
						onAction={() => model.startCreateAgent()}
					/>
				{:else}
					<div class="space-y-2" role="listbox" aria-label={m.agent_registry_list_title()}>
						{#each model.filteredAgents as agent (agent.id)}
							<AgentRegistryListItem
								{agent}
								selected={agent.id === model.selectedAgentId && !model.isCreating}
								onclick={() => model.selectAgent(agent.id)}
							/>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<section class="space-y-4">
			<AgentRegistryActionBar
				useInChatHref={model.useInChatHref}
				canEdit={model.isEditing}
				canDuplicate={model.selectedAgent?.source === 'system'}
				canInherit={model.selectedAgent?.source === 'system'}
				canSave={model.canSave}
				isSaving={model.isSaving}
				onDuplicate={() => void model.duplicateSelectedAgent()}
				onInherit={() => void model.inheritSelectedAgent()}
				onSave={() => void model.saveAgent()}
			/>

			{#if model.selectedAgent || model.isCreating}
				<AgentRegistryDetailCard
					agent={model.selectedAgent}
					draft={model.draft}
					activeModelCard={model.activeModelCard}
					isCreating={model.isCreating}
					isEditable={model.isEditing}
					modelOptions={model.modelOptions}
					toolOptions={model.toolOptions}
					onNameChange={(value) => model.updateName(value)}
					onDescriptionChange={(value) => model.updateDescription(value)}
					onSystemPromptChange={(value) => model.updateSystemPrompt(value)}
					onModelCardChange={(value) => model.updateModelCard(value)}
					onToolToggle={(toolKey, enabled) => model.updateToolState(toolKey, enabled)}
				/>
			{:else}
				<AgentRegistryEmptyState
					title={m.agent_registry_select_title()}
					description={m.agent_registry_select_description()}
				/>
			{/if}
		</section>
	</div>
</div>
