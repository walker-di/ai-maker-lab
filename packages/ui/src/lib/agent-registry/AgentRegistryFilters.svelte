<script lang="ts">
	import { Input } from '$ui/components/ui/input/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import type {
		AgentRegistrySourceFilter,
		AgentRegistryStatusFilter,
	} from './types.js';

	interface Props {
		searchValue: string;
		sourceFilter: AgentRegistrySourceFilter;
		statusFilter: AgentRegistryStatusFilter;
		providerFilter: string;
		providers: readonly string[];
		onSearchChange: (value: string) => void;
		onSourceChange: (value: AgentRegistrySourceFilter) => void;
		onStatusChange: (value: AgentRegistryStatusFilter) => void;
		onProviderChange: (value: string) => void;
	}

	let {
		searchValue,
		sourceFilter,
		statusFilter,
		providerFilter,
		providers,
		onSearchChange,
		onSourceChange,
		onStatusChange,
		onProviderChange,
	}: Props = $props();
</script>

<div class="space-y-4 rounded-xl border p-4">
	<div class="space-y-2">
		<Label for="agent-search">Search</Label>
		<Input
			id="agent-search"
			placeholder="Search by name or description"
			value={searchValue}
			oninput={(event) => onSearchChange(event.currentTarget.value)}
		/>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<label class="space-y-2">
			<span class="text-sm font-medium">Source</span>
			<select
				class="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
				value={sourceFilter}
				onchange={(event) => onSourceChange(event.currentTarget.value as AgentRegistrySourceFilter)}
			>
				<option value="all">All sources</option>
				<option value="system">System</option>
				<option value="user">User</option>
			</select>
		</label>

		<label class="space-y-2">
			<span class="text-sm font-medium">Status</span>
			<select
				class="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
				value={statusFilter}
				onchange={(event) => onStatusChange(event.currentTarget.value as AgentRegistryStatusFilter)}
			>
				<option value="all">All statuses</option>
				<option value="system">System</option>
				<option value="inherited">Inherited</option>
				<option value="duplicated">Duplicated</option>
				<option value="custom">Custom</option>
			</select>
		</label>

		<label class="space-y-2">
			<span class="text-sm font-medium">Provider</span>
			<select
				class="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
				value={providerFilter}
				onchange={(event) => onProviderChange(event.currentTarget.value)}
			>
				<option value="all">All providers</option>
				{#each providers as provider (provider)}
					<option value={provider}>{provider}</option>
				{/each}
			</select>
		</label>
	</div>
</div>
