import type { Chunk } from './document.js';
import type { VectorSearchResult } from './vectorstore.js';

export interface Retriever {
  index(chunks: Chunk[]): Promise<void> | void;
  retrieve(query: string, topK: number): Promise<VectorSearchResult[]>;
}