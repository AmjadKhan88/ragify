import type Groq from 'groq-sdk';
import type { LLMWrapper } from '../types/index.js';
import { withRetry } from '../utils/retry.js';
import { lazyImport } from '../utils/lazy-import.js';

export interface GroqLLMOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export class GroqLLM implements LLMWrapper {
  private client: Groq | null = null;
  private apiKey: string;
  private model: string;
  private temperature: number;

  constructor(options: GroqLLMOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Groq API key missing. Pass it via options.apiKey or set GROQ_API_KEY in your environment.'
      );
    }
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? 0.3;
  }

  private async getClient(): Promise<Groq> {
    if (!this.client) {
      const mod = await lazyImport<typeof import('groq-sdk')>('groq-sdk');
      const GroqCtor = mod.default;
      this.client = new GroqCtor({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async generate(prompt: string, context?: string[]): Promise<string> {
    const client = await this.getClient();
    const systemMessage = context?.length
      ? `Answer the user's question using ONLY the following context. If the context doesn't contain the answer, say so honestly rather than guessing.\n\nContext:\n${context.join('\n\n---\n\n')}`
      : "Answer the user's question as helpfully as possible.";

    const response = await withRetry(() =>
      client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
      })
    );

    return response.choices[0]?.message?.content ?? '';
  }
}