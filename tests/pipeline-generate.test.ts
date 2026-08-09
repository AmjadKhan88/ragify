import { describe, it, expect, vi } from 'vitest';
import { RagifyPipeline } from '../src/core/pipeline.js';
import { InMemoryVectorStore } from '../src/vectorstores/memory.js';
import { FixedSizeChunker } from '../src/chunkers/fixed-size.js';
import { MockEmbedder } from '../src/embedders/mock.js';

describe('RagifyPipeline.generate', () => {
  it('throws when no llm is configured', async () => {
    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder: new MockEmbedder(),
      vectorStore: new InMemoryVectorStore(),
    });

    await expect(pipeline.generate('question')).rejects.toThrow(/No LLM configured/);
  });

  it('calls the configured llm with retrieved context', async () => {
    const mockLLM = { generate: vi.fn().mockResolvedValue('answer') };
    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder: new MockEmbedder(),
      vectorStore: new InMemoryVectorStore(),
      llm: mockLLM,
    });

    await pipeline.addDocuments([{ id: 'doc1', content: 'test content' }]);
    const result = await pipeline.generate('what is this about?');

    expect(mockLLM.generate).toHaveBeenCalled();
    expect(result).toBe('answer');
  });
});