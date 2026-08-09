import { describe, it, expect } from 'vitest';
import { BM25Retriever } from '../src/retrievers/bm25.js';

describe('BM25Retriever', () => {
  it('ranks exact keyword matches highest', () => {
    const bm25 = new BM25Retriever();
    bm25.index([
      { id: 'c1', documentId: 'd1', content: 'The quick brown fox jumps over the lazy dog' },
      { id: 'c2', documentId: 'd2', content: 'Bananas are a great source of potassium' },
    ]);

    const results = bm25.retrieve('fox jumps', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.id).toBe('c1');
  });

  it('returns empty array for no matches', () => {
    const bm25 = new BM25Retriever();
    bm25.index([{ id: 'c1', documentId: 'd1', content: 'apples and oranges' }]);
    const results = bm25.retrieve('xylophone quantum', 5);
    expect(results).toHaveLength(0);
  });
});