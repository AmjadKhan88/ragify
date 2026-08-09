import type { Chunk, VectorSearchResult } from '../types/index.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

interface IndexedDoc {
  chunk: Chunk;
  termFreq: Map<string, number>;
  length: number;
}

export interface BM25Options {
  k1?: number;
  b?: number;
}

export class BM25Retriever {
  private docs: IndexedDoc[] = [];
  private docFreq = new Map<string, number>();
  private avgDocLength = 0;
  private readonly k1: number;
  private readonly b: number;

  constructor(options: BM25Options = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
  }

  index(chunks: Chunk[]): void {
    for (const chunk of chunks) {
      const tokens = tokenize(chunk.content);
      const termFreq = new Map<string, number>();
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      }
      this.docs.push({ chunk, termFreq, length: tokens.length });

      for (const term of termFreq.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }

    const totalLength = this.docs.reduce((sum, d) => sum + d.length, 0);
    this.avgDocLength = this.docs.length > 0 ? totalLength / this.docs.length : 0;
  }

  retrieve(query: string, topK: number): VectorSearchResult[] {
    const queryTerms = tokenize(query);
    const N = this.docs.length;
    if (N === 0) return [];

    const scored = this.docs.map((doc) => {
      let score = 0;
      for (const term of queryTerms) {
        const df = this.docFreq.get(term) ?? 0;
        if (df === 0) continue;

        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        const tf = doc.termFreq.get(term) ?? 0;
        const denom = tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgDocLength));
        score += idf * ((tf * (this.k1 + 1)) / (denom || 1));
      }
      return { chunk: doc.chunk, score };
    });

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}