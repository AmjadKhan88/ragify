import OpenAI from 'openai';
import type { Embedder } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { toBatches } from '../utils/batch.js';

export interface OpenAIEmbedderOptions {
  apiKey?: string;
  model?: string;
  batchSize?: number;
}

export class OpenAIEmbedder implements Embedder {
  private client: OpenAI;
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

    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? 'text-embedding-3-small';
    this.batchSize = options.batchSize ?? 100;
    this.dimensions = this.model === 'text-embedding-3-large' ? 3072 : 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const batches = toBatches(texts, this.batchSize);
    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
      const response = await withRetry(() =>
        this.client.embeddings.create({
          model: this.model,
          input: batch,
        })
      );
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    return allEmbeddings;
  }
}