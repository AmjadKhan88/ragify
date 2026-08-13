import type { VectorSearchResult } from './vectorstore.js';

export interface Reranker {
  rerank(query: string, results: VectorSearchResult[], topK: number): Promise<VectorSearchResult[]>;
}