// retriever.ts
import type { VectorSearchResult } from './vectorstore.js';

export interface Retriever {
  retrieve(query: string, topK: number): Promise<VectorSearchResult[]>;
}