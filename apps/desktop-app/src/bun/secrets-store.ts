import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

export const SECRETS_FILENAME = 'secrets.env';

const DEFAULT_TEMPLATE = `# AI Maker Lab — runtime secrets (per channel)
#
# This file is read once at app startup. Restart the app after editing.
# Lines starting with '#' are ignored. Values may be optionally quoted.
#
# Existing process.env values take precedence over entries in this file,
# so during \`bun run dev:app\` your shell-exported keys still win.
#
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
`;

/**
 * Where a key's currently-effective value comes from.
 *
 * - `shell`  — present in `process.env` BEFORE we parsed `secrets.env`. The
 *   shell-exported value takes precedence; any value in `secrets.env` is
 *   shadowed and inert until removed from the shell.
 * - `file`   — only the secrets file supplied this value (the shell did not).
 * - `unset`  — neither source provided a value.
 */
export type SecretSource = 'shell' | 'file' | 'unset';

export interface SecretStatus {
	key: string;
	isSet: boolean;
	source: SecretSource;
	preview: string | null;
}

export interface SecretsStoreOptions {
	/** Absolute path to the secrets file (callers resolve via `Utils.paths.userData`). */
	secretsPath: string;
	/** Snapshot of `process.env` keys that were set BEFORE any file load. */
	shellSnapshot?: ReadonlySet<string>;
}

/**
 * Reads, writes, and reports on a per-channel `secrets.env` file living in the
 * app's user-data directory. Designed to be the single source of truth for the
 * Settings UI: callers must never read or persist secret values through any
 * other path.
 *
 * The store assumes `loadRuntimeEnv()` has already mirrored file values into
 * `process.env`; callers consult `process.env` for the effective value when
 * acting on it (e.g. when building the provider registry).
 */
export class SecretsStore {
	readonly secretsPath: string;
	private readonly shellSnapshot: ReadonlySet<string>;

	constructor(options: SecretsStoreOptions) {
		this.secretsPath = options.secretsPath;
		this.shellSnapshot = options.shellSnapshot ?? new Set();
	}

	/** Parsed file contents (empty object if the file is missing). */
	read(): Record<string, string> {
		if (!existsSync(this.secretsPath)) return {};
		try {
			return parseDotEnv(readFileSync(this.secretsPath, 'utf8'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[secrets] failed to read ${this.secretsPath}: ${message}`);
			return {};
		}
	}

	/**
	 * Build a status row per requested key. Effective value comes from
	 * `process.env` (shell wins, then file via the runtime-env loader, then
	 * undefined).
	 */
	getStatus(keys: readonly string[]): SecretStatus[] {
		const fileValues = this.read();
		return keys.map((key) => {
			const fromShell = this.shellSnapshot.has(key);
			const fromFile = Object.prototype.hasOwnProperty.call(fileValues, key) && fileValues[key] !== '';
			const effective = process.env[key];
			const isSet = effective !== undefined && effective !== '';
			const source: SecretSource = fromShell
				? 'shell'
				: fromFile && isSet
					? 'file'
					: isSet
						? 'shell'
						: 'unset';
			const preview = isSet ? maskValue(effective ?? '') : null;
			return { key, isSet, source, preview };
		});
	}

	/**
	 * Persist a partial set of `key -> value` pairs into the secrets file and
	 * mirror them into `process.env`. An empty-string value removes the key
	 * from both file and (only if not shadowed by the shell) `process.env`.
	 *
	 * Existing keys in the file that are not mentioned are preserved.
	 */
	update(partial: Record<string, string>): void {
		const existing = this.read();
		for (const [key, value] of Object.entries(partial)) {
			if (value === '') {
				delete existing[key];
				if (!this.shellSnapshot.has(key)) {
					delete process.env[key];
				}
			} else {
				existing[key] = value;
				if (!this.shellSnapshot.has(key)) {
					process.env[key] = value;
				}
			}
		}
		this.writeFile(existing);
	}

	/**
	 * Idempotently create the secrets file with a commented template. Returns
	 * `true` when the file was created, `false` when it already existed.
	 */
	ensureTemplate(): boolean {
		if (existsSync(this.secretsPath)) return false;
		try {
			mkdirSync(dirname(this.secretsPath), { recursive: true });
			writeFileSync(this.secretsPath, DEFAULT_TEMPLATE, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
			try {
				chmodSync(this.secretsPath, 0o600);
			} catch {
				// best-effort tightening; ignore on filesystems that don't support chmod
			}
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[secrets] could not create template at ${this.secretsPath}: ${message}`);
			return false;
		}
	}

	private writeFile(values: Record<string, string>): void {
		mkdirSync(dirname(this.secretsPath), { recursive: true });
		const body = serializeDotEnv(values);
		writeFileSync(this.secretsPath, body, { encoding: 'utf8', mode: 0o600 });
		try {
			chmodSync(this.secretsPath, 0o600);
		} catch {
			// see ensureTemplate
		}
	}
}

/**
 * Snapshot the keys that are present in `process.env` *right now*. Must be
 * called before any code path mirrors file values into `process.env`, otherwise
 * we cannot tell shell-set keys apart from file-set keys later.
 */
export function snapshotShellEnvKeys(keys: readonly string[]): Set<string> {
	const present = new Set<string>();
	for (const key of keys) {
		const value = process.env[key];
		if (value !== undefined && value !== '') {
			present.add(key);
		}
	}
	return present;
}

function maskValue(value: string): string {
	if (value.length < 8) return '***';
	return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

function parseDotEnv(text: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith('#')) continue;
		const eqIndex = line.indexOf('=');
		if (eqIndex === -1) continue;
		const key = line.slice(0, eqIndex).trim();
		if (key.length === 0) continue;
		let value = line.slice(eqIndex + 1).trim();
		if (!value.startsWith('"') && !value.startsWith("'")) {
			const commentIndex = value.indexOf(' #');
			if (commentIndex !== -1) value = value.slice(0, commentIndex).trim();
		}
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

function serializeDotEnv(values: Record<string, string>): string {
	const lines = ['# Managed by AI Maker Lab Settings — values you edit here are reloaded on next launch.', ''];
	for (const [key, value] of Object.entries(values)) {
		if (value === '') continue;
		lines.push(`${key}=${escapeValue(value)}`);
	}
	return `${lines.join('\n')}\n`;
}

function escapeValue(value: string): string {
	if (/[\s#'"]/.test(value) || value.includes('\\')) {
		const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return `"${escaped}"`;
	}
	return value;
}
