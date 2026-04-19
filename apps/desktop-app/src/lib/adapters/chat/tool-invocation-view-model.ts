import type { ChatToolInvocation } from 'domain/shared';
import { normalizeToolInvocationPart, resolveToolInvocationOutput } from 'domain/shared';
import type { ChatToolInvocationInfo } from 'ui/source/chat/headless';

function toInfoFromInvocation(invocation: ChatToolInvocation): ChatToolInvocationInfo {
	return {
		toolCallId: invocation.toolCallId,
		toolName: invocation.toolName,
		state: invocation.state,
		input: invocation.input,
		output: invocation.output,
		errorText: invocation.errorText,
		providerExecuted: invocation.providerExecuted,
	};
}

export function toToolInvocationInfo(part: unknown): ChatToolInvocationInfo | null {
	const invocation = normalizeToolInvocationPart(part);
	if (!invocation) {
		return null;
	}
	return toInfoFromInvocation(invocation);
}

export function toToolInvocationInfos(parts: readonly unknown[]): ChatToolInvocationInfo[] {
	return parts
		.map((part) => toToolInvocationInfo(part))
		.filter((part): part is ChatToolInvocationInfo => part != null);
}

export function toPersistedToolInvocationInfos(
	invocations: readonly ChatToolInvocation[] | undefined,
): ChatToolInvocationInfo[] {
	return (invocations ?? []).map((invocation) => ({
		toolCallId: invocation.toolCallId,
		toolName: invocation.toolName,
		state: invocation.state,
		input: invocation.input,
		output: resolveToolInvocationOutput(invocation.output, undefined),
		errorText: invocation.errorText,
		providerExecuted: invocation.providerExecuted,
	}));
}
