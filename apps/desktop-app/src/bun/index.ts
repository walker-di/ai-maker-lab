import { BrowserWindow } from 'electrobun/bun';
import { resolveMainViewUrl } from '../lib/adapters/runtime/main-view-url';
import { installApplicationMenu } from './application-menu';
import { bootstrapDesktopServices } from './bootstrap-services';
import { createDesktopBunRpc } from './desktop-rpc';
import { loadRuntimeEnv } from './load-runtime-env';

// macOS launchd does not propagate the user's shell env to GUI-launched .app
// bundles, so production builds cannot rely on `process.env.OPENAI_API_KEY`
// being inherited from `~/.zshrc`. Hydrate `process.env` from the per-channel
// `secrets.env` in `Application Support` BEFORE any module that reads provider
// keys (`buildProviderRegistry` runs inside `bootstrapDesktopServices`). The
// returned `SecretsStore` is reused by the Settings RPC so the in-app editor
// writes to the same file we just loaded.
const { store: secretsStore } = loadRuntimeEnv();

installApplicationMenu();

const services = await bootstrapDesktopServices({ secretsStore });
const rpc = createDesktopBunRpc(services);

const mainWindow = new BrowserWindow({
	title: 'AI Maker Lab',
	url: await resolveMainViewUrl(),
	rpc,
	frame: { width: 1200, height: 800, x: 100, y: 100 },
});

console.log(`Desktop app started: ${mainWindow.title}`);
