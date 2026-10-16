// Keep the local form in sync with hosted setup without requesting provider
// credentials. Base's development sender sends and stores no email.
export function localSetupManifest(manifest) {
 const local = structuredClone(manifest);
 const hostedMail = new Set(['SENDGRID_API_KEY','RESEND_API_KEY','MAIL_API_KEY','MAIL_RELAY_URL']);
 local.fields = local.fields.filter(field => !hostedMail.has(field.name));
 Object.assign(local.fields.find(field => field.name === 'MAIL_PROVIDER'), {
  default:'development', options:[{value:'development',label:'Local development (no email sent)'}],
 });
 Object.assign(local.fields.find(field => field.name === 'MAIL_FROM'), {
  label:'Local sender', default:'auth@localhost.test', help:'Placeholder sender only. Local sign-in uses the private RER_OPEN development session; no email is sent or stored.',
 });
 local.groups.find(group => group.id === 'mail').label = 'Local sign-in';
 return local;
}
