import './browser-runtime/globals.ts';
import { inspectSource, captureSource } from './formats.mjs';
import { effectInputs } from './ids.mjs';
import { campfireKitSource } from './campfire-effects.mjs';
import { mattermostEffectInputs } from './mattermost-effects.mjs';
import { publicLocalInspection, publicLocalSummary } from './browser-runtime/public.ts';
import { localPacket } from './browser-runtime/packet.ts';
import { credentialOmissions } from './browser-runtime/credentials.ts';

export type LocalSourceKind = 'slack' | 'campfire' | 'mattermost' | 'gchat';
declare const localHandle: unique symbol;
export type LocalSourceHandle = { readonly [localHandle]: true };
export type { LocalSourcePacket } from './browser-runtime/packet.ts';

const sources = new WeakMap<LocalSourceHandle, { kind: LocalSourceKind; inspected: any }>();
const kinds = new Set(['slack', 'campfire', 'mattermost', 'gchat']);

/** Opaque handles contain no archive bytes and serialize as {}. Raw input stays
 * in this tab's memory; this module performs no upload, fetch or persistence. */
export async function inspectLocal(file: File, kind: LocalSourceKind, users: any[]) {
  if (!kinds.has(kind)) throw new Error('Unsupported source format');
  if (!file || file.size < 1 || file.size > 32 * 1024 * 1024) throw new Error('Choose an archive up to 32 MiB');
  const inspected = await inspectSource(new Uint8Array(await file.arrayBuffer()), kind, users);
  const handle = Object.freeze({}) as LocalSourceHandle;
  sources.set(handle, { kind, inspected });
  return { ...publicLocalInspection(inspected, kind, users), credentialOmissions: credentialOmissions(kind), handle };
}

export async function prepareLocal(handle: LocalSourceHandle, review: any, ownerId: string, users: any[]) {
  const source = sources.get(handle);
  if (!source) throw new Error('Choose the source archive again on this device');
  const capture = captureSource(source.inspected, review, ownerId, users);
  // Exercise the actual effect validators locally as well as capture readers.
  // Server will bind these same effects to its stable door upload/review IDs.
  if (!capture.blocked && capture.omissionsAccepted) {
    const effects = source.kind === 'campfire' ? campfireKitSource
      : source.kind === 'mattermost' ? mattermostEffectInputs : effectInputs;
    effects(capture, ownerId, 'local-review', 'local-review');
  }
  const packet = localPacket(source.kind, capture, review);
  return {
    summary: { ...publicLocalSummary(capture), credentialOmissions: credentialOmissions(source.kind) },
    packet,
  };
}

export function releaseLocal(handle: LocalSourceHandle): void { sources.delete(handle); }
