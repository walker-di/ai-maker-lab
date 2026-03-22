import { createWorkspaceChecklist } from '@ai-maker-lab/domain';
import { m } from '$lib/paraglide/messages.js';
import { getLocale, getTextDirection, locales, setLocale, type Locale } from '$lib/paraglide/runtime.js';
import { createDesktopShell } from '$lib/platform/create-desktop-shell';
import type { DesktopRuntimeSnapshot } from '$lib/platform/desktop-shell';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const desktopShell = createDesktopShell();

function applyDocumentLocale(locale: Locale) {
	document.documentElement.lang = locale;
	document.documentElement.dir = getTextDirection(locale);
	document.title = `AI Maker Lab · ${locale.toUpperCase()}`;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return 'Unable to load the Neutralino shell status.';
}

export function createWorkspaceHomeModel() {
	const state = $state<{
		checklist: ReturnType<typeof createWorkspaceChecklist>;
		locale: Locale;
		locales: Locale[];
		runtime: DesktopRuntimeSnapshot | undefined;
		status: LoadState;
		errorMessage: string;
		welcomeMessage: string;
	}>({
		checklist: createWorkspaceChecklist(),
		locale: getLocale(),
		locales: [...locales],
		runtime: undefined,
		status: 'idle',
		errorMessage: '',
		welcomeMessage: ''
	});

	const runtimeSummary = $derived.by(() => {
		if (!state.runtime) {
			return [];
		}

		return [
			{ label: 'Runtime host', value: state.runtime.hostLabel },
			{ label: 'Application ID', value: state.runtime.appId },
			{ label: 'Version', value: state.runtime.appVersion },
			{ label: 'Mode', value: state.runtime.mode },
			{ label: 'Platform', value: `${state.runtime.os} / ${state.runtime.arch}` },
			{ label: 'Home directory', value: state.runtime.homeDirectory }
		];
	});

	async function load() {
		state.status = 'loading';
		state.errorMessage = '';
		applyDocumentLocale(state.locale);

		try {
			await desktopShell.init();
			state.runtime = await desktopShell.getRuntimeSnapshot();
			state.welcomeMessage = m.hello_world({ name: state.runtime.hostLabel }) as string;
			state.status = 'ready';
		} catch (error) {
			state.runtime = undefined;
			state.welcomeMessage = '';
			state.errorMessage = getErrorMessage(error);
			state.status = 'error';
		}
	}

	function changeLocale(locale: Locale) {
		if (locale === state.locale) {
			return;
		}

		state.locale = locale;
		void setLocale(locale);
	}

	async function minimizeWindow() {
		await desktopShell.minimizeWindow();
	}

	async function exitApp() {
		await desktopShell.exit();
	}

	return {
		state,
		get runtimeSummary() {
			return runtimeSummary;
		},
		load,
		changeLocale,
		minimizeWindow,
		exitApp
	};
}
