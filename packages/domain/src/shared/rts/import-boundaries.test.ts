import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

describe('RTS import boundaries', () => {
  test('domain shared RTS code does not import UI, app, or persistence modules', () => {
    const files = collectTsFiles(fileURLToPath(new URL('.', import.meta.url)));
    const offenders = files.filter((file) => /from ['"](?:pixi\.js|@pixi\/|surrealdb|\$app\/)/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
