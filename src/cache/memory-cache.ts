import type { EmbeddingCache } from '../index.js';

export class InMemoryCache implements EmbeddingCache {
  private store = new Map<string, number[]>();

  get(key: string): number[] | undefined {
    return this.store.get(key);
  }

  set(key: string, embedding: number[]): void {
    this.store.set(key, embedding);
  }
}