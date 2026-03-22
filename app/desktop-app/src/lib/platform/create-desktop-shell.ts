import { createBrowserDesktopShell } from './browser-desktop-shell';
import { createNeutralinoDesktopShell, isNeutralinoRuntime } from './neutralino-desktop-shell';

export function createDesktopShell() {
	return isNeutralinoRuntime() ? createNeutralinoDesktopShell() : createBrowserDesktopShell();
}
