export async function validateWorkspaceChannelPolicy(read){
 const rows=await read('nook_workspace_channel_policy')
 if(rows.length>1||rows.some(row=>Object.keys(row).sort().join()!=='archive,create_private,create_public,id,version'||row.id!==1||!Number.isSafeInteger(row.version)||row.version<1||['create_public','create_private','archive'].some(key=>!['owners','admins','members'].includes(row[key]))))throw Error('invalid_workspace_channel_policy')
}
