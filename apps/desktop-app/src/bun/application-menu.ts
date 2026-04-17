import { ApplicationMenu } from 'electrobun/bun';

export function installApplicationMenu(): void {
	ApplicationMenu.setApplicationMenu([
		{
			submenu: [{ label: 'Quit', role: 'quit' }],
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
				{ role: 'selectAll' },
			],
		},
	]);
}
