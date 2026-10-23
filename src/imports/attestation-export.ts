export const importAttestationExport = {
    name: 'import_attestations',
    sql: `SELECT json_array(n.plan_id) AS _key,'' AS conversation,n.plan_id AS pass,n.namespace,json_extract(n.summary_json,'$.attestation') AS attestation
        FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id JOIN ik_jobs j ON j.id=p.job_id AND j.state='completed'
        WHERE n.owner=(SELECT owner FROM job) AND json_type(n.summary_json,'$.attestation')='object'
        AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=n.owner AND o.role='owner' AND o.status='active')`,
    project: (row: Record<string, any>) => ({ ...row, attestation: JSON.parse(row.attestation) }),
};
