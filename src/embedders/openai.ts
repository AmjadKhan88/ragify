import type OpenAI from 'openai';
import type { Embedder } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { toBatches } from '../utils/batch.js';
import { lazyImport } from '../utils/lazy-import.js';

export interface OpenAIEmbedderOptions {
  apiKey?: string;
  model?: string;
  batchSize?: number;
}

export class OpenAIEmbedder implements Embedder {
  private client: OpenAI | null = null;
  private apiKey: string;
  private model: string;
  private batchSize: number;
  readonly dimensions: number;

  constructor(options: OpenAIEmbedderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key missing. Pass it via options.apiKey or set OPENAI_API_KEY in your environment.'
      );
    }
    this.apiKey = apiKey;
    this.model = options.model ?? 'text-embedding-3-small';
    this.batchSize = options.batchSize ?? 100;
    this.dimensions = this.model === 'text-embedding-3-large' ? 3072 : 1536;
  }

  private async getClient(): Promise<OpenAI> {
    if (!this.client) {
      const mod = await lazyImport<typeof import('openai')>('openai');
      const OpenAICtor = mod.default;
      this.client = new OpenAICtor({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const client = await this.getClient();
    const batches = toBatches(texts, this.batchSize);
    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
      const response = await withRetry(() =>
        client.embeddings.create({ model: this.model, input: batch })
      );
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    return allEmbeddings;
  }
}