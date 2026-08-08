import type { Chunker, ChunkerOptions, RagifyDocument, Chunk } from '../types/index.js';

export class FixedSizeChunker implements Chunker {
  chunk(document: RagifyDocument, options: ChunkerOptions = {}): Chunk[] {
    const { chunkSize = 500, chunkOverlap = 50 } = options;
    const chunks: Chunk[] = [];
    const text = document.content;

    let start = 0;
    let index = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        id: `${document.id}-chunk-${index}`,
        content: text.slice(start, end),
        documentId: document.id,
        metadata: { ...document.metadata, chunkIndex: index },
      });
      index++;
      start += chunkSize - chunkOverlap;
    }

    return chunks;
  }
}