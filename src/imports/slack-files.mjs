import { sha256, canonicalPath } from './zip.mjs';
import { sourceFileRefs } from './slack-records.mjs';
import { SLACK_FILE_LIMIT } from './policy.mjs';
const bad = reason => { throw new Error(`SLACK_INVALID: ${reason}`); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(x);
export function suppliedFilePath(f, archive) {
    const proposed = [f.local_path, `files/${f.id}/${f.name}`, `files/${f.id}-${f.name}`, `files/${f.id}`].filter(x => typeof x === 'string');
    const paths = [];
    for (const path of proposed) {
        try {
            canonicalPath(path);
            if (archive.files.has(path)) paths.push(path);
        }
        catch {
            if (path === f.local_path) bad('file path');
        }
    }
    if (new Set(paths).size > 1) bad('ambiguous supplied file bytes');
    return paths[0];
}
export function sourceFiles(message, archive, block, key, usedFiles, missingFiles, allowMissing) {
    const result = [], seen = new Set();
    for (const f of sourceFileRefs(message)) {
        if (!object(f) || !id(f.id) || typeof f.name !== 'string' || typeof f.mimetype !== 'string' || f.local_path !== undefined && (typeof f.local_path !== 'string' || !f.local_path.startsWith('files/')))
            bad('file identity');
        if (seen.has(f.id))
            bad('duplicate file identity');
        seen.add(f.id);
        if (seen.size > 5)
            block('file', `${key}:${f.id}`, 'attachment-count-limit');
        const path = suppliedFilePath(f, archive), bytes = path ? archive.files.get(path) : undefined;
        if (path)
            usedFiles.add(path);
        if (f.size !== undefined && (!Number.isSafeInteger(f.size) || f.size < 0)) bad('file size');
        if (!bytes) {
            missingFiles.push({ key, sourceId: f.id, name: f.name, size: f.size ?? null });
            if (!allowMissing) block('file', `${key}:${f.id}`, 'missing-supplied-bytes');
            continue;
        }
        if (bytes.length > SLACK_FILE_LIMIT) {
            block('file', `${key}:${f.id}`, 'slack-file-size-limit');
            continue;
        }
        if (f.size !== undefined && (!Number.isSafeInteger(f.size) || f.size !== bytes.length))
            bad('file size mismatch');
        if (f.sha256 !== undefined && f.sha256 !== sha256(bytes))
            bad('file hash mismatch');
        const starts = prefix => prefix.every((v, i) => bytes[i] === v);
        let supported = bytes.length > 0 && !!f.name.trim() && f.name.trim() === f.name && ['text/plain', 'image/png', 'image/jpeg', 'application/pdf'].includes(f.mimetype) && !/[/\\\x00-\x1f\x7f<>:\"|?*]/.test(f.name) && f.name.length <= 120;
        if (f.mimetype === 'image/png')
            supported &&= starts([137, 80, 78, 71, 13, 10, 26, 10]);
        if (f.mimetype === 'image/jpeg')
            supported &&= starts([255, 216, 255]);
        if (f.mimetype === 'application/pdf')
            supported &&= starts([37, 80, 68, 70, 45]);
        if (f.mimetype === 'text/plain' && bytes.includes(0))
            supported = false;
        if (f.mimetype === 'text/plain')
            try {
                new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            }
            catch {
                supported = false;
            }
        if (!supported) {
            block('file', `${key}:${f.id}`, 'unsupported-or-invalid-file-bytes');
            continue;
        }
        result.push({ sourceId: f.id, name: f.name, mime: f.mimetype, size: bytes.length, sha256: sha256(bytes), path, bytes, sourceRecord: f });
    }
    return result;
}
