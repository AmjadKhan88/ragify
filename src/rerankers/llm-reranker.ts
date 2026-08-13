import type { LLMWrapper, Reranker, VectorSearchResult } from '../types/index.js';

export interface LLMRerankerOptions {
  concurrency?: number;
}

export class LLMReranker implements Reranker {
  private concurrency: number;

  constructor(private llm: LLMWrapper, options: LLMRerankerOptions = {}) {
    this.concurrency = options.concurrency ?? 5;
  }

  async rerank(
    query: string,
    results: VectorSearchResult[],
    topK: number
  ): Promise<VectorSearchResult[]> {
    if (results.length === 0) return [];

    const scores = await this.scoreInBatches(query, results);

    return results
      .map((result, i) => ({ ...result, score: scores[i] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async scoreInBatches(query: string, results: VectorSearchResult[]): Promise<number[]> {
    const scores: number[] = new Array(results.length);

    for (let i = 0; i < results.length; i += this.concurrency) {
      const batch = results.slice(i, i + this.concurrency);
      const batchScores = await Promise.all(batch.map((r) => this.scoreOne(query, r)));
      batchScores.forEach((score, j) => {
        scores[i + j] = score;
      });
    }

    return scores;
  }

  private async scoreOne(query: string, result: VectorSearchResult): Promise<number> {
    const prompt = `Rate how relevant the following passage is to the question, on a scale of 0-10. Respond with ONLY the number, nothing else.

Question: ${query}

Passage: ${result.chunk.content}

Relevance score (0-10):`;

    try {
      const response = await this.llm.generate(prompt);
      const score = parseFloat(response.trim());
      return Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : result.score;
    } catch {
      // If scoring fails for one item, fall back to its original retrieval score
      // rather than failing the whole rerank — one bad LLM response shouldn't
      // break the entire query.
      return result.score;
    }
  }
}