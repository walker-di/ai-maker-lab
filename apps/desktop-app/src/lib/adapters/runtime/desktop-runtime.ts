import { Electroview } from 'electrobun/view';
import type { ChatTransport } from '../chat/ChatTransport';
import type { TodoTransport } from '../todo/TodoTransport';
import type { SettingsTransport } from '../settings/SettingsTransport';
import type { PlatformerTransport } from '../platformer/PlatformerTransport';
import type { DesktopChatStreamBridge } from '../chat/desktop-chat-stream-bridge';
import { createDesktopChatTransport } from '../chat/desktop-chat-transport';
import { createDesktopTodoTransport } from '../todo/desktop-todo-transport';
import { createDesktopSettingsTransport } from '../settings/desktop-settings-transport';
import { createDesktopPlatformerTransport } from '../platformer/desktop-platformer-transport';
import { createDesktopChatStreamBridge } from '../chat/desktop-chat-stream-bridge';
import type { DesktopRpcSchema } from './desktop-rpc-schema';

export type DesktopWebviewRpc = ReturnType<typeof Electroview.defineRPC<DesktopRpcSchema>>;

export interface DesktopRuntime {
	rpc: DesktopWebviewRpc;
	chatTransport: ChatTransport;
	todoTransport: TodoTransport;
	settingsTransport: SettingsTransport;
	platformerTransport: PlatformerTransport;
	streamBridge: DesktopChatStreamBridge;
}

let runtime: DesktopRuntime | undefined;

/**
 * Lazily constructs the single Electroview RPC channel for this webview and
 * the per-feature transports that consume it. All renderer-side adapters must
 * go through this accessor; constructing additional `Electroview` instances
 * silently breaks RPC because Electrobun supports exactly one per webview.
 *
 * `maxRequestTime` is set to `Infinity` because the desktop chat path is
 * currently request/response (no incremental streaming): the bun handler
 * awaits the full LLM completion before replying, which routinely exceeds
 * Electrobun's 1s default timeout - especially on the first call when the
 * provider client is cold. Failures are surfaced via the bun handler's
 * own resolve/reject path instead of a renderer-side stopwatch.
 */
export function getDesktopRuntime(): DesktopRuntime {
	if (runtime) return runtime;

	const rpc = Electroview.defineRPC<DesktopRpcSchema>({
		handlers: {},
		maxRequestTime: Infinity,
	});
	new Electroview({ rpc });

	runtime = {
		rpc,
		chatTransport: createDesktopChatTransport(rpc),
		todoTransport: createDesktopTodoTransport(rpc),
		settingsTransport: createDesktopSettingsTransport(rpc),
		platformerTransport: createDesktopPlatformerTransport(rpc),
		streamBridge: createDesktopChatStreamBridge(rpc),
	};

	return runtime;
}
