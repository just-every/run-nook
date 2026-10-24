import { deflateRawSync } from 'node:zlib';
import { crc32 } from '../../src/imports/zip.mjs';
export function zipFixture(entries, { deflate = false, descriptor = false, descriptorSignature = true } = {}) {
    const locals = [], central = [];
    let offset = 0;
    for (const [path, value] of entries) {
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)), name = Buffer.from(path), body = deflate ? deflateRawSync(bytes) : bytes, crc = crc32(bytes), flags = 0x800 | (descriptor ? 8 : 0), local = Buffer.alloc(30), directory = Buffer.alloc(46);
        local.writeUInt32LE(0x04034b50);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(deflate ? 8 : 0, 8);
        if (!descriptor) {
            local.writeUInt32LE(crc, 14);
            local.writeUInt32LE(body.length, 18);
            local.writeUInt32LE(bytes.length, 22);
        }
        local.writeUInt16LE(name.length, 26);
        directory.writeUInt32LE(0x02014b50);
        directory.writeUInt16LE(0x314, 4);
        directory.writeUInt16LE(20, 6);
        directory.writeUInt16LE(flags, 8);
        directory.writeUInt16LE(deflate ? 8 : 0, 10);
        directory.writeUInt32LE(crc, 16);
        directory.writeUInt32LE(body.length, 20);
        directory.writeUInt32LE(bytes.length, 24);
        directory.writeUInt16LE(name.length, 28);
        directory.writeUInt32LE(path.endsWith('/') ? 0x41ed0010 : 0x81a40000, 38);
        directory.writeUInt32LE(offset, 42);
        const tail = Buffer.alloc(descriptor ? descriptorSignature ? 16 : 12 : 0);
        if (descriptor) {
            const at = descriptorSignature ? 4 : 0;
            if (descriptorSignature) tail.writeUInt32LE(0x08074b50);
            tail.writeUInt32LE(crc, at);
            tail.writeUInt32LE(body.length, at + 4);
            tail.writeUInt32LE(bytes.length, at + 8);
        }
        locals.push(local, name, body, tail);
        central.push(directory, name);
        offset += local.length + name.length + body.length + tail.length;
    }
    const cd = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}
export function slackFixture({incomingWebhook=false}={}) {
    return zipFixture([
        ...(incomingWebhook?[["integration_logs.json",[{service_id:'synthetic-nook-webhook',service_name:'Incoming webhook',service_type:'incoming-webhook',channel_id:'C1'}]]]:[]),
        ['users.json', [{ id: 'U1', name: 'Rin', profile: { email: '  RIN@EXAMPLE.TEST ' } }, { id: 'U2', name: 'Rin', profile: { email: 'same@example.test' } }, { id: 'U404', name: 'External historical actor' }]],
        ['channels.json', [{ id: 'C1', name: 'general', is_private: false }, { id: 'C2', name: 'engineering' }]],
        ['groups.json', [{ id: 'G1', name: 'secret' }]],
        ['general/2024-01-01.json', [{ type: 'message', user: 'U1', text: '  Exact café 日本語 👋\n', ts: '1700000000.000001', files: [{ id: 'F1', name: 'hello.txt', mimetype: 'text/plain', size: 5 }] }, { type: 'message', user: 'U2', text: 'thread reply', ts: '1700000000.000002', thread_ts: '1700000000.000001' }]],
        ['engineering/2024-01-01.json', [{ type: 'message', user: 'U404', text: 'unknown local association for a supplied historical actor', ts: '1700000000.000004', files: [{ id: 'F2', name: 'second.txt', mimetype: 'text/plain' }] }, { type: 'message', user: 'U1', text: 'second channel thread reply', ts: '1700000000.000006', thread_ts: '1700000000.000004' }]],
        ['secret/2024-01-01.json', [{ type: 'message', user: 'U1', text: 'PRIVATE CANARY', ts: '1700000000.000005' }]],
        ['files/F1/hello.txt', Buffer.from('hello')],
        ['files/F2/second.txt', Buffer.from('second')]
    ], { deflate: true, descriptor: true });
}
export const fixtureUsers = [{ id: 'owner', active: true, email: 'rin@example.test' }, { id: 'teammate', active: true, email: 'same@example.test' }, { id: 'other', active: true, email: 'same@example.test' }];
export const fixtureReview = { namespace: 'fixture-workspace', channels: [{ sourceId: 'C1', name: 'Imported general', members: ['owner', 'teammate'] }, { sourceId: 'C2', name: 'Imported engineering', members: ['owner'] }], actors: { U1: 'owner', U2: null, U404: null }, acceptedOmissions: [] };
export function largeSlackFixture(messageCount = 1205, actorCount = 205) {
    const users = Array.from({ length: actorCount }, (_, i) => ({ id: 'U' + i, name: 'Historical actor ' + i, profile: { email: `source-${i}@example.test` } })), channels = [{ id: 'C1', name: 'first' }, { id: 'C2', name: 'second' }], messages = [[], []];
    for (let i = 0; i < messageCount; i++) {
        const channel = i % 2, ts = `170000${String(Math.floor(i / 1000000)).padStart(4, '0')}.${String(i % 1000000).padStart(6, '0')}`;
        messages[channel].push({ type: 'message', user: users[i % actorCount].id, ts, text: `Historical fixture ${i}: café 日本語 ${i * 7919}`, ...(i > 1 && i < 8 ? { thread_ts: messages[channel][0].ts } : {}) });
    }
    return zipFixture([['users.json', users], ['channels.json', channels], ['first/2024-01-01.json', messages[0]], ['second/2024-01-01.json', messages[1]]], { deflate: true });
}
