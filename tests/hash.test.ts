import { describe, it, expect } from 'vitest';
import { hashContent } from '../src/utils/hash.js';

describe('hashContent', () => {
  it('produces the same hash for identical input', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'));
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('hello')).not.toBe(hashContent('world'));
  });

  it('produces different hashes with different salts', () => {
    expect(hashContent('hello', 'A')).not.toBe(hashContent('hello', 'B'));
  });
});