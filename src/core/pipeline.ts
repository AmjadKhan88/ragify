import type { RagifyConfig, RagifyDocument, VectorSearchResult, Chunk } from '../types/index.js';
import { hashContent } from '../utils/hash.js';

export class RagifyPipeline {
  constructor(private config: RagifyConfig) { }

  async addDocuments(documents: RagifyDocument[]): Promise<void> {
    for (const doc of documents) {
      const chunks = await this.config.chunker.chunk(doc);
      const embeddedChunks = await this.embedChunks(chunks);

      await this.config.vectorStore.upsert(embeddedChunks);

      if (this.config.retriever) {
        await this.config.retriever.index(embeddedChunks);
      }
    }
  }

  private async embedChunks(chunks: Chunk[]): Promise<Chunk[]> {
    const { embedder, cache } = this.config;

    if (!cache) {
      const embeddings = await embedder.embed(chunks.map((c) => c.content));
      return chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] }));
    }

    const cacheKeys = chunks.map((c) => hashContent(c.content, embedder.constructor.name));
    const cached = await Promise.all(cacheKeys.map((key) => cache.get(key)));

    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    cached.forEach((embedding, i) => {
      if (embedding === undefined) {
        uncachedIndices.push(i);
        uncachedTexts.push(chunks[i].content);
      }
    });

    let newEmbeddings: number[][] = [];
    if (uncachedTexts.length > 0) {
      newEmbeddings = await embedder.embed(uncachedTexts);
      await Promise.all(
        uncachedIndices.map((chunkIndex, j) =>
          cache.set(cacheKeys[chunkIndex], newEmbeddings[j])
        )
      );
    }

    const finalEmbeddings: number[][] = [...cached] as number[][];
    uncachedIndices.forEach((chunkIndex, j) => {
      finalEmbeddings[chunkIndex] = newEmbeddings[j];
    });

    return chunks.map((chunk, i) => ({ ...chunk, embedding: finalEmbeddings[i] }));
  }

  async query(text: string, topK = 5): Promise<VectorSearchResult[]> {
    const fetchK = this.config.reranker ? topK * 3 : topK;

    const initialResults = this.config.retriever
      ? await this.config.retriever.retrieve(text, fetchK)
      : await this.searchVectorStore(text, fetchK);

    if (this.config.reranker) {
      return this.config.reranker.rerank(text, initialResults, topK);
    }

    return initialResults;
  }

  private async searchVectorStore(text: string, topK: number): Promise<VectorSearchResult[]> {
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