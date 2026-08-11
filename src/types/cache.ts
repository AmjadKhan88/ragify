export interface EmbeddingCache {
  get(key: string): Promise<number[] | undefined> | number[] | undefined;
  set(key: string, embedding: number[]): Promise<void> | void;
}