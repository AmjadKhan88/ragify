import type { QdrantClient } from '@qdrant/js-client-rest';
import type { VectorStore, VectorSearchResult, Chunk } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { lazyImport } from '../utils/lazy-import.js';
import { toDeterministicUuid } from '../utils/uuid.js';

export interface QdrantVectorStoreOptions {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  dimensions?: number;
}

export class QdrantVectorStore implements VectorStore {
  private client: QdrantClient | null = null;
  private url: string;
  private apiKey?: string;
  private collectionName: string;
  private dimensions?: number;
  private collectionReady = false;

  constructor(options: QdrantVectorStoreOptions = {}) {
    const url = options.url ?? process.env.QDRANT_URL;
    if (!url) {
      throw new Error(
        'Qdrant URL missing. Pass it via options.url or set QDRANT_URL in your environment.'
      );
    }
    this.url = url;
    this.apiKey = options.apiKey ?? process.env.QDRANT_API_KEY;
    this.collectionName = options.collectionName ?? 'ragify-collection';
    this.dimensions = options.dimensions;
  }

  private async getClient(): Promise<QdrantClient> {
    if (!this.client) {
      const mod = await lazyImport<typeof import('@qdrant/js-client-rest')>(
        '@qdrant/js-client-rest'
      );
      this.client = new mod.QdrantClient({ url: this.url, apiKey: this.apiKey });
    }
    return this.client;
  }

  private async ensureCollection(vectorSize: number): Promise<void> {
    if (this.collectionReady) return;
    const client = await this.getClient();

    const { exists } = await client.collectionExists(this.collectionName);
    if (!exists) {
      await client.createCollection(this.collectionName, {
        vectors: { size: this.dimensions ?? vectorSize, distance: 'Cosine' },
      });
    }
    this.collectionReady = true;
  }

async upsert(chunks: Chunk[]): Promise<void> {
  const client = await this.getClient();

  const points = chunks.map((chunk) => {
    if (!chunk.embedding) {
      throw new Error(`Chunk ${chunk.id} has no embedding — embed before upserting.`);
    }
    return {
      id: toDeterministicUuid(chunk.id),
      vector: chunk.embedding,
      payload: {
        chunkId: chunk.id, // preserve the original ID for reads
        content: chunk.content,
        documentId: chunk.documentId,
        ...(chunk.metadata ?? {}),
      },
    };
  });

  if (points.length > 0) {
    await this.ensureCollection(points[0].vector.length);
  }

  await withRetry(() => client.upsert(this.collectionName, { points }));
}

async query(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
  const client = await this.getClient();
  await this.ensureCollection(embedding.length);

  const response = await withRetry(() =>
    client.query(this.collectionName, {
      query: embedding,
      limit: topK,
      with_payload: true,
    })
  );

  return response.points.map((point) => ({
    score: point.score,
    chunk: {
      id: (point.payload?.chunkId as string) ?? String(point.id),
      content: (point.payload?.content as string) ?? '',
      documentId: (point.payload?.documentId as string) ?? '',
      metadata: point.payload ?? undefined,
    },
  }));
}

async delete(ids: string[]): Promise<void> {
  const client = await this.getClient();
  const qdrantIds = ids.map((id) => toDeterministicUuid(id));
  await withRetry(() => client.delete(this.collectionName, { points: qdrantIds }));
}
}