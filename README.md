# Ragify

[![CI](https://github.com/AmjadKhan88/Ragify/actions/workflows/ci.yml/badge.svg)](https://github.com/AmjadKhan88/Ragify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amjadkhan-dev/ragify.svg)](https://www.npmjs.com/package/@amjadkhan-dev/ragify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

> Unified RAG Pipeline Builder for Node.js — eliminate the repetitive boilerplate of chunking, embedding, retrieval, and vector storage behind one clean, swappable API.

Ragify gives you a single, cohesive interface to manage the entire Retrieval-Augmented Generation workflow — from document ingestion to grounded answer generation — without hand-wiring five different SDKs every time you start a new RAG project.

This document is the complete reference for Ragify: installation, every component, every vector database setup from scratch, every environment variable, common errors and their fixes, and how to extend the package with your own adapters. It's written so you can hand this entire file to an AI assistant (or a new team member) and they'll have everything needed to build a working RAG application on top of Ragify without any other source of truth.

---

## Table of Contents

1. [Why Ragify](#1-why-ragify)
2. [Installation](#2-installation)
3. [Quick Start](#3-quick-start)
4. [Core Architecture](#4-core-architecture)
5. [RagifyPipeline API](#5-ragifypipeline-api)
6. [Chunkers](#6-chunkers)
7. [Embedders](#7-embedders)
8. [Vector Stores — Full Setup Guides](#8-vector-stores--full-setup-guides)
9. [Retrieval Strategies](#9-retrieval-strategies)
10. [LLM Wrappers (Generation)](#10-llm-wrappers-generation)
11. [Re-ranking](#11-re-ranking)
12. [Caching](#12-caching)
13. [Using Components Standalone (Without the Pipeline)](#13-using-components-standalone-without-the-pipeline)
14. [Complete Configuration Reference](#14-complete-configuration-reference)
15. [Environment Variables — Full Reference](#15-environment-variables--full-reference)
16. [Error Handling](#16-error-handling)
17. [Extending Ragify — Writing Custom Adapters](#17-extending-ragify--writing-custom-adapters)
18. [Troubleshooting](#18-troubleshooting)
19. [Compatibility](#19-compatibility)
20. [End-to-End Example: Production RAG App](#20-end-to-end-example-production-rag-app)
21. [FAQ](#21-faq)
22. [Contributing](#22-contributing)
23. [License](#23-license)

---

## 1. Why Ragify

Most RAG tutorials wire one embedding API directly to one vector store, hardcoded together. The moment you want to swap providers, add hybrid search, cache embeddings to cut API costs, or re-rank results, you're rewriting plumbing from scratch.

Ragify is built around one idea: **every stage of the pipeline is a TypeScript interface, and every implementation is swappable**, without touching the rest of your code.

```typescript
const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder: new GeminiEmbedder(),        // swap for OpenAIEmbedder — nothing else changes
  vectorStore: new QdrantVectorStore(),  // swap for Pinecone, Chroma, InMemory — nothing else changes
  llm: new GroqLLM(),                    // swap for GeminiLLM — nothing else changes
});
```

### Features

- **Plug-and-play architecture** — swap chunkers, embedders, vector stores, retrievers, and LLMs via one config object
- **Multiple embedding providers** — Gemini, OpenAI, or a zero-cost mock for local dev/testing
- **Multiple vector stores** — in-memory, Pinecone, Chroma, Qdrant
- **Smart chunking** — fixed-size or boundary-aware recursive chunking (paragraph → sentence → word → character)
- **Hybrid retrieval** — dense (vector) + sparse (BM25) search fused via Reciprocal Rank Fusion
- **LLM-based re-ranking** — improves precision on top of hybrid retrieval, no dedicated re-ranking API required
- **Embedding cache** — content-hash-keyed caching (in-memory or file-based) skips re-embedding unchanged text
- **Resilience built in** — automatic retry-with-backoff and request batching on every network-calling adapter
- **Optional peer dependencies** — only install the SDK for the provider(s) you actually use; nothing else is downloaded
- **Fully typed** — written in TypeScript, ships with complete `.d.ts` declarations
- **Dual module format** — works in both ESM and CommonJS projects
- **Every component works standalone** — use just `GroqLLM` for plain text generation, or just an embedder, without the rest of the pipeline

---

## 2. Installation

```bash
npm install @amjadkhan-dev/ragify
```

Ragify's provider SDKs are **optional peer dependencies** — install only what you use. If you call an adapter without its SDK installed, Ragify throws a clear error telling you exactly which package to install, rather than a cryptic module-not-found crash.

```bash
# Embedding providers
npm install @google/generative-ai       # GeminiEmbedder / GeminiLLM
npm install openai                      # OpenAIEmbedder

# LLM generation
npm install groq-sdk                    # GroqLLM

# Vector stores
npm install @pinecone-database/pinecone # PineconeVectorStore
npm install chromadb                    # ChromaVectorStore
npm install @qdrant/js-client-rest      # QdrantVectorStore
```

**Requirements:** Node.js ≥ 20.0.0 (required by several underlying SDKs and the test tooling; the package will not run correctly on Node 18 or earlier).

---

## 3. Quick Start

### Zero-cost, zero-setup (recommended first step)

Uses the built-in mock embedder and in-memory store — no API keys, no signups, no cost. Good for confirming the package works before committing to any real provider.

```typescript
import {
  RagifyPipeline,
  FixedSizeChunker,
  InMemoryVectorStore,
  MockEmbedder,
} from '@amjadkhan-dev/ragify';

const pipeline = new RagifyPipeline({
  chunker: new FixedSizeChunker(),
  embedder: new MockEmbedder(),
  vectorStore: new InMemoryVectorStore(),
});

await pipeline.addDocuments([
  { id: 'doc1', content: 'Node.js is a JavaScript runtime built on Chrome V8.' },
  { id: 'doc2', content: 'Bananas are a great source of potassium.' },
]);

const results = await pipeline.query('Tell me about JavaScript runtimes');
console.log(results);
```

### With real embeddings and grounded generation

```typescript
import {
  RagifyPipeline,
  RecursiveChunker,
  InMemoryVectorStore,
  GeminiEmbedder,
  GroqLLM,
} from '@amjadkhan-dev/ragify';

const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder: new GeminiEmbedder(),   // reads GEMINI_API_KEY from env
  vectorStore: new InMemoryVectorStore(),
  llm: new GroqLLM(),               // reads GROQ_API_KEY from env
});

await pipeline.addDocuments([
  { id: 'doc1', content: 'Your document content here...' },
]);

const answer = await pipeline.generate('What does this document say about X?');
console.log(answer);
```

---

## 4. Core Architecture

Ragify has **seven** swappable component types, all consumed through one `RagifyConfig` object passed to `RagifyPipeline`:

| Component | Interface | Required? | Purpose |
|---|---|---|---|
| `chunker` | `Chunker` | ✅ Yes | Splits documents into indexable pieces |
| `embedder` | `Embedder` | ✅ Yes | Converts text into vector embeddings |
| `vectorStore` | `VectorStore` | ✅ Yes | Stores and searches embedded chunks |
| `retriever` | `Retriever` | optional | Custom retrieval strategy (e.g. hybrid search) — overrides default `vectorStore.query()` |
| `llm` | `LLMWrapper` | optional | Generates answers from retrieved context — required only for `.generate()` |
| `cache` | `EmbeddingCache` | optional | Skips re-embedding unchanged content |
| `reranker` | `Reranker` | optional | Reorders retrieved results for higher precision |

### Data flow

```
RagifyDocument (raw text + metadata)
      │
      ▼  chunker.chunk()
   Chunk[] (split pieces, no embeddings yet)
      │
      ▼  embedder.embed()  [checked against cache first, if configured]
   Chunk[] (now with .embedding vectors attached)
      │
      ▼  vectorStore.upsert()  +  retriever.index() [if configured]
   Stored in vector database / BM25 index
      │
      │  ... later, at query time ...
      ▼  retriever.retrieve()  OR  embedder.embed() + vectorStore.query()
   VectorSearchResult[] (ranked chunks + scores)
      │
      ▼  reranker.rerank()  [if configured]
   VectorSearchResult[] (re-ordered, trimmed to topK)
      │
      ▼  llm.generate(question, context)  [only for .generate()]
   string (final grounded answer)
```

---

## 5. RagifyPipeline API

```typescript
class RagifyPipeline {
  constructor(config: RagifyConfig);

  addDocuments(documents: RagifyDocument[]): Promise<void>;
  query(text: string, topK?: number): Promise<VectorSearchResult[]>;
  generate(question: string, topK?: number): Promise<string>;
}
```

### `addDocuments(documents)`

For each document: chunks it, embeds each chunk (using the cache if configured — unchanged content is skipped), upserts into the vector store, and indexes into the retriever if one is configured.

```typescript
await pipeline.addDocuments([
  { id: 'doc1', content: 'First document text...', metadata: { source: 'manual.pdf', page: 1 } },
  { id: 'doc2', content: 'Second document text...' },
]);
```

`metadata` is optional and passed through to every chunk derived from that document — useful for filtering or displaying source information later.

### `query(text, topK = 5)`

Returns the `topK` most relevant chunks for `text`, each with a `score` (higher = more relevant, consistent across every vector store adapter).

- If `retriever` is configured, delegates to it (e.g. `HybridRetriever`).
- Otherwise, embeds `text` directly and calls `vectorStore.query()`.
- If `reranker` is configured, internally fetches `topK * 3` candidates first, then re-ranks down to `topK` — giving the re-ranker a wider pool to actually improve on.

```typescript
const results = await pipeline.query('How do I reset my password?', 3);
// [{ score: 0.91, chunk: { id: '...', content: '...', documentId: '...' } }, ...]
```

### `generate(question, topK = 5)`

Calls `query()` internally, then passes the retrieved chunks' content as `context` to `llm.generate()`.

**Throws** `No LLM configured. Pass an llm (e.g. GroqLLM, GeminiLLM) in RagifyConfig to use generate().` if `config.llm` was not set.

```typescript
const answer = await pipeline.generate('How do I reset my password?');
// "To reset your password, go to Settings > Security and click 'Reset Password'..."
```

---

## 6. Chunkers

### `Chunker` interface

```typescript
interface Chunker {
  chunk(document: RagifyDocument, options?: ChunkerOptions): Promise<Chunk[]> | Chunk[];
}

interface ChunkerOptions {
  chunkSize?: number;    // default: 500 (characters)
  chunkOverlap?: number; // default: 50 (characters)
}
```

### `FixedSizeChunker`

Splits `content` by raw character count, with no awareness of sentence or paragraph boundaries. Simple and predictable, but can cut a sentence — or a word — in half.

```typescript
import { FixedSizeChunker } from '@amjadkhan-dev/ragify';

const chunker = new FixedSizeChunker();
const chunks = chunker.chunk(document, { chunkSize: 500, chunkOverlap: 50 });
```

**When to use:** quick prototyping, or content where sentence boundaries genuinely don't matter (e.g. structured logs, code).

### `RecursiveChunker` (recommended default)

Tries to split on natural boundaries in priority order — paragraph breaks, then line breaks, then sentence endings, then word boundaries — only falling back to a hard character split as an absolute last resort. Small adjacent pieces are merged back up toward `chunkSize`, carrying `chunkOverlap` characters from the end of one chunk into the start of the next.

```typescript
import { RecursiveChunker } from '@amjadkhan-dev/ragify';

const chunker = new RecursiveChunker();
const chunks = chunker.chunk(document, {
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '. ', ' ', ''], // optional, this is the default priority order
});
```

**When to use:** almost always — this is the better default for real prose/document content, since it avoids severing sentences mid-thought, which directly improves retrieval and generation quality.

---

## 7. Embedders

### `Embedder` interface

```typescript
interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
```

All real (non-mock) embedders include automatic retry-with-exponential-backoff and request batching internally — you never need to implement rate-limit handling yourself.

### `MockEmbedder`

```typescript
import { MockEmbedder } from '@amjadkhan-dev/ragify';
const embedder = new MockEmbedder();
```

No options, no API key, no network calls. `dimensions = 8`. Produces deterministic vectors from a character-hash of the input text — **not semantically meaningful**. Use only for testing the plumbing of your pipeline, never in production, since it cannot actually judge meaning or relevance.

### `GeminiEmbedder`

```typescript
import { GeminiEmbedder } from '@amjadkhan-dev/ragify';

const embedder = new GeminiEmbedder({
  apiKey: 'your-key',            // optional — defaults to process.env.GEMINI_API_KEY
  model: 'text-embedding-004',   // optional — defaults to process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004'
  batchSize: 100,                // optional — texts per internal batch
  dimensions: 768,               // optional — MUST match your actual model's real output size (see note below)
});
```

**Getting an API key (free tier):** https://aistudio.google.com/apikey — no credit card required for the free tier.

**⚠️ Important — dimension varies by model.** Different Gemini embedding models output different vector sizes:
- `text-embedding-004` → 768 dimensions
- `gemini-embedding-001` → 3072 dimensions by default (some preview models too)
- `gemini-embedding-2-preview` → 3072 dimensions

The `dimensions` constructor option is **not automatically verified against the real API response** — if you set it incorrectly, or leave the default while using a model with a different real output size, you won't see an error from `GeminiEmbedder` itself; you'll only find out when your vector store rejects the upsert due to a dimension mismatch (see [§18 Troubleshooting](#18-troubleshooting)). Always check your specific model's actual output dimension in Google's docs and set `dimensions` (and your vector store's index dimension) to match exactly.

Requires `@google/generative-ai` installed.

### `OpenAIEmbedder`

```typescript
import { OpenAIEmbedder } from '@amjadkhan-dev/ragify';

const embedder = new OpenAIEmbedder({
  apiKey: 'your-key',                 // optional — defaults to process.env.OPENAI_API_KEY
  model: 'text-embedding-3-small',    // optional — default shown
  batchSize: 100,                     // optional
});
```

`dimensions` is derived automatically: 1536 for `text-embedding-3-small`, 3072 for `text-embedding-3-large`.

Requires `openai` installed. OpenAI embeddings are **paid** (no free tier) — billed per your OpenAI account.

---

## 8. Vector Stores — Full Setup Guides

Every vector store implements this interface:

```typescript
interface VectorStore {
  upsert(chunks: Chunk[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
}
```

### 8.1 `InMemoryVectorStore` — zero setup

```typescript
import { InMemoryVectorStore } from '@amjadkhan-dev/ragify';
const vectorStore = new InMemoryVectorStore();
```

No account, no config, no options. Stores everything in a JavaScript `Map` in the current process — **data is lost when the process exits**. Cosine similarity search.

**Use for:** local development, testing, short-lived scripts. **Do not use for:** anything that needs to persist data or scale beyond a single process's memory.

---

### 8.2 `PineconeVectorStore` — managed cloud, free tier

**Full setup, from zero:**

1. Sign up free at https://app.pinecone.io — no credit card required for the free tier.
2. Create a new index. **Critical step — choose the right creation flow:**
   - Pinecone's UI offers two paths: **"Pinecone-hosted model"** (an integrated embedding model, with a dimension *dropdown* limited to fixed values like 1024/2048/768/512/384) and **"Custom"** / **bring-your-own-vectors** (a plain numeric *input field* for dimension).
   - You want **Custom** — because Ragify generates embeddings itself (via `GeminiEmbedder`/`OpenAIEmbedder`), Pinecone should just store and search vectors you provide, not generate its own.
   - If you only see the dropdown with fixed values, you're on the wrong creation path — look for a toggle near the top of the creation flow, or an earlier step asking "How do you want to add data?" and choose "I have my own vectors."
3. Set the index's dimension to **exactly match your embedder's real output size** (see §7 for how this varies by model — this is the single most common setup error, covered in detail in §18).
4. Metric: `cosine`.
5. Copy your API key from the Pinecone dashboard.

**Environment variables:**
```
PINECONE_API_KEY=your-real-key-here
PINECONE_INDEX_NAME=your-index-name
```

**Usage:**
```typescript
import { PineconeVectorStore } from '@amjadkhan-dev/ragify';

const vectorStore = new PineconeVectorStore({
  apiKey: process.env.PINECONE_API_KEY,       // optional, this is the default source
  indexName: process.env.PINECONE_INDEX_NAME, // optional, this is the default source
  namespace: 'my-namespace',                   // optional — isolate data within one index
});
```

**Internal implementation notes** (relevant if you hit errors, or are on a different SDK major version):
- Requires `@pinecone-database/pinecone`, tested and built against **v8.x**.
- Content and metadata are stored in Pinecone's `metadata` field (Pinecone itself only natively stores vectors + metadata, not a first-class "text" field) and reconstructed into a `Chunk` shape when you query.
- The v8 SDK requires `upsert({ records: [...] })` — a wrapped object, not a bare array (this changed from earlier SDK versions).
- The v8 SDK removed legacy string-based index targeting (`pc.index('name')`); this adapter resolves the index host via `describeIndex()` first, then targets it by host.

---

### 8.3 `ChromaVectorStore` — open-source, self-hosted or cloud

Two connection modes, pick one:

**Option A — Self-hosted (local, via Docker):**
```bash
docker run -p 8000:8000 chromadb/chroma
```
```
CHROMA_PATH=http://localhost:8000
```

**Option B — Chroma Cloud (managed, free starter credits, no local server needed):**
1. Sign up free at https://trychroma.com/cloud
2. Create a database, grab your API key, tenant ID, and database name from the dashboard.
```
CHROMA_API_KEY=ck-your-key
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database-name
```

**Usage** (auto-detects mode based on whether `apiKey` is present):
```typescript
import { ChromaVectorStore } from '@amjadkhan-dev/ragify';

const vectorStore = new ChromaVectorStore({
  collectionName: 'my-collection', // optional, default: 'ragify-collection'
  // self-hosted:
  path: process.env.CHROMA_PATH,
  // OR Chroma Cloud:
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE,
});
```

**Internal implementation notes:**
- Requires `chromadb` (v3 client) installed.
- The collection is created automatically on first use, with `hnsw:space: cosine` set explicitly — Chroma defaults to L2 distance otherwise, which would make scores incomparable to the other vector store adapters in this package.
- **Chroma's metadata only supports flat string/number/boolean values.** If a `chunk.metadata` field contains a nested object or array, it is silently dropped (not stored, not errored) when upserting into Chroma specifically — this is a Chroma limitation, not a Ragify bug. Keep metadata flat if you need it preserved.

---

### 8.4 `QdrantVectorStore` — open-source, self-hosted or cloud

Two connection modes, pick one:

**Option A — Self-hosted (local, via Docker):**
```bash
docker run -p 6333:6333 qdrant/qdrant
```
```
QDRANT_URL=http://localhost:6333
```

**Option B — Qdrant Cloud (managed, free tier cluster):**
1. Sign up free at https://cloud.qdrant.io
2. Create a free cluster, grab the cluster URL and API key.
```
QDRANT_URL=https://your-cluster-id.your-region.aws.cloud.qdrant.io
QDRANT_API_KEY=your-api-key
```

**Usage:**
```typescript
import { QdrantVectorStore } from '@amjadkhan-dev/ragify';

const vectorStore = new QdrantVectorStore({
  url: process.env.QDRANT_URL,          // required (constructor throws without it)
  apiKey: process.env.QDRANT_API_KEY,    // optional (needed for Cloud, not for local)
  collectionName: 'my-collection',       // optional, default: 'ragify-collection'
  dimensions: 768,                       // optional — inferred automatically from the first embedding if omitted
});
```

**Internal implementation notes:**
- Requires `@qdrant/js-client-rest` installed.
- The collection is **auto-created on first use** — unlike Pinecone, you do not need to manually create it in a dashboard first. Dimension is inferred from the actual embedding vector's length if you don't pass `dimensions` explicitly.
- Uses the current, non-deprecated `.query()` method internally (not the older `.search()` method).
- **Qdrant only accepts unsigned integers or UUIDs as point IDs** — it rejects arbitrary strings like `doc1-chunk-0`, which is what Ragify's chunkers normally produce. This adapter automatically maps every chunk ID to a **deterministic UUID** internally (same input string always produces the same UUID, so re-indexing a chunk overwrites rather than duplicates it) and stores your original chunk ID in the payload, restoring it correctly on query. You never need to think about this — it's fully transparent — but it's worth knowing about if you inspect Qdrant's dashboard directly and see UUIDs instead of your original chunk IDs.

---

### 8.5 Choosing a vector store

| Store | Setup effort | Persistence | Cost | Best for |
|---|---|---|---|---|
| `InMemoryVectorStore` | None | ❌ Lost on exit | Free | Local dev, testing, short scripts |
| `PineconeVectorStore` | Medium (manual index + dimension setup) | ✅ | Free tier | Managed production, simplest ops |
| `ChromaVectorStore` | Low–Medium (Docker or Cloud signup) | ✅ | Free (self-hosted) / free tier (Cloud) | Open-source preference, local-first dev |
| `QdrantVectorStore` | Low (auto-creates collection) | ✅ | Free (self-hosted) / free tier (Cloud) | Least manual setup among the persistent options |

---

## 9. Retrieval Strategies

### `Retriever` interface

```typescript
interface Retriever {
  index(chunks: Chunk[]): Promise<void> | void;
  retrieve(query: string, topK: number): Promise<VectorSearchResult[]>;
}
```

If no `retriever` is configured in `RagifyConfig`, `RagifyPipeline` falls back to a plain embed-and-query against `vectorStore` directly — this is fine for many use cases, and you don't need a `Retriever` at all unless you want hybrid search.

### `BM25Retriever`

Pure keyword-statistics retrieval — no embeddings, no network calls, catches exact terms and rare keywords that dense embedding search can blur together (e.g. product codes, exact names, technical jargon).

```typescript
import { BM25Retriever } from '@amjadkhan-dev/ragify';

const bm25 = new BM25Retriever({ k1: 1.5, b: 0.75 }); // both optional, these are the defaults
```
Rarely used standalone in `RagifyConfig` — usually consumed internally by `HybridRetriever` instead.

### `HybridRetriever` (recommended for production)

Combines dense (vector similarity via your `embedder` + `vectorStore`) and sparse (BM25 keyword) search, fused using **Reciprocal Rank Fusion** — a chunk that ranks well in *both* dense and sparse search naturally floats to the top, giving you the best of semantic understanding and exact-keyword precision.

```typescript
import { HybridRetriever, RagifyPipeline } from '@amjadkhan-dev/ragify';

const retriever = new HybridRetriever(vectorStore, embedder, {
  rrfK: 60, // optional — higher = less aggressive fusion weighting, 60 is a well-established default
});

const pipeline = new RagifyPipeline({
  chunker,
  embedder,
  vectorStore,
  retriever, // pipeline.query() and pipeline.generate() now use hybrid search automatically
});
```

**When to use:** almost always for production RAG — hybrid search consistently outperforms either dense-only or sparse-only retrieval on real-world queries.

---

## 10. LLM Wrappers (Generation)

### `LLMWrapper` interface

```typescript
interface LLMWrapper {
  generate(prompt: string, context?: string[]): Promise<string>;
}
```

When `context` is provided, both built-in wrappers instruct the model to answer **only** from that context, and to honestly say so if the context doesn't contain the answer — reducing hallucination by default. When `context` is omitted, it's a normal, ungrounded generation call (see [§13](#13-using-components-standalone-without-the-pipeline) for standalone usage without RAG at all).

### `GroqLLM`

```typescript
import { GroqLLM } from '@amjadkhan-dev/ragify';

const llm = new GroqLLM({
  apiKey: 'your-key',                       // optional — defaults to process.env.GROQ_API_KEY
  model: 'llama-3.3-70b-versatile',         // optional — defaults to process.env.GROQ_MODEL ?? this value
  temperature: 0.3,                          // optional — lower = more focused/deterministic
});
```

**Getting an API key (free tier):** https://console.groq.com/keys — free, fast inference, no credit card required for the free tier. Requires `groq-sdk` installed.

### `GeminiLLM`

```typescript
import { GeminiLLM } from '@amjadkhan-dev/ragify';

const llm = new GeminiLLM({
  apiKey: 'your-key',                // optional — defaults to process.env.GEMINI_API_KEY
  model: 'gemini-1.5-flash',         // optional — defaults to process.env.GEMINI_LLM_MODEL ?? this value
});
```

Same API key as `GeminiEmbedder` (https://aistudio.google.com/apikey). Requires `@google/generative-ai` installed.

---

## 11. Re-ranking

Re-ranking runs *after* retrieval to reorder the top candidates using a more precise (but more expensive) relevance judgment than embeddings or BM25 alone provide.

### `Reranker` interface

```typescript
interface Reranker {
  rerank(query: string, results: VectorSearchResult[], topK: number): Promise<VectorSearchResult[]>;
}
```

### `LLMReranker`

Reuses your existing `GroqLLM`/`GeminiLLM` wrapper — no dedicated re-ranking API or extra cost/dependency needed. Scores each candidate 0–10 for relevance to the query, in concurrent batches, then re-sorts.

```typescript
import { LLMReranker, RagifyPipeline } from '@amjadkhan-dev/ragify';

const pipeline = new RagifyPipeline({
  chunker,
  embedder,
  vectorStore,
  reranker: new LLMReranker(new GroqLLM(), {
    concurrency: 5, // optional — how many candidates to score simultaneously
  }),
});
```

**Cost/latency note:** re-ranking makes one extra LLM call per candidate scored. `RagifyPipeline` automatically over-fetches `topK * 3` candidates before re-ranking down, to give the re-ranker real room to improve on the initial ranking — reasonable for `topK` in the 3–10 range. If a candidate's LLM response can't be parsed as a number, that candidate silently falls back to its original retrieval score rather than breaking the whole re-rank.

**When to use:** when retrieval precision genuinely matters more than latency/cost — e.g. a support bot answering from a large knowledge base, where surfacing the *exact right* passage matters more than shaving off a few hundred milliseconds.

---

## 12. Caching

Avoids re-embedding unchanged content, keyed by a hash of the chunk's content (salted with the embedder's class name, so switching providers never returns a stale, wrong-provider vector).

### `EmbeddingCache` interface

```typescript
interface EmbeddingCache {
  get(key: string): Promise<number[] | undefined> | number[] | undefined;
  set(key: string, embedding: number[]): Promise<void> | void;
}
```

### `InMemoryCache`

```typescript
import { InMemoryCache } from '@amjadkhan-dev/ragify';
const cache = new InMemoryCache();
```
No options. Fast, but cleared when the process exits — only useful within a single long-running process (e.g. a server), not across separate script runs.

### `FileCache`

```typescript
import { FileCache } from '@amjadkhan-dev/ragify';
const cache = new FileCache({ filePath: '.ragify-cache.json' }); // optional, this is the default
```
Persists to a JSON file on disk — survives across separate script runs, which is where the real cost savings show up during development (re-running the same ingestion script twice only embeds once). Rewrites the entire file on every `set()` call — fine for development or moderate-scale use, not designed for high-throughput production write patterns.

**Usage in the pipeline:**
```typescript
const pipeline = new RagifyPipeline({
  chunker,
  embedder,
  vectorStore,
  cache: new FileCache(),
});
```
Remember to add your cache file to `.gitignore` if using `FileCache` — it's generated local data, not something to commit.

---

## 13. Using Components Standalone (Without the Pipeline)

**Every adapter in Ragify works independently** — you are not required to use `RagifyPipeline` at all if you only need one piece of functionality.

### Just want text generation, no RAG at all?

```typescript
import { GroqLLM } from '@amjadkhan-dev/ragify';

const llm = new GroqLLM();
const answer = await llm.generate('What is the capital of France?');
console.log(answer);
```
No documents, no chunking, no embedding, no vector store — this is a complete, working LLM call, functionally equivalent to calling the Groq API directly, but with Ragify's built-in retry/backoff handling.

### Just want embeddings, without storing/searching them?

```typescript
import { GeminiEmbedder } from '@amjadkhan-dev/ragify';

const embedder = new GeminiEmbedder();
const vectors = await embedder.embed(['some text', 'more text']);
console.log(vectors); // number[][]
```

### Just want to chunk text, without embedding it?

```typescript
import { RecursiveChunker } from '@amjadkhan-dev/ragify';

const chunker = new RecursiveChunker();
const chunks = chunker.chunk({ id: 'doc1', content: 'A long document...' }, { chunkSize: 500 });
```

### Just want to store/search vectors you've already generated elsewhere?

```typescript
import { QdrantVectorStore } from '@amjadkhan-dev/ragify';

const vectorStore = new QdrantVectorStore({ url: process.env.QDRANT_URL });
await vectorStore.upsert([
  { id: 'c1', content: 'text', documentId: 'd1', embedding: [/* your own vector */] },
]);
const results = await vectorStore.query([/* query vector */], 5);
```

This modularity is deliberate — adopt only the pieces you actually need rather than buying into the whole framework at once.

---

## 14. Complete Configuration Reference

```typescript
interface RagifyConfig {
  chunker: Chunker;              // required
  embedder: Embedder;            // required
  vectorStore: VectorStore;      // required
  retriever?: Retriever;         // optional — enables hybrid/custom retrieval
  llm?: LLMWrapper;              // optional — required only to use .generate()
  cache?: EmbeddingCache;        // optional — enables embedding caching
  reranker?: Reranker;           // optional — enables re-ranking on query()/generate()
}

interface RagifyDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface Chunk {
  id: string;
  content: string;
  documentId: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

interface VectorSearchResult {
  chunk: Chunk;
  score: number; // higher = more relevant, consistent across all vector store adapters
}
```

---

## 15. Environment Variables — Full Reference

```bash
# ── Gemini (embeddings + generation) ──────────────────────────
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=        # optional, defaults to text-embedding-004
GEMINI_LLM_MODEL=              # optional, defaults to gemini-1.5-flash

# ── Groq (generation) ──────────────────────────────────────────
GROQ_API_KEY=
GROQ_MODEL=                    # optional, defaults to llama-3.3-70b-versatile

# ── OpenAI (embeddings) ────────────────────────────────────────
OPENAI_API_KEY=

# ── Pinecone ───────────────────────────────────────────────────
PINECONE_API_KEY=
PINECONE_INDEX_NAME=

# ── Chroma — self-hosted OR Chroma Cloud, choose one ───────────
CHROMA_PATH=                   # self-hosted, e.g. http://localhost:8000
CHROMA_API_KEY=                # Chroma Cloud
CHROMA_TENANT=                 # Chroma Cloud
CHROMA_DATABASE=               # Chroma Cloud

# ── Qdrant ─────────────────────────────────────────────────────
QDRANT_URL=                    # required if using QdrantVectorStore
QDRANT_API_KEY=                # required for Qdrant Cloud, omit for local
```

Every constructor option can also be passed explicitly in code instead of via environment variable — explicit constructor options always take priority over environment variables, which take priority over hardcoded defaults.

---

## 16. Error Handling

Ragify throws descriptive `Error`s rather than failing silently or with opaque stack traces.

| Error message | Cause | Fix |
|---|---|---|
| `<Provider> API key missing...` | No API key passed or set in env | Pass `apiKey` in constructor options, or set the relevant env var |
| `Missing optional dependency "X". Install it with: npm install X` | Using an adapter without installing its peer SDK | Run the exact `npm install` command shown |
| `Chunk <id> has no embedding — embed before upserting.` | Calling `vectorStore.upsert()` directly with unembedded chunks | Use `pipeline.addDocuments()` (embeds automatically), or call `embedder.embed()` yourself first |
| `No LLM configured. Pass an llm...` | Calling `.generate()` without an `llm` in config | Add `llm: new GroqLLM()` (or `GeminiLLM`) to `RagifyConfig` |
| `Qdrant URL missing...` | No `url` passed or `QDRANT_URL` set | Pass `url` explicitly or set the env var |
| `Pinecone index name missing...` | No `indexName` passed or `PINECONE_INDEX_NAME` set | Pass `indexName` explicitly or set the env var |

All network-calling adapters (embedders, LLMs, vector stores) retry transient failures automatically — 3 attempts with exponential backoff — before throwing.

---

## 17. Extending Ragify — Writing Custom Adapters

Every component is just a TypeScript interface. Implement it to plug in a provider Ragify doesn't ship out of the box.

### Custom embedder

```typescript
import type { Embedder } from '@amjadkhan-dev/ragify';

class MyCustomEmbedder implements Embedder {
  readonly dimensions = 512;

  async embed(texts: string[]): Promise<number[][]> {
    // call your own embedding service, return one vector per input text
    return texts.map((t) => myEmbeddingService.embed(t));
  }
}
```

### Custom vector store

```typescript
import type { VectorStore, VectorSearchResult, Chunk } from '@amjadkhan-dev/ragify';

class MyCustomVectorStore implements VectorStore {
  async upsert(chunks: Chunk[]): Promise<void> { /* ... */ }
  async query(embedding: number[], topK: number): Promise<VectorSearchResult[]> { /* ... */ }
  async delete(ids: string[]): Promise<void> { /* ... */ }
}
```

### Custom chunker

```typescript
import type { Chunker, ChunkerOptions, RagifyDocument, Chunk } from '@amjadkhan-dev/ragify';

class MyCustomChunker implements Chunker {
  chunk(document: RagifyDocument, options?: ChunkerOptions): Chunk[] {
    // your splitting logic
  }
}
```

### Custom LLM wrapper

```typescript
import type { LLMWrapper } from '@amjadkhan-dev/ragify';

class MyCustomLLM implements LLMWrapper {
  async generate(prompt: string, context?: string[]): Promise<string> {
    // call your own LLM API
  }
}
```

The same pattern applies to `Retriever`, `EmbeddingCache`, and `Reranker` — implement the interface, pass an instance into `RagifyConfig`, and `RagifyPipeline` uses it exactly like a built-in adapter, since it only ever talks to these interfaces, never to a specific provider's SDK directly.

---

## 18. Troubleshooting

### "Vector dimension X does not match the dimension of the index Y" (Pinecone)

Your vector store's index was created with a fixed dimension that doesn't match your embedder's actual output size. This is the single most common setup error.

**Fix:** Check your embedder's real output dimension (see §7 — this varies by specific model, not just by provider), then either:
- Recreate the Pinecone index with the correct dimension, or
- If using Gemini's newer models with `outputDimensionality` truncation support, configure the embedder to truncate to match your existing index (requires passing that option through — not enabled by default in this package as of the current version).

### "Must pass in at least 1 record to upsert" (Pinecone) despite having real data

Almost always an SDK version mismatch — this specific error appears when a newer Pinecone SDK major version's `upsert()` call signature has changed. This package's `PineconeVectorStore` is built for SDK v8.x's `{ records: [...] }` format. If you're on a different major version, check Pinecone's changelog for that version's `upsert()` signature.

### "value X is not a valid point ID, valid values are either an unsigned integer or a UUID" (Qdrant)

You should not see this from `QdrantVectorStore` — the built-in adapter handles ID mapping internally (see §8.4). If you see this, you're likely calling Qdrant's own SDK directly with raw Ragify chunk IDs rather than going through `QdrantVectorStore`.

### Chroma metadata fields missing after upsert

Chroma only supports flat string/number/boolean metadata values. Nested objects/arrays in `chunk.metadata` are silently dropped when using `ChromaVectorStore` specifically (not a bug — a Chroma platform limitation). Flatten your metadata before passing it in if you need those fields preserved.

### `vi.fn()` / mock-related errors when writing your own tests against Ragify

If you're writing tests that mock a provider SDK Ragify calls internally (e.g. mocking `groq-sdk` in your own app's tests), remember that classes instantiated with `new` cannot be arrow functions in JavaScript. Use `vi.fn().mockImplementation(function (this: any) { ... })`, not an arrow function, when mocking any SDK client class.

### Slow re-ranking, or hitting provider rate limits during re-rank

Lower `LLMReranker`'s `concurrency` option (default 5), or reduce `topK` — re-ranking cost/latency scales roughly linearly with the number of candidates scored.

### `SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'`

This means you're running on Node 18 or earlier. Several of Ragify's dev/test tooling dependencies require Node ≥ 20. Upgrade your Node version.

### `TypeError: () => (...) is not a constructor` in your own mocked tests

Same root cause as the `vi.fn()` note above — you mocked a class-like export with an arrow function. Arrow functions cannot be used with `new`. Switch to a `function` declaration in the mock.

---

## 19. Compatibility

| | Supported |
|---|---|
| Node.js | ≥ 20.0.0 |
| Module formats | ESM and CommonJS (dual build — `import` and `require` both work) |
| TypeScript | ≥ 5.0 (ships its own `.d.ts`; also works fine from plain JavaScript) |
| Operating systems | Cross-platform (developed and tested on Windows/PowerShell, Linux CI via GitHub Actions on Node 20 & 22) |

---

## 20. End-to-End Example: Production RAG App

A complete, realistic setup combining hybrid retrieval, caching, and re-ranking:

```typescript
import 'dotenv/config';
import {
  RagifyPipeline,
  RecursiveChunker,
  QdrantVectorStore,
  GeminiEmbedder,
  GroqLLM,
  HybridRetriever,
  FileCache,
  LLMReranker,
} from '@amjadkhan-dev/ragify';

// Shared instances — embedder and vectorStore are reused by both the pipeline and the retriever
const embedder = new GeminiEmbedder();
const vectorStore = new QdrantVectorStore({ url: process.env.QDRANT_URL });
const llm = new GroqLLM();

const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder,
  vectorStore,
  llm,
  retriever: new HybridRetriever(vectorStore, embedder),
  cache: new FileCache(),
  reranker: new LLMReranker(llm),
});

// Ingest once — re-running this with the same content will skip re-embedding thanks to the cache
await pipeline.addDocuments([
  { id: 'faq-1', content: 'To reset your password, go to Settings > Security...', metadata: { category: 'account' } },
  { id: 'faq-2', content: 'Refunds are processed within 5-7 business days...', metadata: { category: 'billing' } },
  // ... more documents
]);

// Query with the full pipeline: hybrid retrieval -> re-ranking -> grounded generation
const answer = await pipeline.generate('How long do refunds take?');
console.log(answer);
```

---

## 21. FAQ

**Do I have to use all seven config options?**
No — only `chunker`, `embedder`, and `vectorStore` are required. Everything else (`retriever`, `llm`, `cache`, `reranker`) is optional and additive.

**Can I mix providers — e.g. Gemini for embeddings, Groq for generation?**
Yes, this is the normal/expected usage pattern, not an edge case. Every adapter is independent.

**Does Ragify support streaming responses from the LLM?**
Not currently — `LLMWrapper.generate()` returns a complete string, not a stream. This is a known gap for a future version.

**Can I use Ragify from plain JavaScript, not TypeScript?**
Yes — it's fully usable from JS; TypeScript just gets full autocomplete/type-checking for free via the shipped `.d.ts` files.

**What happens if I call `pipeline.query()` before calling `addDocuments()`?**
You'll get an empty results array (or an error from some vector stores if the collection/index doesn't exist yet) — there's nothing indexed to search.

**Is my data sent anywhere by Ragify itself?**
No — Ragify only makes network calls to the specific provider SDKs you configure (e.g. Gemini's API when you use `GeminiEmbedder`). It has no telemetry or third-party calls of its own.

---

## 22. Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, coding conventions, and how to add a new adapter.

---

## 23. License

MIT © [Amjad Ullah](https://github.com/AmjadKhan88)