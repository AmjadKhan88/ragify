import type { VectorStore, VectorSearchResult, Chunk } from '../types/index.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class InMemoryVectorStore implements VectorStore {
  private store = new Map<string, Chunk>();

  async upsert(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      if (!chunk.embedding) {
        throw new Error(`Chunk ${chunk.id} has no embedding — embed before upserting.`);
      }
      this.store.set(chunk.id, chunk);
    }
  }

  async query(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];
    for (const chunk of this.store.values()) {
      if (!chunk.embedding) continue;
      const score = cosineSimilarity(embedding, chunk.embedding);
      results.push({ chunk, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.store.delete(id);
  }
}