import { describe, it, expect, vi } from 'vitest';
import { LLMReranker } from '../src/rerankers/llm-reranker.js';
import type { VectorSearchResult } from '../src/types/index.js';

function makeResult(id: string, content: string, score: number): VectorSearchResult {
  return { score, chunk: { id, content, documentId: 'doc1' } };
}

describe('LLMReranker', () => {
  it('reorders results based on LLM relevance scores', async () => {
    const mockLLM = {
      generate: vi
        .fn()
        .mockResolvedValueOnce('2') // low relevance
        .mockResolvedValueOnce('9'), // high relevance
    };

    const reranker = new LLMReranker(mockLLM);
    const results = [
      makeResult('c1', 'irrelevant content', 0.5),
      makeResult('c2', 'highly relevant content', 0.4),
    ];

    const reranked = await reranker.rerank('question', results, 2);

    expect(reranked[0].chunk.id).toBe('c2'); // higher LLM score wins despite lower original score
    expect(reranked[0].score).toBe(9);
  });

  it('respects topK by trimming results', async () => {
    const mockLLM = { generate: vi.fn().mockResolvedValue('5') };
    const reranker = new LLMReranker(mockLLM);
    const results = [
      makeResult('c1', 'a', 0.5),
      makeResult('c2', 'b', 0.5),
      makeResult('c3', 'c', 0.5),
    ];

    const reranked = await reranker.rerank('question', results, 2);
    expect(reranked).toHaveLength(2);
  });

  it('falls back to original score if the LLM response is unparseable', async () => {
    const mockLLM = { generate: vi.fn().mockResolvedValue('not a number') };
    const reranker = new LLMReranker(mockLLM);
    const results = [makeResult('c1', 'content', 0.77)];

    const reranked = await reranker.rerank('question', results, 1);
    expect(reranked[0].score).toBe(0.77);
  });

  it('returns an empty array for empty input', async () => {
    const mockLLM = { generate: vi.fn() };
    const reranker = new LLMReranker(mockLLM);
    const reranked = await reranker.rerank('question', [], 5);
    expect(reranked).toHaveLength(0);
    expect(mockLLM.generate).not.toHaveBeenCalled();
  });
});