import { describe, it, expect, vi } from 'vitest';
import { RagifyPipeline } from '../src/core/pipeline.js';
import { InMemoryVectorStore } from '../src/vectorstores/memory.js';
import { FixedSizeChunker } from '../src/chunkers/fixed-size.js';
import { InMemoryCache } from '../src/cache/memory-cache.js';
import { MockEmbedder } from '../src/embedders/mock.js';

describe('RagifyPipeline with caching', () => {
  it('does not re-embed unchanged content on a second addDocuments call', async () => {
    const embedder = new MockEmbedder();
    const embedSpy = vi.spyOn(embedder, 'embed');
    const cache = new InMemoryCache();

    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder,
      vectorStore: new InMemoryVectorStore(),
      cache,
    });

    const doc = { id: 'doc1', content: 'Some stable content that will not change.' };

    await pipeline.addDocuments([doc]);
    expect(embedSpy).toHaveBeenCalledTimes(1);

    await pipeline.addDocuments([doc]);
    // Second call should hit the cache — embed() should NOT be called again.
    expect(embedSpy).toHaveBeenCalledTimes(1);
  });

  it('re-embeds only changed content', async () => {
    const embedder = new MockEmbedder();
    const embedSpy = vi.spyOn(embedder, 'embed');
    const cache = new InMemoryCache();

    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder,
      vectorStore: new InMemoryVectorStore(),
      cache,
    });

    await pipeline.addDocuments([{ id: 'doc1', content: 'Original content.' }]);
    expect(embedSpy).toHaveBeenCalledTimes(1);

    await pipeline.addDocuments([{ id: 'doc1', content: 'Changed content now.' }]);
    expect(embedSpy).toHaveBeenCalledTimes(2);
  });
});