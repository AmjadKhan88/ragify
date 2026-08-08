import type { Chunk } from './document.js';

export interface VectorSearchResult {
  chunk: Chunk;
  score: number;
}

export interface VectorStore {
  upsert(chunks: Chunk[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
}