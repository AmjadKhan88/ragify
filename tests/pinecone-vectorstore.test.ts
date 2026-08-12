import { describe, it, expect, vi } from 'vitest';
import { PineconeVectorStore } from '../src/vectorstores/pinecone.js';

const mockIndex = {
  upsert: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({
    matches: [
      { id: 'c1', score: 0.95, metadata: { content: 'test content', documentId: 'doc1' } },
    ],
  }),
  deleteMany: vi.fn().mockResolvedValue(undefined),
  namespace: vi.fn(),
};
mockIndex.namespace.mockReturnValue(mockIndex);

vi.mock('@pinecone-database/pinecone', () => {
  return {
    Pinecone: vi.fn().mockImplementation(function (this: any) {
      this.index = vi.fn().mockReturnValue(mockIndex);
      this.describeIndex = vi.fn().mockResolvedValue({ host: 'fake-host.pinecone.io' });
    }),
  };
});

describe('PineconeVectorStore', () => {
  it('throws without an API key', () => {
    const original = process.env.PINECONE_API_KEY;
    delete process.env.PINECONE_API_KEY;
    expect(() => new PineconeVectorStore({ indexName: 'test' })).toThrow(/API key missing/);
    process.env.PINECONE_API_KEY = original;
  });

  it('throws without an index name', () => {
    const original = process.env.PINECONE_INDEX_NAME;
    delete process.env.PINECONE_INDEX_NAME;
    expect(() => new PineconeVectorStore({ apiKey: 'test-key' })).toThrow(/index name missing/);
    process.env.PINECONE_INDEX_NAME = original;
  });

  it('upserts chunks with embeddings', async () => {
    const store = new PineconeVectorStore({ apiKey: 'test-key', indexName: 'test-index' });
    await store.upsert([
      { id: 'c1', content: 'test content', documentId: 'doc1', embedding: [0.1, 0.2] },
    ]);
    expect(mockIndex.upsert).toHaveBeenCalled();
  });

  it('throws when upserting a chunk without an embedding', async () => {
    const store = new PineconeVectorStore({ apiKey: 'test-key', indexName: 'test-index' });
    await expect(
      store.upsert([{ id: 'c1', content: 'no embedding', documentId: 'doc1' }])
    ).rejects.toThrow(/no embedding/);
  });

  it('queries and maps results back to VectorSearchResult', async () => {
    const store = new PineconeVectorStore({ apiKey: 'test-key', indexName: 'test-index' });
    const results = await store.query([0.1, 0.2], 5);
    expect(results).toHaveLength(1);
    expect(results[0].chunk.content).toBe('test content');
    expect(results[0].score).toBe(0.95);
  });
});