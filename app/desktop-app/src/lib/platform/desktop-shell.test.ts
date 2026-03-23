import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDesktopShell } from './create-desktop-shell';
import { isNeutralinoRuntime } from './neutralino-desktop-shell';

type NeutralinoConfig = {
	enableNativeAPI: boolean;
	tokenSecurity: string;
	singlePageServe: boolean;
	documentRoot: string;
	nativeAllowList: string[];
	url: string;
	cli: {
		resourcesPath: string;
		frontendLibrary: {
			devCommand: string;
			buildCommand: string;
			devUrl: string;
			patchFile: string;
		};
	};
};

type AppPackageManifest = {
	scripts: Record<string, string>;
};

const globalScope = globalThis as Record<string, unknown>;
const neutralinoConfig = JSON.parse(
	await readFile(new URL('../../../neutralino.config.json', import.meta.url), 'utf8')
) as NeutralinoConfig;
const appPackageManifest = JSON.parse(
	await readFile(new URL('../../../package.json', import.meta.url), 'utf8')
) as AppPackageManifest;
const originalGlobals = new Map<string, unknown>();

function setNeutralinoGlobal(key: string, value: unknown) {
	if (!originalGlobals.has(key)) {
		originalGlobals.set(key, globalScope[key]);
	}

	if (value === undefined) {
		delete globalScope[key];
		return;
	}

	globalScope[key] = value;
}

afterEach(() => {
	for (const [key, value] of originalGlobals) {
		if (value === undefined) {
			delete globalScope[key];
			continue;
		}

		globalScope[key] = value;
	}

	originalGlobals.clear();
});

describe('desktop shell selection', () => {
	it('falls back to the browser shell outside Neutralino', () => {
		setNeutralinoGlobal('NL_VERSION', undefined);

		assert.equal(isNeutralinoRuntime(), false);
		assert.equal(createDesktopShell().kind, 'browser');
	});

	it('selects the Neutralino shell when runtime globals exist', () => {
		setNeutralinoGlobal('NL_VERSION', '6.5.0');

		assert.equal(isNeutralinoRuntime(), true);
		assert.equal(createDesktopShell().kind, 'neutralino');
	});
});

describe('neutralino desktop configuration', () => {
	it('keeps the native API surface intentionally narrow', () => {
		assert.equal(neutralinoConfig.enableNativeAPI, true);
		assert.equal(neutralinoConfig.tokenSecurity, 'one-time');
		assert.equal(neutralinoConfig.singlePageServe, true);
		assert.equal(neutralinoConfig.url, '/');
		assert.deepEqual(neutralinoConfig.nativeAllowList, [
			'app.exit',
			'app.getConfig',
			'os.getEnv',
			'window.minimize'
		]);
	});

	it('keeps build and dev wiring aligned with the Bun workspace scripts', () => {
		assert.equal(neutralinoConfig.documentRoot, '/dist/');
		assert.equal(neutralinoConfig.cli.resourcesPath, '/dist/');
		assert.equal(neutralinoConfig.cli.frontendLibrary.patchFile, '/index.html');
		assert.equal(neutralinoConfig.cli.frontendLibrary.devUrl, 'http://127.0.0.1:5173');
		assert.equal(neutralinoConfig.cli.frontendLibrary.devCommand, 'bun run dev:web');
		assert.equal(appPackageManifest.scripts['dev:web'], 'vite dev --host 127.0.0.1 --port 5173 --strictPort');
		assert.equal(neutralinoConfig.cli.frontendLibrary.buildCommand, appPackageManifest.scripts['build:web']);
		assert.equal(appPackageManifest.scripts['dev'], 'neu run');
		assert.match(appPackageManifest.scripts['build'], /neu build/);
	});
});
