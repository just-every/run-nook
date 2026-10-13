// Build/verification callers disable dotenv loading. Wrangler's --env-file
// still needs this switch to put the selected private file into Worker bindings.
// Import only that file, never every variable from the caller's environment.
export function workerEnvironment(inherited) {
 return {...inherited,CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'true',CLOUDFLARE_INCLUDE_PROCESS_ENV:'false'}
}
