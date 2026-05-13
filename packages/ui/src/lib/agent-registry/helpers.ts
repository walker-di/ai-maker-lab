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

export function formatProviderShort(provider: string): string {
	const aliases: Record<string, string> = {
		openai: 'OAI',
		anthropic: 'ANT',
		google: 'GGL',
		groq: 'GROQ',
		mistral: 'MSTL',
		perplexity: 'PPLX',
		cohere: 'COHR',
		aws: 'AWS',
		azure: 'AZUR',
		fireworks: 'FWKS',
		together: 'TGTR',
	};
	const key = provider.toLowerCase().split('/')[0];
	return aliases[key] ?? provider.toUpperCase().slice(0, 4);
}

export function formatAgentToolLabel(value: string): string {
	return value
		.replace(/[_-]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
