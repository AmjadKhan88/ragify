import { createHash } from 'node:crypto';

export function hashContent(content: string, salt = ''): string {
  return createHash('sha256').update(salt + content).digest('hex');
}