import { readFile, stat, access, constants } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AttachmentRef } from '../../shared/chat/index.js';
import type {
  IAttachmentContentResolver,
  ResolvedContentPart,
} from '../../application/chat/attachment-resolution.js';

export class LocalFileAttachmentResolver implements IAttachmentContentResolver {
  async resolve(attachment: AttachmentRef): Promise<ResolvedContentPart | null> {
    const inlineBytes = this.decodeInlineData(attachment.inlineDataBase64);
    if (inlineBytes) {
      return this.resolveFromBytes(attachment, inlineBytes);
    }

    const resolvedPath = this.resolveReadablePath(attachment.path);
    if (!resolvedPath) return null;

    const available = await this.checkAvailability({ ...attachment, path: resolvedPath });
    if (!available) return null;

    switch (attachment.type) {
      case 'text':
        return this.resolveText(resolvedPath);
      case 'image':
        return this.resolveImage(resolvedPath, attachment.mimeType);
      case 'pdf':
        return this.resolveFile(resolvedPath, attachment.mimeType);
      case 'video':
        return this.resolveFile(resolvedPath, attachment.mimeType);
      case 'unsupported':
        return null;
    }
  }

  async checkAvailability(attachment: AttachmentRef): Promise<boolean> {
    if (attachment.inlineDataBase64?.trim()) {
      return true;
    }

    const resolvedPath = this.resolveReadablePath(attachment.path);
    if (!resolvedPath) {
      return false;
    }

    try {
      await access(resolvedPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  private resolveFromBytes(
    attachment: AttachmentRef,
    bytes: Uint8Array,
  ): ResolvedContentPart | null {
    switch (attachment.type) {
      case 'text':
        return { type: 'text', text: new TextDecoder().decode(bytes) };
      case 'image':
        return { type: 'image', data: bytes, mimeType: attachment.mimeType };
      case 'pdf':
      case 'video':
        return { type: 'file', data: bytes, mimeType: attachment.mimeType };
      case 'unsupported':
        return null;
    }
  }

  private decodeInlineData(inlineDataBase64?: string): Uint8Array | null {
    if (!inlineDataBase64?.trim()) {
      return null;
    }

    return new Uint8Array(Buffer.from(inlineDataBase64, 'base64'));
  }

  private resolveReadablePath(path?: string): string | null {
    if (!path?.trim()) {
      return null;
    }

    const trimmed = path.trim();
    if (trimmed.startsWith('file://')) {
      return fileURLToPath(trimmed);
    }

    if (isAbsolute(trimmed) || trimmed.includes('/') || trimmed.includes('\\')) {
      return trimmed;
    }

    // Reject basename-only paths like "image.png" so uploads are not
    // accidentally resolved against the server working directory.
    return null;
  }

  private async resolveText(path: string): Promise<ResolvedContentPart> {
    const content = await readFile(path, 'utf-8');
    return { type: 'text', text: content };
  }

  private async resolveImage(path: string, mimeType: string): Promise<ResolvedContentPart> {
    const data = await readFile(path);
    return { type: 'image', data: new Uint8Array(data), mimeType };
  }

  private async resolveFile(path: string, mimeType: string): Promise<ResolvedContentPart> {
    const data = await readFile(path);
    return { type: 'file', data: new Uint8Array(data), mimeType };
  }
}

export async function extractFileMetadata(
  path: string,
): Promise<{ size: number; lastModified: string } | null> {
  try {
    const info = await stat(path);
    return {
      size: info.size,
      lastModified: info.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}
