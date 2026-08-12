import { describe, it, expect, vi } from 'vitest';
import { ChromaVectorStore } from '../src/vectorstores/chroma.js';

const mockCollection = {
  upsert: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({
    ids: [['c1']],
    documents: [['test content']],
    metadatas: [[{ documentId: 'doc1' }]],
    distances: [[0.1]],
  }),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('chromadb', () => {
  return {
    ChromaClient: vi.fn().mockImplementation(function (this: any) {
      this.getOrCreateCollection = vi.fn().mockResolvedValue(mockCollection);
    }),
    CloudClient: vi.fn().mockImplementation(function (this: any) {
      this.getOrCreateCollection = vi.fn().mockResolvedValue(mockCollection);
    }),
  };
});

describe('ChromaVectorStore', () => {
  it('upserts chunks with embeddings', async () => {
    const store = new ChromaVectorStore({ path: 'http://localhost:8000' });
    await store.upsert([
      { id: 'c1', content: 'test content', documentId: 'doc1', embedding: [0.1, 0.2] },
    ]);
    expect(mockCollection.upsert).toHaveBeenCalled();
  });

  it('throws when upserting a chunk without an embedding', async () => {
    const store = new ChromaVectorStore({ path: 'http://localhost:8000' });
    await expect(
      store.upsert([{ id: 'c1', content: 'no embedding', documentId: 'doc1' }])
    ).rejects.toThrow(/no embedding/);
  });

  it('queries and converts distance to similarity score', async () => {
    const store = new ChromaVectorStore({ path: 'http://localhost:8000' });
    const results = await store.query([0.1, 0.2], 5);
    expect(results).toHaveLength(1);
    expect(results[0].chunk.content).toBe('test content');
    expect(results[0].score).toBeCloseTo(0.9); // 1 - 0.1 distance
  });
});