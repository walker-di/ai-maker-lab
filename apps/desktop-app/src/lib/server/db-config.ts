export interface AppDbConfig {
	host: string;
	namespace: string;
	database: string;
	username?: string;
	password?: string;
	token?: string;
}

/**
 * Resolves DB connection config for SvelteKit server-side service factories.
 *
 * Precedence: explicit env vars → mem:// web default.
 * surrealkv:// is only used in the Electrobun desktop bootstrap (src/bun/bootstrap-services.ts).
 */
export function getAppDbConfig(): AppDbConfig {
	return {
		host: process.env.SURREAL_HOST ?? 'mem://',
		namespace: process.env.SURREAL_NS ?? process.env.DB_NAMESPACE ?? 'app',
		database: process.env.SURREAL_DB ?? process.env.DB_DATABASE ?? 'desktop',
		username: process.env.SURREAL_USER,
		password: process.env.SURREAL_PASS,
		token: process.env.SURREAL_TOKEN,
	};
}
