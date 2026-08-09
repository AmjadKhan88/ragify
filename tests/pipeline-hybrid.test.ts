import { describe, it, expect } from 'vitest';
import { RagifyPipeline } from '../src/core/pipeline.js';
import { InMemoryVectorStore } from '../src/vectorstores/memory.js';
import { FixedSizeChunker } from '../src/chunkers/fixed-size.js';
import { MockEmbedder } from '../src/embedders/mock.js';
import { HybridRetriever } from '../src/retrievers/hybrid.js';

describe('RagifyPipeline with HybridRetriever', () => {
  it('uses hybrid retrieval when configured', async () => {
    const vectorStore = new InMemoryVectorStore();
    const embedder = new MockEmbedder();
    const retriever = new HybridRetriever(vectorStore, embedder);

    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder,
      vectorStore,
      retriever,
    });

    await pipeline.addDocuments([
      { id: 'doc1', content: 'Node.js is a JavaScript runtime built on V8' },
      { id: 'doc2', content: 'Bananas are rich in potassium' },
    ]);

    const results = await pipeline.query('JavaScript runtime');
    expect(results[0].chunk.content).toContain('Node.js');
  });
});