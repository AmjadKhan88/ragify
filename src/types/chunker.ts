import type { RagifyDocument, Chunk } from './document.js';

export interface ChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface Chunker {
  chunk(document: RagifyDocument, options?: ChunkerOptions): Promise<Chunk[]> | Chunk[];
}