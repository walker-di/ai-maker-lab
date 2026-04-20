import type { TodoRpcSchema } from '../todo/electrobun-todo-rpc';
import type { ChatRpcSchema } from '../chat/electrobun-chat-rpc';
import type { SettingsRpcSchema } from '../settings/electrobun-settings-rpc';
import type { PlatformerRpcSchema } from '../platformer/electrobun-platformer-rpc';

export type DesktopRpcSchema = {
	bun: {
		requests: TodoRpcSchema['bun']['requests'] &
			ChatRpcSchema['bun']['requests'] &
			SettingsRpcSchema['bun']['requests'] &
			PlatformerRpcSchema['bun']['requests'];
		messages: TodoRpcSchema['bun']['messages'] &
			ChatRpcSchema['bun']['messages'] &
			SettingsRpcSchema['bun']['messages'] &
			PlatformerRpcSchema['bun']['messages'];
	};
	webview: {
		requests: TodoRpcSchema['webview']['requests'] &
			ChatRpcSchema['webview']['requests'] &
			SettingsRpcSchema['webview']['requests'] &
			PlatformerRpcSchema['webview']['requests'];
		messages: TodoRpcSchema['webview']['messages'] &
			ChatRpcSchema['webview']['messages'] &
			SettingsRpcSchema['webview']['messages'] &
			PlatformerRpcSchema['webview']['messages'];
	};
};
