import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IMarketingAssetStorage } from '../../../application/marketing/ports.js';

interface LocalMarketingAssetStorageConfig {
  assetRoot: string;
  publicBaseUrl: string;
}

export class LocalMarketingAssetStorage implements IMarketingAssetStorage {
  constructor(private readonly config: LocalMarketingAssetStorageConfig) {}

  async saveImage(buffer: Buffer, filename: string): Promise<{ url: string; path: string }> {
    const dir = path.join(this.config.assetRoot, 'images');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return {
      path: filePath,
      url: `${this.config.publicBaseUrl}/images/${filename}`,
    };
  }

  async saveAudio(buffer: Buffer, filename: string): Promise<{ url: string; path: string }> {
    const dir = path.join(this.config.assetRoot, 'audio');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return {
      path: filePath,
      url: `${this.config.publicBaseUrl}/audio/${filename}`,
    };
  }

  async listImages(prefix?: string): Promise<{ url: string; path: string }[]> {
    const dir = path.join(this.config.assetRoot, 'images');
    try {
      const files = await fs.readdir(dir);
      const filtered = prefix ? files.filter(f => f.startsWith(prefix)) : files;
      return filtered.map(filename => ({
        path: path.join(dir, filename),
        url: `${this.config.publicBaseUrl}/images/${filename}`,
      }));
    } catch {
      return [];
    }
  }

  async listAudio(prefix?: string): Promise<{ url: string; path: string }[]> {
    const dir = path.join(this.config.assetRoot, 'audio');
    try {
      const files = await fs.readdir(dir);
      const filtered = prefix ? files.filter(f => f.startsWith(prefix)) : files;
      return filtered.map(filename => ({
        path: path.join(dir, filename),
        url: `${this.config.publicBaseUrl}/audio/${filename}`,
      }));
    } catch {
      return [];
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }
}
