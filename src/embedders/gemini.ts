import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { Embedder } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { toBatches } from '../utils/batch.js';
import { lazyImport } from '../utils/lazy-import.js';

export interface GeminiEmbedderOptions {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  dimensions?: number;
}

const DEFAULT_MODEL = 'gemini-embedding-2-preview';
const DEFAULT_DIMENSIONS = 768;

export class GeminiEmbedder implements Embedder {
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private model: string;
  private batchSize: number;
  readonly dimensions: number;

  constructor(options: GeminiEmbedderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Gemini API key missing. Pass it via options.apiKey or set GEMINI_API_KEY in your environment.'
      );
    }
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_MODEL;
    this.batchSize = options.batchSize ?? 100;
    this.dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
  }

  private async getClient(): Promise<GoogleGenerativeAI> {
    if (!this.client) {
      const mod = await lazyImport<typeof import('@google/generative-ai')>('@google/generative-ai');
      this.client = new mod.GoogleGenerativeAI(this.apiKey);
    }
    return this.client;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const client = await this.getClient();
    const model = client.getGenerativeModel({ model: this.model });
    const batches = toBatches(texts, this.batchSize);
    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
      const results = await withRetry(() =>
        Promise.all(batch.map((text) => model.embedContent(text)))
      );
      allEmbeddings.push(...results.map((r) => r.embedding.values));
    }

    return allEmbeddings;
  }
}