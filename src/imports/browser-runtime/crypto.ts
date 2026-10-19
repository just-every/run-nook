import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';
import { md5 } from '@noble/hashes/legacy.js';

/** Same synchronous digest bytes as the Node readers, including Campfire's
 * original MD5 blob checksum. No source identity is recalculated differently. */
export function createHash(algorithm: string) {
  const hash = algorithm === 'sha256' ? sha256.create() : algorithm === 'md5' ? md5.create() : undefined;
  if (!hash) throw new Error('Unsupported import digest');
  const result = {
    update(value: string | Uint8Array) {
      hash.update(typeof value === 'string' ? new TextEncoder().encode(value) : value);
      return result;
    },
    digest(encoding?: 'hex' | 'base64') {
      const bytes = Buffer.from(hash.digest());
      return encoding ? bytes.toString(encoding) : bytes;
    },
  };
  return result;
}
