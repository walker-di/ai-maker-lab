import { Updater } from 'electrobun/bun';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const BUNDLED_VIEW_URL = 'views://mainview/index.html';

async function canUseDevServer(): Promise<boolean> {
	const channel = await Updater.localInfo.channel();

	if (channel !== 'dev') {
		return false;
	}

	try {
		const response = await fetch(DEV_SERVER_URL, { method: 'HEAD' });
		return response.ok;
	} catch {
		return false;
	}
}

export async function resolveMainViewUrl(): Promise<string> {
	if (await canUseDevServer()) {
		return DEV_SERVER_URL;
	}

	console.log(`Vite dev server unavailable at ${DEV_SERVER_URL}. Using bundled desktop view.`);
	return BUNDLED_VIEW_URL;
}
