import type { Chunker, ChunkerOptions, RagifyDocument, Chunk } from '../types/index.js';

export interface RecursiveChunkerOptions extends ChunkerOptions {
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

export class RecursiveChunker implements Chunker {
  chunk(document: RagifyDocument, options: RecursiveChunkerOptions = {}): Chunk[] {
    const { chunkSize = 500, chunkOverlap = 50, separators = DEFAULT_SEPARATORS } = options;

    const rawPieces = this.splitText(document.content, separators, chunkSize);
    const merged = this.mergeWithOverlap(rawPieces, chunkSize, chunkOverlap);

    return merged.map((content, index) => ({
      id: `${document.id}-chunk-${index}`,
      content,
      documentId: document.id,
      metadata: { ...document.metadata, chunkIndex: index },
    }));
  }

  /** Recursively splits text using separators in priority order until pieces fit chunkSize. */
  private splitText(text: string, separators: string[], chunkSize: number): string[] {
    if (text.length <= chunkSize) return [text];

    const [separator, ...remaining] = separators;
    if (separator === undefined) {
      // No separators left — hard-split by character as last resort.
      const pieces: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        pieces.push(text.slice(i, i + chunkSize));
      }
      return pieces;
    }

    const parts = separator === '' ? text.split('') : text.split(separator);
    const results: string[] = [];

    for (const part of parts) {
      if (part.length === 0) continue;
      if (part.length <= chunkSize) {
        results.push(part);
      } else {
        // This piece is still too big — recurse with the next-priority separator.
        results.push(...this.splitText(part, remaining, chunkSize));
      }
    }

    return results;
  }

  /** Greedily merges small pieces back together up to chunkSize, adding overlap between chunks. */
  private mergeWithOverlap(pieces: string[], chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const piece of pieces) {
      const candidate = current ? current + ' ' + piece : piece;

      if (candidate.length > chunkSize && current) {
        chunks.push(current);
        const overlapText = current.slice(Math.max(0, current.length - chunkOverlap));
        current = overlapText ? overlapText + ' ' + piece : piece;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }
}