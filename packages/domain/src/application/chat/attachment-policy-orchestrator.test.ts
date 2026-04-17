import { describe, expect, test } from 'bun:test';
import type { AttachmentRef, ModelInputPolicy } from '../../shared/chat/index.js';
import { DEFAULT_INPUT_POLICY, VIDEO_CAPABLE_INPUT_POLICY } from '../../shared/chat/index.js';
import type { IAttachmentContentResolver, ResolvedContentPart } from './attachment-resolution.js';
import { resolveAttachmentsForModel, hasRejections, getContentParts } from './attachment-policy-orchestrator.js';

function makeAttachment(overrides: Partial<AttachmentRef> = {}): AttachmentRef {
  return {
    id: 'att-1',
    messageId: 'msg-1',
    type: 'text',
    name: 'notes.txt',
    mimeType: 'text/plain',
    path: '/tmp/notes.txt',
    size: 100,
    lastModified: '2025-01-01T00:00:00Z',
    status: 'ready',
    ...overrides,
  };
}

function createFakeResolver(
  parts: Map<string, ResolvedContentPart | null> = new Map(),
  available = new Set<string>(),
): IAttachmentContentResolver {
  return {
    async resolve(attachment: AttachmentRef) {
      if (attachment.inlineDataBase64) {
        return parts.get(`inline:${attachment.name}`) ?? null;
      }
      return parts.get(attachment.path ?? '') ?? null;
    },
    async checkAvailability(attachment: AttachmentRef) {
      return Boolean(attachment.inlineDataBase64) || (
        attachment.path != null && available.has(attachment.path)
      );
    },
  };
}

describe('resolveAttachmentsForModel', () => {
  test('pass-through with available text file', async () => {
    const att = makeAttachment({ path: '/tmp/notes.txt' });
    const resolver = createFakeResolver(
      new Map([['/tmp/notes.txt', { type: 'text', text: 'hello' }]]),
      new Set(['/tmp/notes.txt']),
    );

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results).toHaveLength(1);
    expect(results[0].rejected).toBe(false);
    expect(results[0].policyOutcome).toBe('pass-through');
    expect(results[0].contentPart).toEqual({ type: 'text', text: 'hello' });
  });

  test('rejects video with default policy', async () => {
    const att = makeAttachment({
      type: 'video',
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      path: '/tmp/clip.mp4',
    });
    const resolver = createFakeResolver(
      new Map(),
      new Set(['/tmp/clip.mp4']),
    );

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results).toHaveLength(1);
    expect(results[0].rejected).toBe(true);
    expect(results[0].policyOutcome).toBe('reject');
  });

  test('passes video through with video-capable policy', async () => {
    const att = makeAttachment({
      type: 'video',
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      path: '/tmp/clip.mp4',
    });
    const data = new Uint8Array([1, 2, 3]);
    const resolver = createFakeResolver(
      new Map([['/tmp/clip.mp4', { type: 'file', data, mimeType: 'video/mp4' }]]),
      new Set(['/tmp/clip.mp4']),
    );

    const results = await resolveAttachmentsForModel([att], VIDEO_CAPABLE_INPUT_POLICY, resolver);
    expect(results).toHaveLength(1);
    expect(results[0].rejected).toBe(false);
    expect(results[0].contentPart).toBeDefined();
  });

  test('rejects unavailable files', async () => {
    const att = makeAttachment({ status: 'unavailable' });
    const resolver = createFakeResolver();

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(true);
    expect(results[0].rejectionReason).toContain('no longer available');
  });

  test('rejects unsupported classification', async () => {
    const att = makeAttachment({ type: 'unsupported', name: 'archive.zip', mimeType: 'application/zip' });
    const resolver = createFakeResolver();

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(true);
    expect(results[0].rejectionReason).toContain('not supported');
  });

  test('rejects when file not found on disk', async () => {
    const att = makeAttachment({ path: '/tmp/missing.txt' });
    const resolver = createFakeResolver(new Map(), new Set());

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(true);
    expect(results[0].rejectionReason).toContain('not found');
  });

  test('handles transform policy outcome', async () => {
    const policy: ModelInputPolicy = {
      ...DEFAULT_INPUT_POLICY,
      image: { outcome: 'transform', reason: 'Resize required' },
    };
    const att = makeAttachment({ type: 'image', name: 'big.png', mimeType: 'image/png', path: '/tmp/big.png' });
    const resolver = createFakeResolver(new Map(), new Set(['/tmp/big.png']));

    const results = await resolveAttachmentsForModel([att], policy, resolver);
    expect(results[0].rejected).toBe(false);
    expect(results[0].policyOutcome).toBe('transform');
    expect(results[0].policyReason).toBe('Resize required');
    expect(results[0].contentPart).toBeUndefined();
  });

  test('handles augment-with-tools policy outcome', async () => {
    const policy: ModelInputPolicy = {
      ...DEFAULT_INPUT_POLICY,
      pdf: { outcome: 'augment-with-tools', reason: 'Extract via tool' },
    };
    const att = makeAttachment({ type: 'pdf', name: 'doc.pdf', mimeType: 'application/pdf', path: '/tmp/doc.pdf' });
    const resolver = createFakeResolver(new Map(), new Set(['/tmp/doc.pdf']));

    const results = await resolveAttachmentsForModel([att], policy, resolver);
    expect(results[0].rejected).toBe(false);
    expect(results[0].policyOutcome).toBe('augment-with-tools');
  });

  test('passes through inline image data with no local path', async () => {
    const att = makeAttachment({
      type: 'image',
      name: 'screenshot.png',
      mimeType: 'image/png',
      path: undefined,
      inlineDataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
    });
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const resolver = createFakeResolver(
      new Map([['inline:screenshot.png', { type: 'image', data, mimeType: 'image/png' }]]),
      new Set(),
    );

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(false);
    expect(results[0].contentPart).toEqual({ type: 'image', data, mimeType: 'image/png' });
  });

  test('rejects when resolver.resolve throws', async () => {
    const att = makeAttachment({ path: '/tmp/notes.txt' });
    const resolver: IAttachmentContentResolver = {
      async resolve() { throw new Error('disk read failure'); },
      async checkAvailability() { return true; },
    };

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(true);
    expect(results[0].policyOutcome).toBe('pass-through');
    expect(results[0].rejectionReason).toBe('Failed to read file content.');
  });

  test('rejects when resolver.resolve returns null', async () => {
    const att = makeAttachment({ path: '/tmp/notes.txt' });
    const resolver: IAttachmentContentResolver = {
      async resolve() { return null; },
      async checkAvailability() { return true; },
    };

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(true);
    expect(results[0].policyOutcome).toBe('pass-through');
    expect(results[0].rejectionReason).toBe('Resolver returned no content.');
  });

  test('rejects basename-only paths explicitly when no inline data exists', async () => {
    const att = makeAttachment({
      type: 'image',
      name: 'screenshot.png',
      mimeType: 'image/png',
      path: 'screenshot.png',
    });
    const resolver = createFakeResolver();

    const results = await resolveAttachmentsForModel([att], DEFAULT_INPUT_POLICY, resolver);
    expect(results[0].rejected).toBe(true);
    expect(results[0].rejectionReason).toContain('not found or unreadable');
  });
});

describe('hasRejections', () => {
  test('returns true when any result is rejected', () => {
    expect(hasRejections([
      { attachment: makeAttachment(), classification: 'text', policyOutcome: 'pass-through', rejected: false },
      { attachment: makeAttachment(), classification: 'text', policyOutcome: 'reject', rejected: true, rejectionReason: 'test' },
    ])).toBe(true);
  });

  test('returns false when all pass', () => {
    expect(hasRejections([
      { attachment: makeAttachment(), classification: 'text', policyOutcome: 'pass-through', rejected: false },
    ])).toBe(false);
  });
});

describe('getContentParts', () => {
  test('extracts content parts from non-rejected results', () => {
    const part: ResolvedContentPart = { type: 'text', text: 'hello' };
    const parts = getContentParts([
      { attachment: makeAttachment(), classification: 'text', policyOutcome: 'pass-through', rejected: false, contentPart: part },
      { attachment: makeAttachment(), classification: 'video', policyOutcome: 'reject', rejected: true, rejectionReason: 'nope' },
    ]);
    expect(parts).toEqual([part]);
  });
});
