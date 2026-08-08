// llm.ts
export interface LLMWrapper {
  generate(prompt: string, context?: string[]): Promise<string>;
}