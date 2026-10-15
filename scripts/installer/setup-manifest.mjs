// Base's local installer always uses its loopback outbox. Keep its form in
// sync with the hosted setup without requesting production mail credentials.
export function localSetupManifest(manifest) {
 const local = structuredClone(manifest);
 const hostedMail = new Set(['SENDGRID_API_KEY','RESEND_API_KEY','MAIL_API_KEY','MAIL_RELAY_URL']);
 local.fields = local.fields.filter(field => !hostedMail.has(field.name));
 Object.assign(local.fields.find(field => field.name === 'MAIL_PROVIDER'), {
  default:'development', options:[{value:'development',label:'Local development outbox'}],
 });
 Object.assign(local.fields.find(field => field.name === 'MAIL_FROM'), {
  label:'Local sender', default:'auth@localhost.test', help:'Sign-in links stay in the local development outbox.',
 });
 local.groups.find(group => group.id === 'mail').label = 'Local sign-in';
 return local;
}
