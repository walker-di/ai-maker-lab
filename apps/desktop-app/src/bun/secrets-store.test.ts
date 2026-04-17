import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecretsStore, snapshotShellEnvKeys } from './secrets-store';

describe('SecretsStore', () => {
	let dir: string;
	let secretsPath: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'aml-secrets-'));
		secretsPath = join(dir, 'secrets.env');
		delete process.env.OPENAI_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		delete process.env.GEMINI_API_KEY;
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		delete process.env.OPENAI_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		delete process.env.GEMINI_API_KEY;
	});

	it('ensureTemplate creates a 0600 file once and is idempotent', () => {
		const store = new SecretsStore({ secretsPath });
		expect(store.ensureTemplate()).toBe(true);
		expect(store.ensureTemplate()).toBe(false);
		const stats = statSync(secretsPath);
		expect(stats.mode & 0o777).toBe(0o600);
	});

	it('read parses KEY=value, ignores comments, strips quotes', () => {
		writeFileSync(
			secretsPath,
			['# comment', '', 'OPENAI_API_KEY=sk-abc', 'ANTHROPIC_API_KEY="sk-ant-with space"'].join('\n'),
			'utf8',
		);
		const store = new SecretsStore({ secretsPath });
		expect(store.read()).toEqual({
			OPENAI_API_KEY: 'sk-abc',
			ANTHROPIC_API_KEY: 'sk-ant-with space',
		});
	});

	it('update writes a 0600 file, mirrors process.env, and preserves untouched keys', () => {
		writeFileSync(secretsPath, 'OPENAI_API_KEY=sk-old\nGEMINI_API_KEY=goog-old\n', 'utf8');
		const store = new SecretsStore({ secretsPath, shellSnapshot: new Set() });

		store.update({ OPENAI_API_KEY: 'sk-new', ANTHROPIC_API_KEY: 'sk-ant-new' });

		expect(process.env.OPENAI_API_KEY).toBe('sk-new');
		expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-new');
		const text = readFileSync(secretsPath, 'utf8');
		expect(text).toMatch(/OPENAI_API_KEY=sk-new/);
		expect(text).toMatch(/ANTHROPIC_API_KEY=sk-ant-new/);
		expect(text).toMatch(/GEMINI_API_KEY=goog-old/);
		expect(statSync(secretsPath).mode & 0o777).toBe(0o600);
	});

	it('update with empty string deletes the key from file and process.env', () => {
		writeFileSync(secretsPath, 'OPENAI_API_KEY=sk-x\n', 'utf8');
		process.env.OPENAI_API_KEY = 'sk-x';
		const store = new SecretsStore({ secretsPath, shellSnapshot: new Set() });

		store.update({ OPENAI_API_KEY: '' });

		expect(process.env.OPENAI_API_KEY).toBeUndefined();
		expect(store.read().OPENAI_API_KEY).toBeUndefined();
	});

	it('update never clears process.env for keys exported by the shell', () => {
		process.env.OPENAI_API_KEY = 'sk-shell';
		const shellSnapshot = snapshotShellEnvKeys(['OPENAI_API_KEY']);
		const store = new SecretsStore({ secretsPath, shellSnapshot });

		store.update({ OPENAI_API_KEY: '' });

		expect(process.env.OPENAI_API_KEY).toBe('sk-shell');
		expect(store.read().OPENAI_API_KEY).toBeUndefined();
	});

	it('getStatus reports shell vs file vs unset and previews ≥8-char values', () => {
		writeFileSync(secretsPath, 'ANTHROPIC_API_KEY=sk-ant-1234567890\n', 'utf8');
		process.env.OPENAI_API_KEY = 'sk-shellvalue1234';
		process.env.ANTHROPIC_API_KEY = 'sk-ant-1234567890';
		const shellSnapshot = snapshotShellEnvKeys(['OPENAI_API_KEY']);
		const store = new SecretsStore({ secretsPath, shellSnapshot });

		const statuses = store.getStatus(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY']);
		const openai = statuses.find((s) => s.key === 'OPENAI_API_KEY');
		const anthropic = statuses.find((s) => s.key === 'ANTHROPIC_API_KEY');
		const gemini = statuses.find((s) => s.key === 'GEMINI_API_KEY');

		expect(openai).toMatchObject({ isSet: true, source: 'shell' });
		expect(openai?.preview).toBe('sk-...1234');
		expect(anthropic).toMatchObject({ isSet: true, source: 'file' });
		expect(anthropic?.preview).toBe('sk-...7890');
		expect(gemini).toMatchObject({ isSet: false, source: 'unset', preview: null });
	});
});
