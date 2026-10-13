import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { strictJson } from './json.mjs';
export const ZIP_LIMITS = Object.freeze({ archive: 32 * 1024 * 1024, entry: 16 * 1024 * 1024, total: 64 * 1024 * 1024, entries: 5000, ratio: 200 });
const reject = reason => { throw new Error(`ZIP_REJECTED: ${reason}`); };
const decode = bytes => { try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
catch {
    reject('invalid UTF-8');
} };
const table = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++)
    n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
export function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes)
    crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonicalPath(path) {
    if (!path || path.length > 1024 || path !== path.normalize('NFC') || path !== path.normalize('NFKC') || /[\\\x00-\x1f\x7f:\p{Cf}]/u.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..' || p.endsWith('.') || p.endsWith(' ')))
        reject('unsafe or noncanonical path');
    return path;
}
function extras(bytes) { let p = 0; while (p < bytes.length) {
    if (p + 4 > bytes.length)
        reject('truncated extra');
    const id = bytes.readUInt16LE(p), length = bytes.readUInt16LE(p + 2);
    p += 4;
    if (p + length > bytes.length)
        reject('truncated extra');
    if ([1, 0x7075, 0x6375, 0x9901].includes(id))
        reject('ZIP64, alternate names or encryption');
    p += length;
} }
/** Memory-only bounded parser. No paths are extracted and no source URL is fetched. */
export function readSlackZip(input, limits = ZIP_LIMITS) {
    const zip = Buffer.from(input);
    if (zip.length > limits.archive || zip.length < 22)
        reject('archive size');
    let end = -1;
    for (let p = zip.length - 22; p >= Math.max(0, zip.length - 65557); p--)
        if (zip.readUInt32LE(p) === 0x06054b50 && p + 22 + zip.readUInt16LE(p + 20) === zip.length) {
            end = p;
            break;
        }
    if (end < 0)
        reject('missing directory');
    if (zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6))
        reject('multiple disks');
    const count = zip.readUInt16LE(end + 10), size = zip.readUInt32LE(end + 12), start = zip.readUInt32LE(end + 16);
    if (count === 65535 || size === 0xffffffff || start === 0xffffffff || count !== zip.readUInt16LE(end + 8) || count > limits.entries || start + size !== end)
        reject('directory bounds or ZIP64');
    const entries = [], aliases = new Map();
    let pos = start, total = 0;
    for (let i = 0; i < count; i++) {
        if (pos + 46 > end || zip.readUInt32LE(pos) !== 0x02014b50)
            reject('central entry');
        const flags = zip.readUInt16LE(pos + 8), method = zip.readUInt16LE(pos + 10), crc = zip.readUInt32LE(pos + 16), compressed = zip.readUInt32LE(pos + 20), uncompressed = zip.readUInt32LE(pos + 24), nl = zip.readUInt16LE(pos + 28), el = zip.readUInt16LE(pos + 30), cl = zip.readUInt16LE(pos + 32), offset = zip.readUInt32LE(pos + 42), attrs = zip.readUInt32LE(pos + 38);
        if (pos + 46 + nl + el + cl > end || zip.readUInt16LE(pos + 34) || [compressed, uncompressed, offset].includes(0xffffffff))
            reject('central bounds');
        if (flags & ~0x0808 || ![0, 8].includes(method))
            reject('encryption, flags or compression');
        const nameBytes = zip.subarray(pos + 46, pos + 46 + nl), name = decode(nameBytes), directory = name.endsWith('/'), path = canonicalPath(directory ? name.slice(0, -1) : name), alias = path.normalize('NFKC').toLocaleLowerCase('en-US');
        if (aliases.has(alias))
            reject('duplicate or aliased path');
        aliases.set(alias, directory);
        const mode = attrs >>> 16, type = mode & 0xf000;
        if (type && type !== (directory ? 0x4000 : 0x8000))
            reject('symlink or special entry');
        if ((attrs & 16) && !directory)
            reject('directory attributes');
        extras(zip.subarray(pos + 46 + nl, pos + 46 + nl + el));
        if (uncompressed > limits.entry || uncompressed > Math.max(1, compressed) * limits.ratio || (total += uncompressed) > limits.total)
            reject('expansion budget');
        if (offset + 30 > start || zip.readUInt32LE(offset) !== 0x04034b50)
            reject('local header');
        const lnl = zip.readUInt16LE(offset + 26), lel = zip.readUInt16LE(offset + 28), dataStart = offset + 30 + lnl + lel, dataEnd = dataStart + compressed;
        if (dataEnd > start || zip.readUInt16LE(offset + 6) !== flags || zip.readUInt16LE(offset + 8) !== method || !zip.subarray(offset + 30, offset + 30 + lnl).equals(nameBytes))
            reject('local-central mismatch');
        extras(zip.subarray(offset + 30 + lnl, dataStart));
        const lc = zip.readUInt32LE(offset + 14), ls = zip.readUInt32LE(offset + 18), lu = zip.readUInt32LE(offset + 22);
        if (flags & 8) {
            if ((lc && lc !== crc) || (ls && ls !== compressed) || (lu && lu !== uncompressed))
                reject('local descriptor mismatch');
        }
        else if (lc !== crc || ls !== compressed || lu !== uncompressed)
            reject('local-central sizes or CRC');
        let recordEnd = dataEnd;
        if (flags & 8) {
            const ends = [];
            for (const signed of [false, true]) {
                const p = dataEnd + (signed ? 4 : 0);
                if (p + 12 <= start && (!signed || zip.readUInt32LE(dataEnd) === 0x08074b50) && zip.readUInt32LE(p) === crc && zip.readUInt32LE(p + 4) === compressed && zip.readUInt32LE(p + 8) === uncompressed) ends.push(p + 12);
            }
            if (ends.length !== 1) reject('invalid or ambiguous data descriptor');
            recordEnd = ends[0];
        }
        entries.push({ path, directory, method, crc, compressed, uncompressed, offset, dataStart, dataEnd, recordEnd });
        pos += 46 + nl + el + cl;
    }
    for (const [path] of aliases) {
        const components = path.split('/');
        for (let i = 1; i < components.length; i++)
            if (aliases.get(components.slice(0, i).join('/')) === false) reject('file-directory path collision');
    }
    if (pos !== end)
        reject('directory count');
    let next = 0;
    for (const e of [...entries].sort((a, b) => a.offset - b.offset)) {
        if (e.offset !== next)
            reject('overlap, gap or executable prefix');
        next = e.recordEnd;
    }
    if (next !== start)
        reject('unclaimed local bytes');
    const files = new Map();
    let actualTotal = 0;
    for (const e of entries) {
        let bytes;
        const compressed = zip.subarray(e.dataStart, e.dataEnd);
        try {
            if (e.method === 0)
                bytes = Buffer.from(compressed);
            else {
                const inflated = inflateRawSync(compressed, { maxOutputLength: Math.min(limits.entry, limits.total - actualTotal), info: true });
                bytes = inflated.buffer;
                if (inflated.engine.bytesWritten !== compressed.length)
                    reject('trailing compressed bytes');
            }
        }
        catch {
            reject('invalid or excessive deflate data');
        }
        actualTotal += bytes.length;
        if (bytes.length !== e.uncompressed || bytes.length > limits.entry || actualTotal > limits.total || bytes.length > Math.max(1, e.compressed) * limits.ratio || crc32(bytes) !== e.crc)
            reject('inflated size or CRC');
        if (e.directory) {
            if (bytes.length)
                reject('nonempty directory');
        }
        else
            files.set(e.path, bytes);
    }
    return { files, entryCount: count, directories: new Set(entries.filter(e => e.directory).map(e => e.path)), archiveDigest: sha256(zip), compressedBytes: zip.length, inflatedBytes: actualTotal };
}
export function jsonEntry(files, path) { const bytes = files.get(path); if (!bytes)
    throw new Error(`SLACK_INVALID: missing ${path}`); try {
    return strictJson(decode(bytes));
}
catch {
    throw new Error(`SLACK_INVALID: malformed JSON in ${path}`);
} }
