import { createHash } from 'node:crypto';

/**
 * Deterministically derives a valid UUID from an arbitrary string.
 * Same input always produces the same UUID — needed because Qdrant only
 * accepts unsigned integers or UUIDs as point IDs, unlike other vector stores.
 */
export function toDeterministicUuid(input: string): string {
  const hashHex = createHash('sha256').update(input).digest('hex').slice(0, 32); // 16 bytes as hex

  const bytes = hashHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}