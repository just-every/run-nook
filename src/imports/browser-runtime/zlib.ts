import { Buffer } from 'buffer';
import { Inflate } from 'pako';

/** Preserve Node's consumed-input count: the real ZIP/gzip readers use it to
 * reject trailing compressed bytes. Stop before a bomb accumulates in memory. */
export function inflateRawSync(input: Uint8Array, options: { maxOutputLength?: number; info?: boolean } = {}) {
  const limit = options.maxOutputLength ?? 64 * 1024 * 1024;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid inflate limit');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stream = new Inflate({ raw: true, chunkSize: Math.min(65536, limit + 1) });
  stream.onData = (chunk: Uint8Array) => {
    size += chunk.length;
    if (size > limit) throw new Error('Inflated data exceeds import limit');
    chunks.push(chunk);
  };
  if (!stream.push(input, true) || stream.err || !stream.ended) throw new Error('Invalid deflate stream');
  const buffer = Buffer.concat(chunks, size);
  return options.info ? { buffer, engine: { bytesWritten: stream.strm.total_in } } : buffer;
}
