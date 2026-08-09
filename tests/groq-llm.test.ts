import { describe, it, expect, vi } from 'vitest';
import { GroqLLM } from '../src/llm/groq.js';

vi.mock('groq-sdk', () => {
  return {
    default: vi.fn().mockImplementation(function (this: any) {
      this.chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked answer' } }],
          }),
        },
      };
    }),
  };
});

describe('GroqLLM', () => {
  it('throws without an API key', () => {
    const original = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    expect(() => new GroqLLM()).toThrow(/API key missing/);
    process.env.GROQ_API_KEY = original;
  });

  it('generates a response', async () => {
    const llm = new GroqLLM({ apiKey: 'test-key' });
    const result = await llm.generate('question', ['some context']);
    expect(result).toBe('Mocked answer');
  });
});