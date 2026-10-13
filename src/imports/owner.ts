import { fail } from '../family/team-chat/domain';
import { authority, authFence, type Context } from '../platform/storage/context';
export async function owner(c: Context) { await c.check(); const row = await c.one("SELECT id FROM oa_operators WHERE id=? AND status='active' AND role='owner'", [c.uid]); if (!row)
    fail(403, 'Only workspace owners can import history'); }
export async function ownerBatch(c: Context, statements: D1PreparedStatement[], condition = '1', values: any[] = []) { const key = crypto.randomUUID(), guard = () => c.sql(`INSERT INTO nook_guard(id,ok) SELECT ?,CASE WHEN ${authority} AND ${authFence} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner') AND (${condition}) THEN 1 ELSE 0 END`, key, ...c.credentials, c.uid, ...values); await c.db.batch([guard(), ...statements, c.sql('DELETE FROM nook_guard WHERE id=?', key), guard(), c.sql('DELETE FROM nook_guard WHERE id=?', key)]); }
