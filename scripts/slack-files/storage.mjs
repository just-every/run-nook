import { constants, openSync, closeSync, fstatSync, readSync, writeSync, fsyncSync, lstatSync, mkdirSync, unlinkSync, renameSync, linkSync } from 'node:fs';
import { resolve, parse, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SLACK_FILE_LIMIT } from '../../src/imports/policy.mjs';
import { sha256 } from '../../src/imports/zip.mjs';
import { fail } from './errors.mjs';

function stat(path) {
    try { return lstatSync(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function safePath(path, createDirectories = false) {
    const full = resolve(path), root = parse(full).root;
    let current = root;
    for (const part of full.slice(root.length).split('/').filter(Boolean)) {
        current = join(current, part);
        let info = stat(current);
        if (!info && createDirectories) { mkdirSync(current, { mode: 0o700 }); info = stat(current); }
        if (info?.isSymbolicLink()) fail('symlink-path-refused');
        if (current !== full && info && !info.isDirectory()) fail('invalid-parent-directory');
    }
    return full;
}
export function readRegular(path, maximum) {
    safePath(path);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const before = fstatSync(fd);
        if (!before.isFile() || before.nlink !== 1 || before.size > maximum) fail('local-file-type-or-size');
        const bytes = Buffer.alloc(before.size + 1);
        let size = 0, read;
        while (size < bytes.length && (read = readSync(fd, bytes, size, bytes.length - size, null))) size += read;
        const after = fstatSync(fd);
        if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) fail('local-file-changed');
        return bytes.subarray(0, size);
    } finally { closeSync(fd); }
}
function removeRegular(path) {
    safePath(path);
    const info = stat(path);
    if (!info) return;
    if (!info.isFile() || info.nlink !== 1) fail('unsafe-local-state');
    unlinkSync(path);
}
function writePrivate(path, bytes) {
    safePath(path);
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
        let offset = 0;
        while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
        fsyncSync(fd);
    } finally { closeSync(fd); }
}

export function outputStore(directory) {
    const root = safePath(directory, true);
    if (!stat(root)?.isDirectory()) fail('invalid-output-directory');
    const files = safePath(join(root, 'files'), true), state = safePath(join(root, '.slack-files'), true);
    if (!stat(files)?.isDirectory() || !stat(state)?.isDirectory()) fail('invalid-output-directory');
    const lock = join(state, 'lock'), nonce = randomUUID();
    if (stat(lock)) {
        let previous;
        try { previous = JSON.parse(readRegular(lock, 256)); } catch { fail('unsafe-local-state'); }
        if (!Number.isSafeInteger(previous.pid) || previous.pid < 1) fail('unsafe-local-state');
        try { process.kill(previous.pid, 0); fail('output-in-use'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
        removeRegular(lock);
    }
    writePrivate(lock, Buffer.from(JSON.stringify({ pid: process.pid, nonce })));
    function paths(relative, identity) {
        safePath(root); safePath(files); safePath(state);
        return { target: join(root, relative), receipt: join(state, identity + '.json'), partial: join(state, identity + '.partial'), temporaryReceipt: join(state, identity + '.receipt') };
    }
    return {
        existing(relative, identity, item) {
            const { target, receipt, partial } = paths(relative, identity);
            if (!stat(target)) return false;
            // Recover a hard interruption between atomic publication and unlink.
            safePath(target); safePath(partial);
            const published = stat(target), pending = stat(partial);
            if (published?.isFile() && pending?.isFile() && published.dev === pending.dev && published.ino === pending.ino && published.nlink === 2) unlinkSync(partial);
            const bytes = readRegular(target, SLACK_FILE_LIMIT);
            if (!bytes.length) fail('existing-file-unverified');
            let expected = item.sha256;
            if (stat(receipt)) {
                let record;
                try { record = JSON.parse(readRegular(receipt, 1024)); } catch { fail('unsafe-local-state'); }
                if (record.source !== identity || record.size !== bytes.length || !/^[a-f0-9]{64}$/.test(record.sha256)) fail('existing-file-changed');
                expected = record.sha256;
            }
            if (!expected || sha256(bytes) !== expected || item.size !== null && bytes.length !== item.size) fail('existing-file-unverified');
            return bytes.length;
        },
        save(relative, identity, bytes) {
            const { target, receipt, partial, temporaryReceipt } = paths(relative, identity);
            if (stat(target)) fail('existing-file-unverified');
            removeRegular(partial); removeRegular(temporaryReceipt);
            writePrivate(partial, bytes);
            writePrivate(temporaryReceipt, Buffer.from(JSON.stringify({ source: identity, size: bytes.length, sha256: sha256(bytes) }) + '\n'));
            // Publish the receipt first: interruption before publishing bytes is safe to rerun.
            safePath(receipt); renameSync(temporaryReceipt, receipt);
            safePath(target); linkSync(partial, target); unlinkSync(partial);
        },
        close() {
            const current = JSON.parse(readRegular(lock, 256));
            if (current.nonce === nonce) removeRegular(lock);
        }
    };
}
