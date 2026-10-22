import {sql} from '../base/modules/import-kit/src/door/store';
import {retainedChannelHistory} from './channel-guard';
import {fail} from '../family/team-chat/domain';
import type {DoorBindings} from './door-access';
import type {D1Sql} from './kit';

/** Keep the seed's edited-since refusal before Base records reversal intent.
 * Base still verifies every owned target, before-image and revision itself. */
export async function guardUndo(env: DoorBindings, authority: D1Sql, link: any): Promise<D1Sql> {
  const delta=!!JSON.parse(link.summary_json).delta;
  const changedAudience = (table: string, field: string) => `
    EXISTS(SELECT 1 FROM ${table} m WHERE m.conversation=cv.id AND NOT EXISTS(
      SELECT 1 FROM json_each(review.summary_json,'$.channels') channel,json_each(channel.value,'$.${field}') member
      WHERE json_extract(channel.value,'$.sourceId')=ch.source_id AND member.value=m.user))
    OR EXISTS(SELECT 1 FROM json_each(review.summary_json,'$.channels') channel,json_each(channel.value,'$.${field}') member
      WHERE json_extract(channel.value,'$.sourceId')=ch.source_id
      AND NOT EXISTS(SELECT 1 FROM nook_erased_actors erased WHERE erased.id=member.value)
      AND NOT EXISTS(SELECT 1 FROM ${table} m WHERE m.conversation=cv.id AND m.user=member.value))`;
  const unchanged = sql(`NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_conversations cv ON cv.id=ch.conversation
    LEFT JOIN ik_provenance ownership ON ownership.destination=? AND ownership.target_kind='channel' AND ownership.target_id=cv.id AND ownership.reversed=0
    LEFT JOIN ik_door_plans plan ON plan.job_id=ownership.job_id
    LEFT JOIN nook_door_imports review ON review.plan_id=plan.id AND review.domain_job=ch.job
    WHERE ch.job=? ${delta?'AND ownership.job_id=?':''} AND (review.plan_id IS NULL OR cv.seq<>(SELECT COUNT(*) FROM nook_events e WHERE e.conversation=cv.id AND (e.kind='erasure' AND e.actor IS NULL OR e.kind='import-history'))
      OR cv.version<>1 OR cv.message_count<>0 OR ${retainedChannelHistory('cv.id')}
      OR ${changedAudience('nook_members','members')}
      OR ${changedAudience('nook_guest_grants','guestMembers')}))`,
    link.owner,link.domain_job,...(delta?[link.job_id]:[]));
  if (!await env.DB.prepare(`SELECT 1 WHERE (${authority.sql}) AND (${unchanged.sql})`).bind(...authority.params ?? [],...unchanged.params ?? []).first()) fail(409,'native_edit_conflict: History or audiences changed since this import; nothing was undone');
  return sql(`(${authority.sql}) AND (${unchanged.sql})`,...authority.params ?? [],...unchanged.params ?? []);
}
