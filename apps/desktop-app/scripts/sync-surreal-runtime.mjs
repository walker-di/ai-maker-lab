import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const configuredBuildDir = process.env.ELECTROBUN_BUILD_DIR ?? 'build';
const buildEnv = process.env.ELECTROBUN_BUILD_ENV ?? 'dev';
const targetOs = process.env.ELECTROBUN_OS ?? process.platform;
const targetArch = process.env.ELECTROBUN_ARCH ?? process.arch;

function resolveBuildRoot() {
	const baseDir = isAbsolute(configuredBuildDir)
		? configuredBuildDir
		: join(projectRoot, configuredBuildDir);
	const candidateDirs = [baseDir, join(baseDir, `${buildEnv}-${targetOs}-${targetArch}`)];

	for (const candidateDir of candidateDirs) {
		if (existsSync(candidateDir)) {
			return candidateDir;
		}
	}

	throw new Error(`No Electrobun build directory found from ${candidateDirs.join(', ')}`);
}

function findAppBundle(root) {
	const entries = readdirSync(root, { withFileTypes: true });
	const appBundle = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));

	if (!appBundle) {
		throw new Error(`No .app bundle found in ${root}`);
	}

	return join(root, appBundle.name, 'Contents', 'Resources', 'app');
}

function copyRuntimePackage(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Missing runtime package source: ${source}`);
	}

	const resolvedSource = realpathSync(source);
	rmSync(destination, { force: true, recursive: true });
	mkdirSync(dirname(destination), { recursive: true });

	const copyResult = Bun.spawnSync(['cp', '-RL', resolvedSource, destination], {
		stdio: ['ignore', 'inherit', 'inherit'],
	});

	if (copyResult.exitCode !== 0) {
		throw new Error(`Failed to copy runtime package from ${resolvedSource} to ${destination}`);
	}
}

const appResourcesPath = findAppBundle(resolveBuildRoot());

copyRuntimePackage(
	join(projectRoot, '..', '..', 'packages', 'domain', 'node_modules', '@surrealdb', 'node'),
	join(appResourcesPath, 'node_modules', '@surrealdb', 'node')
);

copyRuntimePackage(
	join(projectRoot, '..', '..', 'packages', 'domain', 'node_modules', 'surrealdb'),
	join(appResourcesPath, 'node_modules', 'surrealdb')
);

copyRuntimePackage(
	join(projectRoot, 'node_modules', '@surrealdb', 'node-darwin-arm64'),
	join(appResourcesPath, 'node_modules', '@surrealdb', 'node-darwin-arm64')
);

console.log(`Synced Surreal runtime packages into ${appResourcesPath}`);
