import { fencedBatch, type DoorBindings } from './door-access';
import type { D1Sql } from './kit';
import { sql } from '../base/modules/import-kit/src/door/store';

/** Publication/removal shares the owner's mutation fence. The metadata is
 * outside import effects and coverage, but readable exports must be revisioned. */
export async function publishAttestation(env: DoorBindings, predicate: D1Sql, link: any, result: any) {
    const summary = JSON.parse(link.summary_json);
    if (!summary.attestation) return;
    if (result.job?.state === 'completed' && !summary.attestationPublished) {
        const pending = "EXISTS(SELECT 1 FROM nook_door_imports WHERE plan_id=? AND json_type(summary_json,'$.attestation')='object' AND COALESCE(json_extract(summary_json,'$.attestationPublished'),0)=0)";
        await fencedBatch(env, predicate, [
            sql(`UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1 AND ${pending}`, link.plan_id),
            sql("UPDATE nook_door_imports SET summary_json=json_set(summary_json,'$.attestationPublished',json('true')) WHERE plan_id=?", link.plan_id),
        ]);
    }
    if (['undone', 'rolled_back'].includes(result.job?.state)) {
        await fencedBatch(env, predicate, [
            sql("UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1 AND EXISTS(SELECT 1 FROM nook_door_imports WHERE plan_id=? AND json_type(summary_json,'$.attestation')='object')", link.plan_id),
            sql("UPDATE nook_door_imports SET summary_json=json_remove(summary_json,'$.attestation','$.attestationPublished') WHERE plan_id=?", link.plan_id),
        ]);
    }
}
