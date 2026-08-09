import type { Chunk, Embedder, Retriever, VectorStore, VectorSearchResult } from '../types/index.js';
import { BM25Retriever } from './bm25.js';

export interface HybridRetrieverOptions {
  rrfK?: number;
}

export class HybridRetriever implements Retriever {
  private bm25: BM25Retriever;
  private readonly rrfK: number;

  constructor(
    private vectorStore: VectorStore,
    private embedder: Embedder,
    options: HybridRetrieverOptions = {}
  ) {
    this.bm25 = new BM25Retriever();
    this.rrfK = options.rrfK ?? 60;
  }

  index(chunks: Chunk[]): void {
    this.bm25.index(chunks);
  }

  async retrieve(query: string, topK: number): Promise<VectorSearchResult[]> {
    const fetchK = topK * 2;

    const [embedding] = await this.embedder.embed([query]);
    const denseResults = await this.vectorStore.query(embedding, fetchK);
    const sparseResults = this.bm25.retrieve(query, fetchK);

    const fused = new Map<string, { chunk: Chunk; score: number }>();

    denseResults.forEach((result, rank) => {
      const rrfScore = 1 / (this.rrfK + rank + 1);
      const existing = fused.get(result.chunk.id);
      fused.set(result.chunk.id, {
        chunk: result.chunk,
        score: (existing?.score ?? 0) + rrfScore,
      });
    });

    sparseResults.forEach((result, rank) => {
      const rrfScore = 1 / (this.rrfK + rank + 1);
      const existing = fused.get(result.chunk.id);
      fused.set(result.chunk.id, {
        chunk: result.chunk,
        score: (existing?.score ?? 0) + rrfScore,
      });
    });

    return Array.from(fused.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}