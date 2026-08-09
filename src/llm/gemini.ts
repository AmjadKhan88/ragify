import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMWrapper } from '../types/index.js';
import { withRetry } from '../utils/retry.js';

export interface GeminiLLMOptions {
  apiKey?: string;
  model?: string;
}

const DEFAULT_MODEL = 'gemini-3.5-flash';

export class GeminiLLM implements LLMWrapper {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(options: GeminiLLMOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Gemini API key missing. Pass it via options.apiKey or set GEMINI_API_KEY in your environment.'
      );
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = options.model ?? process.env.GEMINI_LLM_MODEL ?? DEFAULT_MODEL;
  }

  async generate(prompt: string, context?: string[]): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const fullPrompt = context?.length
      ? `Answer the question using ONLY the following context. If the context doesn't contain the answer, say so honestly rather than guessing.\n\nContext:\n${context.join('\n\n---\n\n')}\n\nQuestion: ${prompt}`
      : prompt;

    const result = await withRetry(() => model.generateContent(fullPrompt));
    return result.response.text();
  }
}