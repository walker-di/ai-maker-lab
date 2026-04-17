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
		// Must be `postBuild` (not `postWrap`): electrobun only fires `postWrap`
		// during the self-extracting wrap path, which is skipped when
		// `buildEnvironment === 'dev'`. `postBuild` runs unconditionally inside
		// `runBuild`, including on every `electrobun dev --watch` rebuild, so the
		// native `@surrealdb/node` (kept external in the bun bundle) is reliably
		// copied into `Contents/Resources/app/node_modules/` before the app boots.
		// Without this, `surreal.connect('surrealkv://…')` hangs forever and the
		// 30s connect timeout in `database/client.ts` is the symptom you see.
		postBuild: 'scripts/sync-surreal-runtime.mjs'
	}
} satisfies ElectrobunConfig;
