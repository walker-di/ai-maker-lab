import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACING_ROOTS = ['shared/racing', 'application/racing'];
const FORBIDDEN_PATTERN = /from ['"](three|jolt-physics|@pixi|svelte|@sveltejs)/;

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

describe('Racing domain import boundaries', () => {
  test('shared and application layers do not import browser libs', () => {
    const offenders: string[] = [];
    for (const sub of RACING_ROOTS) {
      const dir = fileURLToPath(new URL(`../../${sub}/`, import.meta.url));
      for (const file of collectTsFiles(dir)) {
        const content = readFileSync(file, 'utf8');
        if (FORBIDDEN_PATTERN.test(content)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
