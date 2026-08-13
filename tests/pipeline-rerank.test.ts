import { describe, it, expect, vi } from 'vitest';
import { RagifyPipeline } from '../src/core/pipeline.js';
import { InMemoryVectorStore } from '../src/vectorstores/memory.js';
import { FixedSizeChunker } from '../src/chunkers/fixed-size.js';
import { MockEmbedder } from '../src/embedders/mock.js';

describe('RagifyPipeline with reranker', () => {
  it('over-fetches before reranking down to topK', async () => {
    const vectorStore = new InMemoryVectorStore();
    const embedder = new MockEmbedder();
    const mockReranker = {
      rerank: vi.fn().mockImplementation((_q, results, topK) => results.slice(0, topK)),
    };

    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder,
      vectorStore,
      reranker: mockReranker,
    });

    await pipeline.addDocuments([
      { id: 'd1', content: 'a'.repeat(50) },
      { id: 'd2', content: 'b'.repeat(50) },
    ]);

    await pipeline.query('test', 2);

    // reranker should have been called with more than 2 candidates (topK * 3)
    const calledWith = mockReranker.rerank.mock.calls[0][1];
    expect(calledWith.length).toBeGreaterThanOrEqual(2);
    expect(mockReranker.rerank).toHaveBeenCalledWith('test', expect.any(Array), 2);
  });
});