import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...collectTsFiles(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

const ENGINE_DIR = fileURLToPath(new URL('.', import.meta.url));

// Workspace root: packages/ui/src/lib/racing/engine → ../../../../../../ = ai-maker-lab/
const WORKSPACE_ROOT = resolve(ENGINE_DIR, '../../../../../../');

function stripComments(src: string): string {
  // Remove single-line comments
  let out = src.replace(/\/\/[^\n]*/g, '');
  // Remove block comments
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  return out;
}

describe('Racing engine import boundaries', () => {
  test('engine does not import persistence or application layers', () => {
    const files = collectTsFiles(ENGINE_DIR);
    const offenders = files.filter((file) => {
      const content = readFileSync(file, 'utf8');
      return /from ['"].*(surrealdb|domain\/infrastructure|domain\/application)/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  test('compliance feature preserves boundaries — no surrealdb or domain/infrastructure in engine', () => {
    const files = collectTsFiles(ENGINE_DIR);
    const offenders = files.filter((file) => {
      const content = readFileSync(file, 'utf8');
      return /from ['"].*surrealdb/.test(content) || /from ['"].*domain\/infrastructure/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  // M2: verify no device/browser API leaks into engine or domain packages.
  // Gamepad, navigator, sessionStorage, localStorage, HID, window, document
  // must all live exclusively in apps/desktop-app.
  test('engine source files do not reference browser/device APIs in executable code', () => {
    const DEVICE_API_RE = /\b(navigator\.getGamepads|sessionStorage|WebHID|HIDDevice)\b/;
    const files = collectTsFiles(ENGINE_DIR).filter(
      // exclude test files — tests may mock globals
      (f) => !f.endsWith('.test.ts'),
    );
    const offenders = files.filter((file) => {
      const content = stripComments(readFileSync(file, 'utf8'));
      return DEVICE_API_RE.test(content);
    });
    expect(offenders).toEqual([]);
  });

  test('ffb-output adapter lives only in apps/desktop-app, not in packages/ui engine', () => {
    const files = collectTsFiles(ENGINE_DIR).filter((f) => !f.endsWith('.test.ts'));
    const offenders = files.filter((file) => {
      const content = readFileSync(file, 'utf8');
      return /ffb-output/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  test('ffb-output.ts exists in apps/desktop-app and contains device API calls', () => {
    const adapterPath = join(WORKSPACE_ROOT, 'apps/desktop-app/src/lib/racing/ffb-output.ts');
    const content = readFileSync(adapterPath, 'utf8');
    expect(content).toMatch(/navigator\.getGamepads/);
    expect(content).toMatch(/sessionStorage/);
    expect(content).toMatch(/attachFfbOutputAdapter/);
  });
});
