import type { RagifyConfig, RagifyDocument, VectorSearchResult } from '../types/index.js';

export class RagifyPipeline {
  constructor(private config: RagifyConfig) {}

  async addDocuments(documents: RagifyDocument[]): Promise<void> {
    for (const doc of documents) {
      const chunks = await this.config.chunker.chunk(doc);
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.config.embedder.embed(texts);

      const embeddedChunks = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      await this.config.vectorStore.upsert(embeddedChunks);
    }
  }

  async query(text: string, topK = 5): Promise<VectorSearchResult[]> {
    const [embedding] = await this.config.embedder.embed([text]);
    return this.config.vectorStore.query(embedding, topK);
  }
}