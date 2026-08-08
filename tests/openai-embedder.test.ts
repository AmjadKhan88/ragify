import { describe, it, expect, vi } from 'vitest';
import { OpenAIEmbedder } from '../src/embedders/openai.js';

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function (this: any) {
      this.embeddings = {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        }),
      };
    }),
  };
});

describe('OpenAIEmbedder', () => {
  it('throws without an API key', () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIEmbedder()).toThrow(/API key missing/);
    process.env.OPENAI_API_KEY = original;
  });

  it('embeds text using the OpenAI client', async () => {
    const embedder = new OpenAIEmbedder({ apiKey: 'test-key' });
    const result = await embedder.embed(['hello world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1536);
  });
});