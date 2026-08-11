import 'dotenv/config';
import { RagifyPipeline, FixedSizeChunker, InMemoryVectorStore, GeminiEmbedder, FileCache } from '../src/index.js';

async function main() {
  const pipeline = new RagifyPipeline({
    chunker: new FixedSizeChunker(),
    embedder: new GeminiEmbedder(),
    vectorStore: new InMemoryVectorStore(),
    cache: new FileCache(),
  });

  console.time('first run');
  await pipeline.addDocuments([{ id: 'doc1', content: 'Node.js is a JavaScript runtime.' }]);
  console.timeEnd('first run');

  console.time('second run (should be near-instant, cached)');
  await pipeline.addDocuments([{ id: 'doc1', content: 'Node.js is a JavaScript runtime.' }]);
  console.timeEnd('second run (should be near-instant, cached)');
}

main().catch(console.error);