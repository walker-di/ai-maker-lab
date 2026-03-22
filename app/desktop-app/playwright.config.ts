import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://127.0.0.1:4173'
	},
	webServer: {
		command: 'bun run build:web && bun run preview',
		port: 4173
	},
	testMatch: '**/*.e2e.{ts,js}'
});
