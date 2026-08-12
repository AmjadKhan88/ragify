import type { Pinecone, Index } from '@pinecone-database/pinecone';
import type { VectorStore, VectorSearchResult, Chunk } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { lazyImport } from '../utils/lazy-import.js';

export interface PineconeVectorStoreOptions {
  apiKey?: string;
  indexName?: string;
  namespace?: string;
}

export class PineconeVectorStore implements VectorStore {
  private client: Pinecone | null = null;
  private index: Index | null = null;
  private apiKey: string;
  private indexName: string;
  private namespace?: string;

  constructor(options: PineconeVectorStoreOptions = {}) {
    const apiKey = options.apiKey ?? process.env.PINECONE_API_KEY;
    const indexName = options.indexName ?? process.env.PINECONE_INDEX_NAME;

    if (!apiKey) {
      throw new Error(
        'Pinecone API key missing. Pass it via options.apiKey or set PINECONE_API_KEY in your environment.'
      );
    }
    if (!indexName) {
      throw new Error(
        'Pinecone index name missing. Pass it via options.indexName or set PINECONE_INDEX_NAME in your environment.'
      );
    }

    this.apiKey = apiKey;
    this.indexName = indexName;
    this.namespace = options.namespace;
  }

  private async getIndex(): Promise<Index> {
    if (!this.index) {
      const mod = await lazyImport<typeof import('@pinecone-database/pinecone')>(
        '@pinecone-database/pinecone'
      );
      this.client = new mod.Pinecone({ apiKey: this.apiKey });

      // v8 removed legacy string targeting — resolve the host explicitly first.
      const indexModel = await this.client.describeIndex(this.indexName);
      const baseIndex = this.client.index({ host: indexModel.host });
      this.index = this.namespace ? baseIndex.namespace(this.namespace) : baseIndex;
    }
    return this.index;
  }

  async upsert(chunks: Chunk[]): Promise<void> {
    const index = await this.getIndex();

    const records = chunks.map((chunk) => {
      if (!chunk.embedding) {
        throw new Error(`Chunk ${chunk.id} has no embedding — embed before upserting.`);
      }
      return {
        id: chunk.id,
        values: chunk.embedding,
        metadata: {
          content: chunk.content,
          documentId: chunk.documentId,
          ...(chunk.metadata ?? {}),
        },
      };
    });

    // v8 requires { records: [...] }, not a bare array.
    await withRetry(() => index.upsert({ records }));
  }

  async query(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const index = await this.getIndex();

    const response = await withRetry(() =>
      index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
      })
    );

    return (response.matches ?? []).map((match) => ({
      score: match.score ?? 0,
      chunk: {
        id: match.id,
        content: (match.metadata?.content as string) ?? '',
        documentId: (match.metadata?.documentId as string) ?? '',
        metadata: match.metadata,
      },
    }));
  }

  async delete(ids: string[]): Promise<void> {
    const index = await this.getIndex();
    await withRetry(() => index.deleteMany(ids));
  }
}