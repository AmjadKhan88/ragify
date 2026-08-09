import Groq from 'groq-sdk';
import type { LLMWrapper } from '../types/index.js';
import { withRetry } from '../utils/retry.js';

export interface GroqLLMOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export class GroqLLM implements LLMWrapper {
  private client: Groq;
  private model: string;
  private temperature: number;

  constructor(options: GroqLLMOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Groq API key missing. Pass it via options.apiKey or set GROQ_API_KEY in your environment.'
      );
    }

    this.client = new Groq({ apiKey });
    this.model = options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? 0.3;
  }

  async generate(prompt: string, context?: string[]): Promise<string> {
    const systemMessage = context?.length
      ? `Answer the user's question using ONLY the following context. If the context doesn't contain the answer, say so honestly rather than guessing.\n\nContext:\n${context.join('\n\n---\n\n')}`
      : 'Answer the user\'s question as helpfully as possible.';

    const response = await withRetry(() =>
      this.client.chat.completions.create({
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