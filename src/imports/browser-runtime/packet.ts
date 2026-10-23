import { Buffer } from 'buffer';
import { encodeRolePacket } from '../role-decisions.ts';
import { assertLocalCredentials, assertLocalFileCredentials } from './credentials.ts';

export type LocalSourcePacket = {
  version: 1;
  sourceType: 'slack' | 'campfire' | 'mattermost';
  namespace: string;
  archiveDigest: string;
  review: any;
  capture: any;
};

export function localPacket(kind: LocalSourcePacket['sourceType'], capture: any, review: any): LocalSourcePacket {
  // Preview-only pass metadata (member names and addresses) travels with the plan request, not in the retained source packet.
  const { cutover: _cutover, ...retained } = capture;
  const transferable = {
    ...retained,
    messages: retained.messages.map((message: any) => ({
      ...message,
      files: message.files.map(({ bytes, ...file }: any) => {
        if (!(bytes instanceof Uint8Array)) throw new Error('Selected attachment bytes unavailable');
        assertLocalFileCredentials(bytes);
        return { ...file, base64: Buffer.from(bytes).toString('base64') };
      }),
    })),
  };
  const packet: LocalSourcePacket = JSON.parse(JSON.stringify({
    version: 1, sourceType: kind, namespace: review.namespace,
    archiveDigest: capture.archiveDigest, review, capture: transferable,
  }));
  encodeRolePacket(packet);
  assertLocalCredentials(packet);
  return packet;
}
