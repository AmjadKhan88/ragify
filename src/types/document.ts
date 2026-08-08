export interface RagifyDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  id: string;
  content: string;
  documentId: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}