import type { ChatAgentProfile } from './types.js';

export function createChatComposerModel() {
	let draft = $state('');
	let selectedAgentId = $state<string | null>(null);
	let isSending = $state(false);

	return {
		get draft() {
			return draft;
		},
		set draft(value: string) {
			draft = value;
		},

		get selectedAgentId() {
			return selectedAgentId;
		},

		get isSending() {
			return isSending;
		},

		get canSend() {
			return draft.trim().length > 0 && !isSending;
		},

		selectAgent(id: string | null) {
			selectedAgentId = id;
		},

		markSending() {
			isSending = true;
		},

		markReady() {
			isSending = false;
		},

		clear() {
			draft = '';
		},

		getSelectedAgent(agents: readonly ChatAgentProfile[]): ChatAgentProfile | undefined {
			if (!selectedAgentId) return undefined;
			return agents.find((a) => a.id === selectedAgentId);
		},
	};
}
