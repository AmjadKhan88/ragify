# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.1] — Unreleased

### Changed
- Comprehensive README rewrite: full vector DB setup guides (Pinecone, Chroma, Qdrant), troubleshooting section, standalone usage guide, custom adapter extension guide, FAQ

## [0.1.0] — Published

### Added
- Core pipeline: `RagifyPipeline` with `addDocuments`, `query`, `generate`
- Chunkers: `FixedSizeChunker`, `RecursiveChunker`
- Embedders: `MockEmbedder`, `GeminiEmbedder`, `OpenAIEmbedder`
- Vector stores: `InMemoryVectorStore`, `PineconeVectorStore`, `ChromaVectorStore`, `QdrantVectorStore`
- Retrieval: `BM25Retriever`, `HybridRetriever` (Reciprocal Rank Fusion)
- LLM wrappers: `GroqLLM`, `GeminiLLM`
- `LLMReranker` for precision re-ranking
- `InMemoryCache`, `FileCache` for embedding caching
- Optional peer dependencies with lazy dynamic imports for all provider SDKs
- GitHub Actions CI (Node 20/22 matrix)