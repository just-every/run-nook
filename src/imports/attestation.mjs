export const attestationLabel = 'attested, not verified';

/** A bounded statement about past UTC calendar dates, never source coverage. */
export function attestedRange(value, now = Date.now()) {
    if (value === undefined) return undefined;
    const invalid = () => { throw new Error('Choose a valid past UTC date range, from before to.'); };
    if (!value || Array.isArray(value) || Object.keys(value).sort().join() !== 'from,to') invalid();
    const date = text => {
        if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) invalid();
        const at = Date.parse(text + 'T00:00:00.000Z');
        if (!Number.isFinite(at) || at < 0 || new Date(at).toISOString().slice(0, 10) !== text) invalid();
        return at;
    };
    const from = date(value.from), to = date(value.to);
    if (from >= to || to > now) invalid();
    return { from: value.from, to: value.to };
}

export function recordAttestation(range, owner, at) {
    return { ...range, label: attestationLabel, statedBy: owner.id, statedByName: owner.name, statedAt: new Date(at).toISOString() };
}

export function validateStoredAttestation(value, binding) {
    if (value === undefined) return;
    if (!value || Object.keys(value).sort().join() !== 'from,label,statedAt,statedBy,statedByName,to'
        || value.label !== attestationLabel || value.statedBy !== binding.owner
        || typeof value.statedByName !== 'string' || !value.statedByName.trim() || value.statedByName.length > 200
        || value.statedAt !== new Date(binding.created).toISOString()) throw Error('invalid_import_attestation');
    attestedRange({ from: value.from, to: value.to }, binding.created);
}
