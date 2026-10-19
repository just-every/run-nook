import { assertNoCredentials, decodedCredentialText, removeCredentials, credentialPlaceholder } from '../../base/modules/import-kit/src/provenance/credentials.ts';
import type { Json } from '../../base/modules/import-kit/src/types.ts';

const reject = () => { throw new Error('LOCAL_SOURCE_CREDENTIALS: Source credentials must be removed before this history can be imported.'); };
// Source-specific auth columns extend Base's exact durable key prohibition.
const authKey = /password|passphrase|credential|auth[_-]?data|authorization|cookie|(?:access|refresh|session|bot)[_-]?(?:token|key)|api[_-]?key|client[_-]?secret|private[_-]?key|session[_-]?id/i;
const authText = /\bbearer\s+[a-z0-9._~+\/-]{8,}|\b(?:password|passphrase|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|authorization|cookie)\s*["']?\s*[:=]\s*["']?\S+/i;

/** Reject rather than silently rewrite hashed source records. The existing
 * Campfire/Mattermost readers already withhold known authentication columns. */
export function assertLocalCredentials(value: unknown): void {
  try {
    const inspected = value;
    // Base's wider remove policy catches named header pairs, auth containers,
    // URL fragments and provider-specific credentials. Refuse anything it
    // would change, so capture/review identities continue to name exact bytes.
    if (removeCredentials(inspected as Json).removed.some(item => !item.beforeUpload)) reject();
    assertNoCredentials(inspected);
    const visit = (item: unknown): void => {
      if (typeof item === 'string') {
        const decoded = decodedCredentialText(item);
        if (authText.test(decoded)) reject();
        // A credential-bearing link embedded in message prose is also unsafe.
        for (const link of decoded.match(/https?:\/\/[^\s<>"']+/gi) ?? []) assertNoCredentials(link);
      } else if (item && typeof item === 'object') {
        if (Array.isArray(item)) { for (const child of item) visit(child); return; }
        for (const [key, child] of Object.entries(item)) {
          if (authKey.test(decodedCredentialText(key)) && typeof child !== 'boolean' && !credentialPlaceholder(child)) reject();
          visit(child);
        }
      }
    };
    visit(inspected);
  } catch { reject(); }
}

/** Bytes only travel for actual selected attachments/emoji, never archives.
 * Check text attachments before their base64 representation conceals content. */
export function assertLocalFileCredentials(bytes: Uint8Array): void {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return; }
  assertLocalCredentials(text);
  let json: unknown;
  try { json = JSON.parse(text); } catch { return; }
  assertLocalCredentials(json);
}

export function credentialOmissions(kind: string) {
  if (kind === 'slack') return [];
  return [{ kind: 'source-authentication', reason: 'credentials-withheld-locally',
    detail: kind === 'campfire'
      ? 'Source passwords, bot keys, sessions and authentication tables stay on this device.'
      : 'Source passwords, authentication data, sessions and account credentials stay on this device.' }];
}
