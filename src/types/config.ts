import type { Chunker } from './chunker.js';
import type { Embedder } from './embedder.js';
import type { VectorStore } from './vectorstore.js';
import type { Retriever } from './retriever.js';
import type { LLMWrapper } from './llm.js';
import type { EmbeddingCache } from './cache.js';
import type { Reranker } from './reranker.js';

export interface RagifyConfig {
  chunker: Chunker;
  embedder: Embedder;
  vectorStore: VectorStore;
  retriever?: Retriever;
  llm?: LLMWrapper;
  cache?: EmbeddingCache;
  reranker?: Reranker;
}