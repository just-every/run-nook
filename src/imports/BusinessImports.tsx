import { useState } from 'react';
import type { BusinessSettings } from './door-client';

export function BusinessImports({ business, busy, onEnable, onRevoke }: {
    business: BusinessSettings; busy: boolean;
    onEnable: (enabled: boolean) => Promise<void>; onRevoke: (kid: string) => Promise<void>;
}) {
    const [kid, setKid] = useState('');
    return <section><h2>Import access</h2><p>Allow a connected service to import history you have reviewed. You can still upload exports and undo imports when this is off.</p>
        <label className="import-check"><input type="checkbox" checked={business.enabled} disabled={busy} onChange={event => void onEnable(event.target.checked)} />Allow connected imports</label>
        <form onSubmit={event => { event.preventDefault(); void onRevoke(kid.trim()); }}><label>Key to revoke<input required value={kid} disabled={busy} onChange={event => setKid(event.target.value)} autoComplete="off" /></label><p>Revoked keys cannot be used again.</p><button disabled={busy || !kid.trim() || business.revokedKeys.includes(kid.trim())} type="submit">Revoke key</button></form>
        {business.revokedKeys.length > 0 && <><h3>Permanently revoked keys</h3><ul>{business.revokedKeys.map(key => <li key={key}><code>{key}</code></li>)}</ul></>}
    </section>;
}
