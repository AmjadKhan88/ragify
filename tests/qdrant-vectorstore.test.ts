import { describe, it, expect, vi } from 'vitest';
import { QdrantVectorStore } from '../src/vectorstores/qdrant.js';

const mockClient = {
  collectionExists: vi.fn().mockResolvedValue({ exists: true }),
  createCollection: vi.fn().mockResolvedValue(undefined),
  upsert: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({
    points: [
      { id: 'some-uuid', score: 0.92, payload: { chunkId: 'c1', content: 'test content', documentId: 'doc1' } },
    ],
  }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@qdrant/js-client-rest', () => {
  return {
    QdrantClient: vi.fn().mockImplementation(function (this: any) {
      Object.assign(this, mockClient);
    }),
  };
});

describe('QdrantVectorStore', () => {
  it('throws without a URL', () => {
    const original = process.env.QDRANT_URL;
    delete process.env.QDRANT_URL;
    expect(() => new QdrantVectorStore()).toThrow(/URL missing/);
    process.env.QDRANT_URL = original;
  });

  it('upserts chunks with a deterministic UUID derived from the chunk id', async () => {
    const store = new QdrantVectorStore({ url: 'http://localhost:6333' });
    await store.upsert([
      { id: 'c1', content: 'test content', documentId: 'doc1', embedding: [0.1, 0.2] },
    ]);
    const callArgs = mockClient.upsert.mock.calls[0][1];
    expect(callArgs.points[0].id).toMatch(/^[0-9a-f-]{36}$/); // valid UUID shape
    expect(callArgs.points[0].payload.chunkId).toBe('c1'); // original id preserved
  });

  it('throws when upserting a chunk without an embedding', async () => {
    const store = new QdrantVectorStore({ url: 'http://localhost:6333' });
    await expect(
      store.upsert([{ id: 'c1', content: 'no embedding', documentId: 'doc1' }])
    ).rejects.toThrow(/no embedding/);
  });

  it('queries using the current query() API and maps results', async () => {
    const store = new QdrantVectorStore({ url: 'http://localhost:6333' });
    const results = await store.query([0.1, 0.2], 5);
    expect(results).toHaveLength(1);
    expect(results[0].chunk.content).toBe('test content');
    expect(results[0].score).toBe(0.92);
    expect(mockClient.query).toHaveBeenCalled();
  });
});