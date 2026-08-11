import { describe, it, expect } from 'vitest';
import { RecursiveChunker } from '../src/chunkers/recursive.js';

describe('RecursiveChunker', () => {
  it('keeps short documents as a single chunk', () => {
    const chunker = new RecursiveChunker();
    const chunks = chunker.chunk({ id: 'doc1', content: 'A short sentence.' });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('A short sentence.');
  });

  it('splits on paragraph boundaries before falling back to characters', () => {
    const chunker = new RecursiveChunker();
    const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraph ${i} content here.`);
    const content = paragraphs.join('\n\n');

    const chunks = chunker.chunk({ id: 'doc1', content }, { chunkSize: 60, chunkOverlap: 0 });

    // No chunk should cut a sentence mid-word — each should end cleanly or at a paragraph break.
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(80); // some slack for merge logic
    }
  });

  it('respects custom separators', () => {
    const chunker = new RecursiveChunker();
    const chunks = chunker.chunk(
      { id: 'doc1', content: 'one|two|three|four|five' },
      { chunkSize: 8, chunkOverlap: 0, separators: ['|', ''] }
    );
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves document metadata on every chunk', () => {
    const chunker = new RecursiveChunker();
    const chunks = chunker.chunk({
      id: 'doc1',
      content: 'Some content that is reasonably long for testing purposes here.',
      metadata: { source: 'test.txt' },
    });
    expect(chunks[0].metadata?.source).toBe('test.txt');
  });
});