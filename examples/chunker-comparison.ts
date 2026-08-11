import { FixedSizeChunker, RecursiveChunker } from '../src/index.js';

const doc = {
  id: 'doc1',
  content:
    'Node.js is a JavaScript runtime built on Chrome\'s V8 engine. It uses an event-driven, non-blocking I/O model.\n\nThis makes it lightweight and efficient for building scalable network applications. Many companies use it in production.',
};

const fixed = new FixedSizeChunker().chunk(doc, { chunkSize: 100, chunkOverlap: 10 });
const recursive = new RecursiveChunker().chunk(doc, { chunkSize: 100, chunkOverlap: 10 });

console.log('--- FixedSizeChunker ---');
fixed.forEach((c) => console.log(JSON.stringify(c.content)));

console.log('\n--- RecursiveChunker ---');
recursive.forEach((c) => console.log(JSON.stringify(c.content)));