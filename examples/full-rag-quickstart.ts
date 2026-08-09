import 'dotenv/config';
import {
  RagifyPipeline,
  FixedSizeChunker,
  InMemoryVectorStore,
  GeminiEmbedder,
  GroqLLM,
} from '../src/index.js';

async function main() {
  const pipeline = new RagifyPipeline({
    chunker: new FixedSizeChunker(),
    embedder: new GeminiEmbedder(),
    vectorStore: new InMemoryVectorStore(),
    llm: new GroqLLM(),
  });

  await pipeline.addDocuments([
    {
      id: 'doc1',
      content:
        'Node.js is a JavaScript runtime built on Chrome\'s V8 engine. It uses an event-driven, non-blocking I/O model, which makes it lightweight and efficient for building scalable network applications.',
    },
    {
      id: 'doc2',
      content: 'Bananas are a great source of potassium and contain about 105 calories each.',
    },
  ]);

  const answer = await pipeline.generate('What makes Node.js efficient for scalable applications?');
  console.log('Answer:', answer);
}

main().catch(console.error);