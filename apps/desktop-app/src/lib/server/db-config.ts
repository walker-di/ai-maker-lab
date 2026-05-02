import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let env: Record<string, string | undefined> = process.env as Record<string, string | undefined>;
try {
	const svelteEnv = await import('$env/dynamic/private');
	env = svelteEnv.env;
} catch {
	// Outside SvelteKit (e.g. bun:test) — use process.env
}

export interface AppDbConfig {
	host: string;
	namespace: string;
	database: string;
	username?: string;
	password?: string;
	token?: string;
}

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const EMBEDDED_PROTOCOLS = ['surrealkv://', 'rocksdb://'] as const;

function resolveHost(raw: string): string {
	const match = EMBEDDED_PROTOCOLS.find((p) => raw.startsWith(p));
	if (!match) return raw;

	const dbPath = raw.slice(match.length);
	const absolutePath = isAbsolute(dbPath) ? dbPath : resolve(APP_ROOT, dbPath);
	mkdirSync(dirname(absolutePath), { recursive: true });
	return `${match}${absolutePath}`;
}

export function getAppDbConfig(): AppDbConfig {
	return {
		host: resolveHost(env.SURREAL_HOST ?? 'mem://'),
		namespace: env.SURREAL_NS ?? env.DB_NAMESPACE ?? 'app',
		database: env.SURREAL_DB ?? env.DB_DATABASE ?? 'desktop',
		username: env.SURREAL_USER,
		password: env.SURREAL_PASS,
		token: env.SURREAL_TOKEN,
	};
}
