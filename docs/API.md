# API Reference

Full reference for every exported class, interface, and function in `@amjadkhan88/ragify`.

## Table of Contents
- [RagifyPipeline](#ragifypipeline)
- [Types](#types)
- [Chunkers](#chunkers)
- [Embedders](#embedders)
- [Vector Stores](#vector-stores)
- [Retrievers](#retrievers)
- [LLM Wrappers](#llm-wrappers)
- [Rerankers](#rerankers)
- [Caches](#caches)
- [Utilities](#utilities)

---

## RagifyPipeline

```typescript
class RagifyPipeline {
  constructor(config: RagifyConfig);
  addDocuments(documents: RagifyDocument[]): Promise<void>;
  query(text: string, topK?: number): Promise<VectorSearchResult[]>;
  generate(question: string, topK?: number): Promise<string>;
}
```

### `addDocuments(documents)`
Chunks, embeds (using cache if configured), and indexes each document into the vector store (and retriever, if configured).

### `query(text, topK = 5)`
Returns the `topK` most relevant chunks for `text`. Uses `retriever` if configured, otherwise falls back to a direct embed + `vectorStore.query()`. If `reranker` is configured, over-fetches `topK * 3` candidates and re-ranks down to `topK`.

### `generate(question, topK = 5)`
Calls `query()` internally, then passes the retrieved chunk content as context to `llm.generate()`. **Throws** `No LLM configured` if `config.llm` is not set.

---

## Types

### `RagifyConfig`
```typescript
interface RagifyConfig {
  chunker: Chunker;
  embedder: Embedder;
  vectorStore: VectorStore;
  retriever?: Retriever;
  llm?: LLMWrapper;
  cache?: EmbeddingCache;
  reranker?: Reranker;
}
```

### `RagifyDocument`
```typescript
interface RagifyDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}
```

### `Chunk`
```typescript
interface Chunk {
  id: string;
  content: string;
  documentId: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}
```

### `VectorSearchResult`
```typescript
interface VectorSearchResult {
  chunk: Chunk;
  score: number; // higher = more relevant, across all adapters
}
```

---

## Chunkers

### `Chunker` interface
```typescript
interface Chunker {
  chunk(document: RagifyDocument, options?: ChunkerOptions): Promise<Chunk[]> | Chunk[];
}

interface ChunkerOptions {
  chunkSize?: number;    // default: 500
  chunkOverlap?: number; // default: 50
}
```

### `FixedSizeChunker`
Splits `content` by raw character count. No constructor options.

### `RecursiveChunker`
```typescript
new RecursiveChunker();
chunk(document, {
  chunkSize?: number;             // default: 500
  chunkOverlap?: number;          // default: 50
  separators?: string[];          // default: ['\n\n', '\n', '. ', ' ', '']
});
```
Splits recursively using `separators` in priority order, falling back to the next separator only when a piece still exceeds `chunkSize`. Small adjacent pieces are merged back up to `chunkSize` with `chunkOverlap` carried between chunks.

---

## Embedders

### `Embedder` interface
```typescript
interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
```

### `MockEmbedder`
No options. `dimensions = 8`. Deterministic character-hash vectors — **not semantically meaningful**, for testing/dev only.

### `GeminiEmbedder`
```typescript
new GeminiEmbedder({
  apiKey?: string;      // default: process.env.GEMINI_API_KEY
  model?: string;       // default: process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004'
  batchSize?: number;   // default: 100
  dimensions?: number;  // default: 768 — override if using a model with different output size
});
```
**Throws** if no API key is available. Requires `@google/generative-ai` installed.

### `OpenAIEmbedder`
```typescript
new OpenAIEmbedder({
  apiKey?: string;      // default: process.env.OPENAI_API_KEY
  model?: string;       // default: 'text-embedding-3-small'
  batchSize?: number;   // default: 100
});
```
`dimensions` is derived automatically (1536 for `text-embedding-3-small`, 3072 for `text-embedding-3-large`). Requires `openai` installed.

---

## Vector Stores

### `VectorStore` interface
```typescript
interface VectorStore {
  upsert(chunks: Chunk[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
}
```

### `InMemoryVectorStore`
No options. Cosine similarity, held in a `Map` — cleared on process exit.

### `PineconeVectorStore`
```typescript
new PineconeVectorStore({
  apiKey?: string;      // default: process.env.PINECONE_API_KEY
  indexName?: string;   // default: process.env.PINECONE_INDEX_NAME
  namespace?: string;   // optional, isolates data within one index
});
```
**Requires a pre-created Pinecone index** with a "custom"/bring-your-own-vectors dimension matching your embedder's output — Pinecone's UI-integrated-embedding dimension picker (with fixed options like 1024/768/512) is the *wrong* flow; use the custom/manual dimension option instead. Requires `@pinecone-database/pinecone` (tested against v8.x — the `upsert()` call uses `{ records: [...] }` and index targeting resolves the host via `describeIndex()` first, per that SDK's breaking changes).

### `ChromaVectorStore`
```typescript
new ChromaVectorStore({
  collectionName?: string;  // default: 'ragify-collection'
  path?: string;             // self-hosted mode, default: process.env.CHROMA_PATH ?? 'http://localhost:8000'
  apiKey?: string;           // Chroma Cloud mode, default: process.env.CHROMA_API_KEY
  tenant?: string;
  database?: string;
});
```
If `apiKey` is present (explicitly or via env), connects via Chroma Cloud; otherwise self-hosted via `path`. Metadata values must be flat string/number/boolean — nested `chunk.metadata` fields are dropped, not errored. Requires `chromadb` installed.

### `QdrantVectorStore`
```typescript
new QdrantVectorStore({
  url?: string;          // default: process.env.QDRANT_URL — required
  apiKey?: string;        // default: process.env.QDRANT_API_KEY
  collectionName?: string; // default: 'ragify-collection'
  dimensions?: number;     // optional, inferred from first embedding if omitted
});
```
Auto-creates its collection on first use. Chunk IDs are mapped to deterministic UUIDs internally (Qdrant only accepts unsigned integers or UUIDs as point IDs) — the original chunk ID is preserved and returned correctly in query results. Requires `@qdrant/js-client-rest`; uses its current `.query()` method (not the deprecated `.search()`).

---

## Retrievers

### `Retriever` interface
```typescript
interface Retriever {
  index(chunks: Chunk[]): Promise<void> | void;
  retrieve(query: string, topK: number): Promise<VectorSearchResult[]>;
}
```

### `BM25Retriever`
```typescript
new BM25Retriever({ k1?: number; b?: number }); // defaults: k1=1.5, b=0.75
```
Pure keyword-statistics retrieval, no embeddings or network calls.

### `HybridRetriever`
```typescript
new HybridRetriever(vectorStore: VectorStore, embedder: Embedder, {
  rrfK?: number; // default: 60 — RRF constant, higher = less aggressive fusion
});
```
Combines dense (`vectorStore` + `embedder`) and sparse (internal `BM25Retriever`) results via Reciprocal Rank Fusion.

---

## LLM Wrappers

### `LLMWrapper` interface
```typescript
interface LLMWrapper {
  generate(prompt: string, context?: string[]): Promise<string>;
}
```

### `GroqLLM`
```typescript
new GroqLLM({
  apiKey?: string;       // default: process.env.GROQ_API_KEY
  model?: string;        // default: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
  temperature?: number;  // default: 0.3
});
```

### `GeminiLLM`
```typescript
new GeminiLLM({
  apiKey?: string;  // default: process.env.GEMINI_API_KEY
  model?: string;   // default: process.env.GEMINI_LLM_MODEL ?? 'gemini-1.5-flash'
});
```

Both wrappers, when given `context`, instruct the model to answer only from the provided context and to say so honestly if the context is insufficient — reduces hallucination by default.

---

## Rerankers

### `Reranker` interface
```typescript
interface Reranker {
  rerank(query: string, results: VectorSearchResult[], topK: number): Promise<VectorSearchResult[]>;
}
```

### `LLMReranker`
```typescript
new LLMReranker(llm: LLMWrapper, { concurrency?: number }); // default concurrency: 5
```
Scores each candidate 0–10 for relevance via `llm.generate()`, processed in batches of `concurrency`. Falls back to the candidate's original retrieval score if the LLM's response can't be parsed as a number.

---

## Caches

### `EmbeddingCache` interface
```typescript
interface EmbeddingCache {
  get(key: string): Promise<number[] | undefined> | number[] | undefined;
  set(key: string, embedding: number[]): Promise<void> | void;
}
```

### `InMemoryCache`
No options. Cleared on process exit.

### `FileCache`
```typescript
new FileCache({ filePath?: string }); // default: '.ragify-cache.json'
```
Persists as JSON on disk; rewrites the whole file on every `set()` (fine for dev/moderate scale, not built for high-throughput production writes).

Cache keys are content hashes salted with the embedder's class name (via `hashContent`), so switching embedder providers never returns a stale, wrong-provider vector.

---

## Utilities

```typescript
withRetry<T>(fn: () => Promise<T>, options?: { maxRetries?: number; initialDelayMs?: number; factor?: number }): Promise<T>
toBatches<T>(items: T[], batchSize: number): T[][]
hashContent(content: string, salt?: string): string
```
Exported for reuse if you're writing your own custom adapter and want the same resilience/batching/caching primitives Ragify's built-in adapters use.