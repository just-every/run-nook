import { fencedBatch, ownerPredicate, type DoorBindings } from './door-access';
import { sql } from '../base/modules/import-kit/src/door/store';
import { fail } from '../family/team-chat/domain';
import { validateCutoverChoices } from './slack-cutover.mjs';
import type { Context } from '../platform/storage/context';

/** The owner's per-row invitation roles are pass metadata saved with the plan.
 * Saving sends no mail and creates no account, session, role or membership. */
export async function saveCutoverChoices(env: DoorBindings, c: Context, input: any) {
  if (typeof input.planId !== 'string' || Object.keys(input).some(key => !['planId', 'choices'].includes(key))) fail(400, 'Choose a reviewed pass and its invitation roles');
  const link = await c.one<any>("SELECT n.summary_json,n.source_type,j.state FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id LEFT JOIN ik_jobs j ON j.id=p.job_id WHERE n.plan_id=? AND n.owner=?", [input.planId, c.uid]);
  if (!link || link.source_type !== 'slack') fail(404, 'Dry run unavailable');
  if (['undone', 'rolled_back'].includes(link.state)) fail(409, 'This pass was undone; its invitation preparation was withdrawn');
  const rows = JSON.parse(link.summary_json).cutover?.rows;
  if (!rows) fail(409, 'This pass has no invitation preparation');
  let admins;
  try { admins = validateCutoverChoices(rows, input.choices); } catch (error) { fail(400, (error as Error).message); }
  await fencedBatch(env, ownerPredicate(c), [
    sql("UPDATE nook_door_imports SET summary_json=json_set(summary_json,'$.cutoverChoices',json(?)) WHERE plan_id=? AND owner=?", JSON.stringify(admins), input.planId, c.uid),
    sql("UPDATE nook_exit_clock SET revision=revision+1 WHERE id=1"),
  ]);
  return { planId: input.planId, choices: admins };
}
