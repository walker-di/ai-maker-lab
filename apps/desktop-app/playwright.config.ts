import { defineConfig, devices } from '@playwright/test';

const PORT = 5188;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	outputDir: 'e2e/.tmp/results',
	timeout: 30_000,
	retries: 1,
	fullyParallel: false,

	use: {
		baseURL: `http://localhost:${PORT}`,
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
		viewport: { width: 1280, height: 720 },
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	webServer: {
		command: `node_modules/.bin/vite dev --port ${PORT}`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		env: {
			SURREAL_HOST: 'mem://',
			SURREAL_NS: 'e2e',
			SURREAL_DB: `test_${Date.now()}`,
		},
	},
});
