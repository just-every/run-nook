export const ZIP_LIMITS: {
    readonly archive: number;
    readonly entry: number;
    readonly total: number;
    readonly entries: number;
    readonly ratio: number;
};
export function sha256(bytes: Uint8Array | string): string;
export function crc32(bytes: Uint8Array): number;
export function canonicalPath(path: string): string;
export function readSlackZip(input: Uint8Array, limits?: typeof ZIP_LIMITS): {
    files: Map<string, Buffer>;
    entryCount: number;
    directories: Set<string>;
    archiveDigest: string;
    compressedBytes: number;
    inflatedBytes: number;
};
export function jsonEntry(files: Map<string, Buffer>, path: string): any;
