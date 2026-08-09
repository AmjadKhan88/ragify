import { describe, it, expect } from 'vitest';
import { HybridRetriever } from '../src/retrievers/hybrid.js';
import { InMemoryVectorStore } from '../src/vectorstores/memory.js';
import { MockEmbedder } from '../src/embedders/mock.js';

describe('HybridRetriever', () => {
  it('fuses dense and sparse results', async () => {
    const vectorStore = new InMemoryVectorStore();
    const embedder = new MockEmbedder();
    const hybrid = new HybridRetriever(vectorStore, embedder);

    const chunks = [
      { id: 'c1', documentId: 'd1', content: 'Node.js is a JavaScript runtime' },
      { id: 'c2', documentId: 'd2', content: 'Bananas contain potassium' },
    ];
    const embeddings = await embedder.embed(chunks.map((c) => c.content));
    const embeddedChunks = chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));

    await vectorStore.upsert(embeddedChunks);
    hybrid.index(embeddedChunks);

    const results = await hybrid.retrieve('JavaScript runtime', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.id).toBe('c1');
  });
});