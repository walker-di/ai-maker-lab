import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalFileAttachmentResolver, extractFileMetadata } from './local-file-resolver.js';
import type { AttachmentRef } from '../../shared/chat/index.js';

const TEST_DIR = join(tmpdir(), `file-resolver-test-${Date.now()}`);

function makeAttachment(overrides: Partial<AttachmentRef> = {}): AttachmentRef {
  return {
    id: 'att-1',
    messageId: 'msg-1',
    type: 'text',
    name: 'test.txt',
    mimeType: 'text/plain',
    path: join(TEST_DIR, 'test.txt'),
    size: 0,
    lastModified: '',
    status: 'ready',
    ...overrides,
  };
}

describe('LocalFileAttachmentResolver', () => {
  let resolver: LocalFileAttachmentResolver;

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, 'hello.txt'), 'Hello world');
    await writeFile(join(TEST_DIR, 'data.json'), '{"key":"value"}');

    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await writeFile(join(TEST_DIR, 'pixel.png'), pngHeader);

    resolver = new LocalFileAttachmentResolver();
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test('checkAvailability returns true for existing file', async () => {
    expect(await resolver.checkAvailability(makeAttachment({ path: join(TEST_DIR, 'hello.txt') }))).toBe(true);
  });

  test('checkAvailability returns false for missing file', async () => {
    expect(await resolver.checkAvailability(makeAttachment({ path: join(TEST_DIR, 'nope.txt') }))).toBe(false);
  });

  test('resolves text file to text content part', async () => {
    const att = makeAttachment({ path: join(TEST_DIR, 'hello.txt') });
    const result = await resolver.resolve(att);
    expect(result).toEqual({ type: 'text', text: 'Hello world' });
  });

  test('resolves image file to image content part', async () => {
    const att = makeAttachment({
      type: 'image',
      name: 'pixel.png',
      mimeType: 'image/png',
      path: join(TEST_DIR, 'pixel.png'),
    });
    const result = await resolver.resolve(att);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('image');
    if (result!.type === 'image') {
      expect(result!.mimeType).toBe('image/png');
      expect(result!.data).toBeInstanceOf(Uint8Array);
    }
  });

  test('returns null for unsupported classification', async () => {
    const att = makeAttachment({ type: 'unsupported', path: join(TEST_DIR, 'hello.txt') });
    const result = await resolver.resolve(att);
    expect(result).toBeNull();
  });

  test('returns null for nonexistent file', async () => {
    const att = makeAttachment({ path: join(TEST_DIR, 'missing.txt') });
    const result = await resolver.resolve(att);
    expect(result).toBeNull();
  });

  test('resolves inline image data with no local path', async () => {
    const att = makeAttachment({
      type: 'image',
      name: 'inline.png',
      mimeType: 'image/png',
      path: undefined,
      inlineDataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
    });

    const result = await resolver.resolve(att);
    expect(result).not.toBeNull();
    expect(result).toEqual({
      type: 'image',
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mimeType: 'image/png',
    });
  });

  test('rejects basename-only paths to avoid cwd lookups', async () => {
    const att = makeAttachment({ path: 'pixel.png' });
    expect(await resolver.checkAvailability(att)).toBe(false);
    expect(await resolver.resolve(att)).toBeNull();
  });
});

describe('extractFileMetadata', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, 'meta.txt'), 'metadata test');
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test('returns size and lastModified for existing file', async () => {
    const meta = await extractFileMetadata(join(TEST_DIR, 'meta.txt'));
    expect(meta).not.toBeNull();
    expect(meta!.size).toBeGreaterThan(0);
    expect(meta!.lastModified).toBeString();
  });

  test('returns null for missing file', async () => {
    const meta = await extractFileMetadata(join(TEST_DIR, 'nope.txt'));
    expect(meta).toBeNull();
  });
});
