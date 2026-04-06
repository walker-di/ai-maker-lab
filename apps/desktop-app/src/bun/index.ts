import { ApplicationMenu, BrowserWindow } from 'electrobun/bun';
import { resolveMainViewUrl } from '../lib/adapters/runtime/main-view-url';

ApplicationMenu.setApplicationMenu([
	{
		submenu: [{ label: 'Quit', role: 'quit' }]
	},
	{
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'separator' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			{ role: 'pasteAndMatchStyle' },
			{ role: 'delete' },
			{ role: 'selectAll' }
		]
	}
]);

const mainWindow = new BrowserWindow({
	title: 'AI Maker Lab',
	url: await resolveMainViewUrl(),
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100
	}
});

console.log(`Desktop app started: ${mainWindow.title}`);
