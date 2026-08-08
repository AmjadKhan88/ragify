import { describe, it, expect } from 'vitest';
import { RagifyPipeline } from '../src/core/pipeline.js';
import { InMemoryVectorStore } from '../src/vectorstores/memory.js';
import { FixedSizeChunker } from '../src/chunkers/fixed-size.js';
import { MockEmbedder } from '../src/embedders/mock.js';

describe('RagifyPipeline', () => {
  it('indexes documents and retrieves relevant chunks', async () => {
    const pipeline = new RagifyPipeline({
      chunker: new FixedSizeChunker(),
      embedder: new MockEmbedder(),
      vectorStore: new InMemoryVectorStore(),
    });

    await pipeline.addDocuments([
      { id: 'doc1', content: 'Node.js is a JavaScript runtime built on Chrome V8.' },
      { id: 'doc2', content: 'Bananas are a great source of potassium.' },
    ]);

    const results = await pipeline.query('Tell me about JavaScript runtimes');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.content).toContain('Node.js');
  });
});