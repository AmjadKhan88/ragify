import 'dotenv/config';
import {
  RagifyPipeline,
  FixedSizeChunker,
  InMemoryVectorStore,
  GeminiEmbedder,
  GeminiLLM,
  LLMReranker,
} from '../src/index.js';

async function main() {
  const embedder = new GeminiEmbedder();
  const vectorStore = new InMemoryVectorStore();
  const llm = new GeminiLLM();

  const docs = [
    { id: 'd1', content: 'Python is a general-purpose programming language known for readability.' },
    { id: 'd2', content: 'Node.js uses an event loop to handle I/O without blocking the main thread.' },
    { id: 'd3', content: 'The event loop is the core mechanism that makes Node.js non-blocking.' },
  ];

  const withoutRerank = new RagifyPipeline({ chunker: new FixedSizeChunker(), embedder, vectorStore });
  await withoutRerank.addDocuments(docs);

  const plainResults = await withoutRerank.query('How does the event loop work in Node.js?', 2);
  console.log('Without reranking:', plainResults.map((r) => r.chunk.id));

  const withRerank = new RagifyPipeline({
    chunker: new FixedSizeChunker(),
    embedder,
    vectorStore,
    reranker: new LLMReranker(llm),
  });

  const rerankedResults = await withRerank.query('How does the event loop work in Node.js?', 2);
  console.log('With reranking:', rerankedResults.map((r) => r.chunk.id));
}

main().catch(console.error);