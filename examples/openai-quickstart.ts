import 'dotenv/config';
import { RagifyPipeline, FixedSizeChunker, InMemoryVectorStore, OpenAIEmbedder } from '../src/index.js';

async function main() {
  const pipeline = new RagifyPipeline({
    chunker: new FixedSizeChunker(),
    embedder: new OpenAIEmbedder(),
    vectorStore: new InMemoryVectorStore(),
  });

  await pipeline.addDocuments([
    { id: 'doc1', content: 'Node.js is a JavaScript runtime built on Chrome V8.' },
    { id: 'doc2', content: 'Bananas are a great source of potassium.' },
  ]);

  const results = await pipeline.query('Tell me about JavaScript runtimes');
  console.log(results.map((r) => ({ score: r.score, content: r.chunk.content })));
}

main().catch(console.error);