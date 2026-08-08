import type { Embedder } from '../types/index.js';

/**
 * Deterministic fake embedder for testing/dev — hashes text into a fixed-size vector.
 * Not for production use. Real providers (OpenAI, Cohere, etc.) come in Day 4.
 */
export class MockEmbedder implements Embedder {
  readonly dimensions = 8;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array(this.dimensions).fill(0);
      for (let i = 0; i < text.length; i++) {
        vec[i % this.dimensions] += text.charCodeAt(i);
      }
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    });
  }
}