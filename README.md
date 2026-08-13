# Ragify

[![CI](https://github.com/AmjadKhan88/Ragify/actions/workflows/ci.yml/badge.svg)](https://github.com/AmjadKhan88/Ragify/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amjadkhan-dev/ragify.svg)](https://www.npmjs.com/package/@amjadkhan-dev/ragify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

> Unified RAG Pipeline Builder for Node.js — eliminate the repetitive boilerplate of chunking, embedding, retrieval, and vector storage behind one clean, swappable API.

Ragify gives you a single, cohesive interface to manage the entire Retrieval-Augmented Generation workflow — from document ingestion to grounded answer generation — without hand-wiring five different SDKs every time you start a new RAG project.

**Full API reference:** [docs/API.md](./docs/API.md)

---

## Table of Contents

- [Why Ragify](#why-ragify)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Chunkers](#chunkers)
- [Embedders](#embedders)
- [Vector Stores](#vector-stores)
- [Hybrid Retrieval](#hybrid-retrieval)
- [Re-ranking](#re-ranking)
- [Caching](#caching)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)
- [Extending Ragify](#extending-ragify)
- [Troubleshooting](#troubleshooting)
- [Compatibility](#compatibility)
- [Contributing](#contributing)
- [License](#license)

---

## Why Ragify

Most RAG tutorials wire one embedding API directly to one vector store. The moment you want to swap providers, add hybrid search, cache embeddings to cut API costs, or re-rank results — you're rewriting plumbing from scratch.

Ragify is built around one idea: **every stage of the pipeline is an interface, and every implementation is swappable**, without touching the rest of your code.

```typescript
const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder: new GeminiEmbedder(),        // swap for OpenAIEmbedder — nothing else changes
  vectorStore: new QdrantVectorStore(),  // swap for Pinecone, Chroma, InMemory — nothing else changes
  llm: new GroqLLM(),                    // swap for GeminiLLM — nothing else changes
});
```

## Features

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

## Installation

```bash
npm install @amjadkhan-dev/ragify
```

Ragify's provider SDKs are **optional peer dependencies** — install only what you use:

```bash
npm install @google/generative-ai       # GeminiEmbedder / GeminiLLM
npm install openai                      # OpenAIEmbedder
npm install groq-sdk                    # GroqLLM
npm install @pinecone-database/pinecone # PineconeVectorStore
npm install chromadb                    # ChromaVectorStore
npm install @qdrant/js-client-rest      # QdrantVectorStore
```

If you use a provider without installing its SDK, Ragify throws a clear error telling you exactly which package to install — it won't fail with a cryptic module-not-found error.

**Requirements:** Node.js ≥ 20.

## Quick Start

Zero API keys, zero cost — using the built-in mock embedder and in-memory store, useful for evaluating the API shape before committing to a real provider:

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

### Production example: real embeddings + grounded generation

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

### Full production example: hybrid retrieval + caching + re-ranking

```typescript
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

await pipeline.addDocuments(myDocuments);
const answer = await pipeline.generate('A specific, detailed question');
```

## Core Concepts

Ragify has six swappable component types, consumed through one `RagifyConfig` object passed to `RagifyPipeline`:

| Component | Interface | Required? | Purpose |
|---|---|---|---|
| `chunker` | `Chunker` | ✅ | Splits documents into indexable pieces |
| `embedder` | `Embedder` | ✅ | Converts text into vector embeddings |
| `vectorStore` | `VectorStore` | ✅ | Stores and searches embedded chunks |
| `retriever` | `Retriever` | optional | Custom retrieval strategy (e.g. hybrid search) |
| `llm` | `LLMWrapper` | optional | Generates answers from retrieved context — required for `.generate()` |
| `cache` | `EmbeddingCache` | optional | Skips re-embedding unchanged content |
| `reranker` | `Reranker` | optional | Reorders retrieved results for higher precision |

See [docs/API.md](./docs/API.md) for the full interface signatures and every implementation's constructor options.

## Chunkers

| Chunker | Strategy | Best for |
|---|---|---|
| `FixedSizeChunker` | Splits by raw character count with overlap | Simple, predictable chunk sizes |
| `RecursiveChunker` | Tries paragraph → sentence → word → character boundaries in priority order | Preserving semantic units; the recommended default |

```typescript
new RecursiveChunker().chunk(document, { chunkSize: 500, chunkOverlap: 50 });
```

## Embedders

| Embedder | Provider | Cost | Notes |
|---|---|---|---|
| `MockEmbedder` | none | Free | Deterministic hash-based vectors — dev/testing only, not semantically meaningful |
| `GeminiEmbedder` | Google Gemini | Free tier available | Model configurable via `GEMINI_EMBEDDING_MODEL` env var |
| `OpenAIEmbedder` | OpenAI | Paid | Default model: `text-embedding-3-small` |

All real embedders include automatic retry-with-backoff and request batching.

```typescript
new GeminiEmbedder({ model: 'text-embedding-004', batchSize: 100 });
```

## Vector Stores

| Store | Type | Notes |
|---|---|---|
| `InMemoryVectorStore` | In-process | No setup, doesn't persist across restarts — dev/testing |
| `PineconeVectorStore` | Managed cloud | Free tier available; requires pre-created index matching your embedder's dimension |
| `ChromaVectorStore` | Self-hosted or Chroma Cloud | Open-source; metadata values must be flat string/number/boolean |
| `QdrantVectorStore` | Self-hosted or Qdrant Cloud | Open-source; auto-creates its collection on first use |

```typescript
new QdrantVectorStore({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });
```

## Hybrid Retrieval

Combines dense (vector similarity) and sparse (BM25 keyword) search, fused via Reciprocal Rank Fusion — dense search catches semantic meaning, BM25 catches exact terms/rare keywords that embeddings often blur together.

```typescript
import { HybridRetriever } from '@amjadkhan-dev/ragify';

const retriever = new HybridRetriever(vectorStore, embedder);

const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder,
  vectorStore,
  retriever, // pipeline automatically uses this for query() and generate()
});
```

## Re-ranking

An LLM-based relevance judgment applied on top of retrieval to improve final precision — reuses your existing `GroqLLM`/`GeminiLLM` wrapper, no dedicated re-ranking API needed.

```typescript
import { LLMReranker } from '@amjadkhan-dev/ragify';

const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder,
  vectorStore,
  reranker: new LLMReranker(new GroqLLM()),
});
```

> **Cost note:** re-ranking makes one extra LLM call per candidate re-ranked. The pipeline automatically over-fetches (3× your requested `topK`) before re-ranking down — reasonable for `topK` in the 3–10 range, but be mindful of cost/latency if you push `topK` much higher.

## Caching

Avoids re-embedding unchanged content, keyed by content hash — a single-character edit only re-embeds the affected chunk, not the whole document.

```typescript
import { FileCache } from '@amjadkhan-dev/ragify';

const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder,
  vectorStore,
  cache: new FileCache({ filePath: '.ragify-cache.json' }), // or InMemoryCache()
});
```

`FileCache` persists to disk (survives process restarts); `InMemoryCache` is faster but scoped to the current process only.

## Error Handling

Ragify throws descriptive `Error`s rather than failing silently or with opaque stack traces. Common cases:

| Error | Cause | Fix |
|---|---|---|
| `<Provider> API key missing` | No API key passed or set in env | Pass `apiKey` in constructor options, or set the relevant env var |
| `Missing optional dependency "X"` | Using an adapter without installing its peer dependency | `npm install X` |
| `Chunk <id> has no embedding` | Calling `vectorStore.upsert()` directly with unembedded chunks | Use `pipeline.addDocuments()`, which embeds automatically, or embed chunks yourself first |
| `No LLM configured` | Calling `.generate()` without an `llm` in config | Pass `llm: new GroqLLM()` (or `GeminiLLM`) in `RagifyConfig` |

All network-calling adapters (embedders, LLMs, vector stores) retry transient failures automatically (3 attempts, exponential backoff) before throwing.

## Environment Variables

```bash
# Gemini (embeddings + generation)
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=       # optional, defaults to text-embedding-004
GEMINI_LLM_MODEL=             # optional, defaults to gemini-1.5-flash

# Groq (generation)
GROQ_API_KEY=
GROQ_MODEL=                   # optional, defaults to llama-3.3-70b-versatile

# OpenAI (embeddings)
OPENAI_API_KEY=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX_NAME=

# Chroma — either self-hosted OR Chroma Cloud, not both
CHROMA_PATH=                  # e.g. http://localhost:8000
CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=

# Qdrant
QDRANT_URL=
QDRANT_API_KEY=
```
See `.env.example` in the repo for a ready-to-copy template.

## Extending Ragify

Every component is just a TypeScript interface — implement it to plug in a provider Ragify doesn't ship out of the box:

```typescript
import type { Embedder } from '@amjadkhan-dev/ragify';

class MyCustomEmbedder implements Embedder {
  readonly dimensions = 512;
  async embed(texts: string[]): Promise<number[][]> {
    // call your own embedding service here
  }
}

const pipeline = new RagifyPipeline({
  chunker: new RecursiveChunker(),
  embedder: new MyCustomEmbedder(),
  vectorStore: new InMemoryVectorStore(),
});
```
The same applies to `Chunker`, `VectorStore`, `Retriever`, `LLMWrapper`, `EmbeddingCache`, and `Reranker` — see [docs/API.md](./docs/API.md) for each interface's exact method signatures.

## Troubleshooting

**"Vector dimension X does not match the dimension of the index Y"** (Pinecone) — your vector store's index was created with a fixed dimension that doesn't match your embedder's output size. Recreate the index with the correct dimension (768 for Gemini's `text-embedding-004`, 1536 for OpenAI's `text-embedding-3-small` — check your specific model if using a different one).

**Slow re-ranking / hitting rate limits** — lower `LLMReranker`'s `concurrency` option (default 5), or reduce `topK`.

**Chroma metadata missing fields** — Chroma only supports flat string/number/boolean metadata values; nested objects/arrays in `document.metadata` are silently dropped by `ChromaVectorStore`.

## Compatibility

| | Supported |
|---|---|
| Node.js | ≥ 20.0.0 |
| Module formats | ESM and CommonJS (dual build) |
| TypeScript | ≥ 5.0 (ships its own `.d.ts`, works from plain JS too) |

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, coding conventions, and how to add a new adapter.

## License

MIT © [Amjad Ullah](https://github.com/AmjadKhan88)