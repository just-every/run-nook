type Attestation = { from: string; to: string; label: string; statedByName: string; statedAt: string };

export function AttestationReport({ attestation }: { attestation: Attestation }) {
    return <section aria-label={attestation.label}>
        <h3>{attestation.label}</h3>
        <p>{attestation.from} → {attestation.to} (UTC)</p>
        <p>Stated by {attestation.statedByName} · <time dateTime={attestation.statedAt}>{new Date(attestation.statedAt).toLocaleString()}</time></p>
    </section>;
}
