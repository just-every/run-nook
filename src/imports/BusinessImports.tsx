import { useState } from 'react';
import type { BusinessSettings } from './door-client';

export function BusinessImports({ business, busy, onEnable, onRevoke }: {
    business: BusinessSettings; busy: boolean;
    onEnable: (enabled: boolean) => Promise<void>; onRevoke: (kid: string) => Promise<void>;
}) {
    const [kid, setKid] = useState('');
    return <section><h2>Business import access</h2><p>Allow Business to import reviewed history into this installation. Your own imports and guarded Undo remain available when this is off.</p>
        <label className="import-check"><input type="checkbox" checked={business.enabled} disabled={busy} onChange={event => void onEnable(event.target.checked)} />Allow Business imports</label>
        <form onSubmit={event => { event.preventDefault(); void onRevoke(kid.trim()); }}><label>Revoke a Business signing key<input required value={kid} disabled={busy} onChange={event => setKid(event.target.value)} autoComplete="off" /></label><p>Revocation is permanent. Enabling Business again does not restore a revoked key.</p><button disabled={busy || !kid.trim() || business.revokedKeys.includes(kid.trim())} type="submit">Revoke key</button></form>
        {business.revokedKeys.length > 0 && <><h3>Permanently revoked keys</h3><ul>{business.revokedKeys.map(key => <li key={key}><code>{key}</code></li>)}</ul></>}
    </section>;
}
