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

      if (this.config.retriever) {
        await this.config.retriever.index(embeddedChunks);
      }
    }
  }

  async query(text: string, topK = 5): Promise<VectorSearchResult[]> {
    if (this.config.retriever) {
      return this.config.retriever.retrieve(text, topK);
    }
    const [embedding] = await this.config.embedder.embed([text]);
    return this.config.vectorStore.query(embedding, topK);
  }

  async generate(question: string, topK = 5): Promise<string> {
    if (!this.config.llm) {
      throw new Error(
        'No LLM configured. Pass an llm (e.g. GroqLLM, GeminiLLM) in RagifyConfig to use generate().'
      );
    }

    const results = await this.query(question, topK);
    const context = results.map((r) => r.chunk.content);
    return this.config.llm.generate(question, context);
  }
}