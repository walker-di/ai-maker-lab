import type { ElectrobunConfig } from 'electrobun';

export default {
	app: {
		name: 'AI Maker Lab',
		identifier: 'dev.aimakerlab.desktop',
		version: '0.0.1'
	},
	build: {
		bun: {
			entrypoint: 'src/bun/index.ts',
			external: ['@surrealdb/node']
		},
		copy: {
			'web-build': 'views/mainview'
		},
		watchIgnore: ['web-build/**']
	},
	scripts: {
		postBuild: 'scripts/sync-surreal-runtime.mjs'
	}
} satisfies ElectrobunConfig;
