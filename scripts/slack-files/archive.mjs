import { readSlackZip, jsonEntry, canonicalPath, sha256, ZIP_LIMITS } from '../../src/imports/zip.mjs';
import { SLACK_FILE_LIMIT } from '../../src/imports/policy.mjs';
import { sourceFileRefs } from '../../src/imports/slack-records.mjs';
import { sourceFiles, suppliedFilePath } from '../../src/imports/slack-files.mjs';
import { readRegular } from './storage.mjs';
import { fail } from './errors.mjs';

function addReference(unique, file) {
    if (!file || typeof file !== 'object' || Array.isArray(file) || typeof file.id !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(file.id) || file.name !== undefined && typeof file.name !== 'string') fail('invalid-file-reference');
    if (file.local_path !== undefined && (typeof file.local_path !== 'string' || !file.local_path.startsWith('files/')) || file.mimetype !== undefined && typeof file.mimetype !== 'string') fail('invalid-file-reference');
    const url = file.url_private_download ?? file.url_private ?? null;
    if (url !== null && typeof url !== 'string') fail('invalid-file-link');
    const item = { id: file.id, name: file.name ?? null, size: file.size ?? null, sha256: file.sha256 ?? null, mimetype: file.mimetype ?? null, local_path: file.local_path ?? null, url };
    if (file.size !== undefined && (!Number.isSafeInteger(file.size) || file.size < 0)) fail('invalid-file-size');
    if (file.sha256 !== undefined && (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256))) fail('invalid-file-digest');
    const previous = unique.get(item.id);
    // File events can carry only an ID. Enrich absent fields from a full object,
    // while conflicting supplied metadata is still rejected across every shape.
    if (previous) for (const key of ['name', 'size', 'sha256', 'mimetype', 'local_path', 'url']) {
        if (previous[key] !== null && item[key] !== null && previous[key] !== item[key]) fail('conflicting-file-reference');
        item[key] ??= previous[key];
    }
    unique.set(item.id, item);
    if (unique.size > ZIP_LIMITS.entries) fail('file-count-limit');
}

export function references(input) {
    const archive = readSlackZip(readRegular(input, ZIP_LIMITS.archive));
    const unique = new Map();
    let excessiveAttachments = false;
    for (const path of archive.files.keys()) {
        if (!/^[^/]+\/\d{4}-\d{2}-\d{2}\.json$/.test(path) || path.startsWith('files/')) continue;
        const rows = jsonEntry(archive.files, path);
        if (!Array.isArray(rows)) fail('invalid-message-history');
        const pending = [...rows];
        while (pending.length) {
            const row = pending.pop();
            if (!row || typeof row !== 'object') continue;
            // Use the same combined array/singular reference set as import admission.
            const messageFiles = sourceFileRefs(row);
            excessiveAttachments ||= messageFiles.length > 5;
            for (const file of messageFiles) addReference(unique, file);
            // Slack documents pin/unpin file items separately from message files.
            if (['pinned_item', 'unpinned_item'].includes(row.subtype) && row.item_type === 'F') addReference(unique, row.item);

            // Slack change records can contain previous and current message objects.
            for (const [key, value] of Object.entries(row)) {
                if (key === 'files' || !value || typeof value !== 'object') continue;
                if (Array.isArray(value)) { for (const child of value) pending.push(child); } else pending.push(value);
            }
        }
    }
    const items = [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const item of items) {
        const metadata = sourceMetadata(item);
        item.suppliedPath = suppliedFilePath(metadata, archive) ?? null;
        if (item.suppliedPath) {
            // Use the importer's byte, MIME, size and digest admission unchanged.
            sourceFiles({ files: [metadata] }, archive, (_kind, _key, reason) => fail(reason), item.id, new Set(), [], false);
        }
    }
    return { archive, items, excessiveAttachments };
}

const sourceMetadata = item => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== null));

export function filePath(item) {
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim() !== item.name || item.name.length > 120 || /[/\\\x00-\x1f\x7f<>:"|?*]/.test(item.name)) fail('unsafe-file-name');
    const path = `files/${item.id}-${item.name}`;
    try { canonicalPath(path); } catch { fail('unsafe-file-name'); }
    return path;
}

export function fetchPlan(source) {
    if (source.excessiveAttachments) fail('attachment-count-limit');
    const pending = source.items.filter(item => !item.suppliedPath);
    // The importer counts directory records too. Normal ZIP folder insertion also
    // emits files/ when it is absent, so reserve its entry before any download.
    let bytes = source.archive.inflatedBytes, count = source.archive.entryCount;
    const aliases = new Map([...source.archive.files.keys()].map(path => [path.toLocaleLowerCase('en-US'), false]));
    for (const path of source.archive.directories) aliases.set(path.toLocaleLowerCase('en-US'), true);
    const addPath = (path, directory) => {
        const alias = path.toLocaleLowerCase('en-US');
        if (aliases.has(alias)) fail('aliased-output-name');
        aliases.set(alias, directory);
    };
    if (pending.length && !source.archive.directories.has('files')) { addPath('files', true); count++; }
    const projected = { files: new Map(source.archive.files) };
    for (const item of pending) {
        const path = filePath(item);
        addPath(path, false);
        projected.files.set(path, null);
        if (item.size !== null && (item.size < 1 || item.size > SLACK_FILE_LIMIT)) fail('file-size-limit');
        count++; bytes += item.size ?? 0;
        if (count > ZIP_LIMITS.entries) fail('file-count-limit');
        if (bytes > ZIP_LIMITS.total) fail('total-byte-limit');
    }
    for (const [path] of aliases) {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) if (aliases.get(parts.slice(0, i).join('/')) === false) fail('aliased-output-name');
    }
    // An added file must not become a second candidate for any source reference.
    for (const item of source.items) suppliedFilePath(sourceMetadata(item), projected);
    return pending;
}

export function sourceIdentity(archive, item) {
    // Retain receipt identity across this admission change; the archive digest
    // already binds every source field, including MIME and explicit local paths.
    const { id, name, size, sha256: digest, url } = item;
    return sha256(JSON.stringify({ archive: archive.archiveDigest, id, name, size, sha256: digest, url }));
}
export function listing(item) {
    let host = null;
    try { host = new URL(item.url).hostname; } catch { /* No URL text is ever printed. */ }
    return { id: item.id, name: item.name, size: item.size, host };
}
