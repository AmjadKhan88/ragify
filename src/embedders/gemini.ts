import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Embedder } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { toBatches } from '../utils/batch.js';

export interface GeminiEmbedderOptions {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  dimensions?: number;
}

const DEFAULT_MODEL = 'text-embedding-004';
const DEFAULT_DIMENSIONS = 768;

export class GeminiEmbedder implements Embedder {
  private client: GoogleGenerativeAI;
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

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = options.model ?? process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_MODEL;
    this.batchSize = options.batchSize ?? 100;
    this.dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const model = this.client.getGenerativeModel({ model: this.model });
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