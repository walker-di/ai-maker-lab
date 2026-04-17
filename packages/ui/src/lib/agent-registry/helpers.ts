import type { AgentRegistryAgent, AgentRegistryStatus } from './types.js';

export function getAgentRegistryStatus(agent: AgentRegistryAgent): AgentRegistryStatus {
	if (agent.source === 'system') {
		return 'system';
	}

	if (agent.isInherited) {
		return 'inherited';
	}

	if (agent.isDuplicatedFromSystem) {
		return 'duplicated';
	}

	return 'custom';
}

export function formatAgentToolLabel(value: string): string {
	return value
		.replace(/[_-]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
