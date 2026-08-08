import { describe, it, expect, vi } from 'vitest';
import { GeminiEmbedder } from '../src/embedders/gemini.js';

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
      this.getGenerativeModel = vi.fn().mockReturnValue({
        embedContent: vi.fn().mockResolvedValue({
          embedding: { values: new Array(768).fill(0.1) },
        }),
      });
    }),
  };
});

describe('GeminiEmbedder', () => {
  it('throws without an API key', () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiEmbedder()).toThrow(/API key missing/);
    process.env.GEMINI_API_KEY = original;
  });

  it('embeds text using the Gemini client', async () => {
    const embedder = new GeminiEmbedder({ apiKey: 'test-key' });
    const result = await embedder.embed(['hello world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(768);
  });

  it('uses GEMINI_EMBEDDING_MODEL env var when no model option is given', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_EMBEDDING_MODEL = 'custom-model';
    const embedder = new GeminiEmbedder();
    expect((embedder as any).model).toBe('custom-model');
    delete process.env.GEMINI_EMBEDDING_MODEL;
  });
});