import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { EmbeddingCache } from '../index.js';

export interface FileCacheOptions {
  filePath?: string;
}

export class FileCache implements EmbeddingCache {
  private filePath: string;
  private cache: Map<string, number[]> | null = null;

  constructor(options: FileCacheOptions = {}) {
    this.filePath = options.filePath ?? '.ragify-cache.json';
  }

  private async load(): Promise<Map<string, number[]>> {
    if (this.cache) return this.cache;

    if (existsSync(this.filePath)) {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, number[]>;
      this.cache = new Map(Object.entries(parsed));
    } else {
      this.cache = new Map();
    }

    return this.cache;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await mkdir(dirname(this.filePath), { recursive: true }).catch(() => {});
    const obj = Object.fromEntries(this.cache);
    await writeFile(this.filePath, JSON.stringify(obj), 'utf-8');
  }

  async get(key: string): Promise<number[] | undefined> {
    const cache = await this.load();
    return cache.get(key);
  }

  async set(key: string, embedding: number[]): Promise<void> {
    const cache = await this.load();
    cache.set(key, embedding);
    await this.persist();
  }
}