import {platformTable} from '@runeditrun/rer/internal/modules/portability/bookkeeping.mjs';

// Use the importing Base version's bookkeeping policy, including its wildcard
// exclusions. Product validators must never ask its staged reader for those rows.
export const archiveTableNames=manifest=>manifest.tables.map(table=>table.name).filter(name=>!platformTable(name));

export function archiveRead(read,manifest){
 if(!manifest)return read; // Offline SQLite identity recovery has no archive manifest.
 const names=new Set(archiveTableNames(manifest));
 return name=>{
  if(!names.has(name))throw Error('missing_archive_table:'+name);
  return read(name);
 };
}
