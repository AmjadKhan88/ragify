import { describe, it, expect, vi } from 'vitest';
import { GeminiLLM } from '../src/llm/gemini.js';

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
      this.getGenerativeModel = vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'Mocked answer' },
        }),
      });
    }),
  };
});

describe('GeminiLLM', () => {
  it('throws without an API key', () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiLLM()).toThrow(/API key missing/);
    process.env.GEMINI_API_KEY = original;
  });

  it('generates a response', async () => {
    const llm = new GeminiLLM({ apiKey: 'test-key' });
    const result = await llm.generate('question', ['some context']);
    expect(result).toBe('Mocked answer');
  });
});