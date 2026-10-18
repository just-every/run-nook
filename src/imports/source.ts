import {campfireKitSource} from './campfire-effects.mjs';
import { reviewMetadata, captureArtifactName } from './review-binding.mjs';
import { canonicalJson, sha256, type SourceBundle, type ImportMapping } from './kit.ts';
import { effectInputs, MAPPING_VERSION } from './ids.mjs';
import { assertSlackEffect } from './policy.mjs';
/** The kit owns resumable source identity and native checkpoints. The original
 * ZIP remains separately in owner-only R2 custody; no unselected bodies enter
 * channel effects. This artifact is the exact reviewed normalized capture. */
export function kitSource(capture: any, owner: string, uploadId: string, reviewId: string) {
    if(capture.sourceType==='campfire')return campfireKitSource(capture,owner,uploadId,reviewId);
    const { domainJob, effects } = effectInputs(capture, owner, uploadId, reviewId);
    const normalized = canonicalJson({ ...reviewMetadata(capture), namespace: capture.namespace, archiveDigest: capture.archiveDigest, digest: capture.digest, omissions: capture.omissions, effects });
    const artifact = { name: captureArtifactName(capture), sha256: sha256(normalized), size: Buffer.byteLength(normalized), original: { status: 'available' as const, base64: Buffer.from(normalized).toString('base64') } };
    const source: SourceBundle = { artifacts: [artifact], diagnostics: [], records: effects.map((e: any, index: number) => ({ namespace: capture.namespace, kind: e.kind, sourceId: e.key, payload: e.value, payloadHash: sha256(canonicalJson(e.value)), artifactHash: artifact.sha256, location: { artifact: artifact.name, row: index } })) };
    return { source, mapping: slackMapping(), domainJob };
}
export function slackMapping(): ImportMapping {
    return { version: MAPPING_VERSION, map: r => {
        assertSlackEffect(r.kind, r.payload);
        return { effects: [{ targetKind: r.kind, targetId: r.kind === 'actor' ? r.sourceId : (r.payload as any).id, value: r.payload }] };
    } };
}
