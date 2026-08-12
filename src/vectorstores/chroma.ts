import type { ChromaClient, CloudClient, Collection } from 'chromadb';
import type { VectorStore, VectorSearchResult, Chunk } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { lazyImport } from '../utils/lazy-import.js';

export interface ChromaVectorStoreOptions {
  collectionName?: string;
  // Self-hosted mode
  path?: string;
  // Chroma Cloud mode
  apiKey?: string;
  tenant?: string;
  database?: string;
}

export class ChromaVectorStore implements VectorStore {
  private client: ChromaClient | CloudClient | null = null;
  private collection: Collection | null = null;
  private collectionName: string;
  private options: ChromaVectorStoreOptions;

  constructor(options: ChromaVectorStoreOptions = {}) {
    this.collectionName = options.collectionName ?? 'ragify-collection';
    this.options = options;
  }

  private async getCollection(): Promise<Collection> {
    if (!this.collection) {
      const mod = await lazyImport<typeof import('chromadb')>('chromadb');

      const apiKey = this.options.apiKey ?? process.env.CHROMA_API_KEY;
      const path = this.options.path ?? process.env.CHROMA_PATH;

      if (apiKey) {
        this.client = new mod.CloudClient({
          apiKey,
          tenant: this.options.tenant ?? process.env.CHROMA_TENANT,
          database: this.options.database ?? process.env.CHROMA_DATABASE,
        });
      } else {
        this.client = new mod.ChromaClient({ path: path ?? 'http://localhost:8000' });
      }

      // Cosine metric to match the similarity semantics used elsewhere in Ragify.
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { 'hnsw:space': 'cosine' },
      });
    }
    return this.collection;
  }

  async upsert(chunks: Chunk[]): Promise<void> {
    const collection = await this.getCollection();

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const documents: string[] = [];
    const metadatas: Record<string, string | number | boolean>[] = [];

    for (const chunk of chunks) {
      if (!chunk.embedding) {
        throw new Error(`Chunk ${chunk.id} has no embedding — embed before upserting.`);
      }
      ids.push(chunk.id);
      embeddings.push(chunk.embedding);
      documents.push(chunk.content);
      metadatas.push({
        documentId: chunk.documentId,
        // Chroma only supports flat string/number/boolean metadata values — nested
        // objects in chunk.metadata are dropped here rather than silently corrupted.
        ...(flattenMetadata(chunk.metadata)),
      });
    }

    await withRetry(() => collection.upsert({ ids, embeddings, documents, metadatas }));
  }

  async query(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const collection = await this.getCollection();

    const results = await withRetry(() =>
      collection.query({
        queryEmbeddings: [embedding],
        nResults: topK,
      })
    );

    const ids = results.ids[0] ?? [];
    const documents = results.documents[0] ?? [];
    const metadatas = results.metadatas[0] ?? [];
    const distances = results.distances?.[0] ?? [];

    return ids.map((id, i) => ({
      // Cosine distance -> similarity score (higher is better), matching the rest of Ragify.
      score: 1 - (distances[i] ?? 0),
      chunk: {
        id,
        content: documents[i] ?? '',
        documentId: (metadatas[i]?.documentId as string) ?? '',
        metadata: metadatas[i] ?? undefined,
      },
    }));
  }

  async delete(ids: string[]): Promise<void> {
    const collection = await this.getCollection();
    await withRetry(() => collection.delete({ ids }));
  }
}

function flattenMetadata(
  metadata?: Record<string, unknown>
): Record<string, string | number | boolean> {
  if (!metadata) return {};
  const flat: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      flat[key] = value;
    }
  }
  return flat;
}