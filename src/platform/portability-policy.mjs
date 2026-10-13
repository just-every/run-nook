import {normalizedPortability} from './storage/portability.mjs';
export const portabilityPolicy={
 product:'team-chat/team-workspace',replaceableTables:['schema_migrations','nook_storage'],
 requiredConfiguration:['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','AUTH_LOCAL','MAIL_PROVIDER','MAIL_FROM'],
 ...normalizedPortability,
};
// Operator tables contain credentials and are excluded by Base. Product actors
// remain stable and are reconciled via the explicit offline identity command.
export async function productPolicy(db){
 if(await db.prepare('SELECT id FROM nook_upload_attempts LIMIT 1').first()||await db.prepare("SELECT id FROM nook_attachments WHERE state='reserved' LIMIT 1").first()||await db.prepare('SELECT object_key FROM nook_object_deletes LIMIT 1').first()||await db.prepare("SELECT id FROM nook_imports WHERE state<>'complete' LIMIT 1").first())throw Error('reconcile_pending_object_work_before_export');
 return portabilityPolicy;
}
