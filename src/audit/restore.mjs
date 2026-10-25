// The offline filesystem operator has no restored sign-in session. Base names
// that service actor "direct"; it is not an attribution to a retained person.
export function restoreAuditDetails(row){
 let details;try{details=JSON.parse(row.reason)}catch{return null}
 if(details?.origin!=='restore-origin')return null;
 const counts=['tables','rows','objects','objectBytes','payloads','payloadBytes'];
 if(row.kind!=='archive.import.complete'||row.service!=='portability'||row.outcome!=='confirmed'||
  Object.keys(details).sort().join(',')!==['origin','sourceContentHash',...counts].sort().join(',')||
  typeof details.sourceContentHash!=='string'||!/^[a-f0-9]{64}$/.test(details.sourceContentHash)||
  counts.some(key=>!Number.isSafeInteger(details[key])||details[key]<0)||row.count!==details.rows)throw Error('invalid_restore_audit');
 return details;
}
