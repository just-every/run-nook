#!/usr/bin/env node
// Owner-run live check for C14 email (see OPERATIONS.md, Email notifications):
// one notification-format email through the configured provider to an address
// the owner supplies. The provider key is read from the environment and never
// printed. --dry-run builds the same message and sends nothing.
//
//   MAIL_FROM='Nook <notify@your-domain>' node scripts/notify-test-mail.mjs --to you@your-domain --dry-run
//   read -rs SENDGRID_API_KEY && export SENDGRID_API_KEY
//   MAIL_FROM='Nook <notify@your-domain>' AUTH_ORIGIN=https://your-nook node scripts/notify-test-mail.mjs --to you@your-domain
import {createMailSender} from '../src/base/modules/mail/index.mjs';
import {composeEmail} from '../src/notify/compose.ts';
import branding from '../src/branding.json' with {type:'json'};
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const to=flag('--to'),dryRun=args.includes('--dry-run'),provider=process.env.MAIL_PROVIDER||'sendgrid',from=process.env.MAIL_FROM;
const keys={sendgrid:'SENDGRID_API_KEY',resend:'RESEND_API_KEY'};
if(!to||!from||!keys[provider]){console.error('Usage: MAIL_FROM=SENDER [MAIL_PROVIDER=sendgrid|resend] [AUTH_ORIGIN=URL] node scripts/notify-test-mail.mjs --to ADDRESS [--dry-run]');process.exit(2);}
const email=composeEmail({workspace:branding.name,origin:process.env.AUTH_ORIGIN||'https://nook.invalid',actor:'Nook',conversation:{id:'test',name:'email-test',kind:'channel'},reason:'mention',message:null,count:1,token:'0'.repeat(64)});
const message={deliveryId:'nook-email-test-'+crypto.randomUUID(),from,to:[to],subject:email.subject+' (test)',text:'This is a test of Nook notification email. Its links lead nowhere.\n\n'+email.text};
if(dryRun){console.log(JSON.stringify({dryRun:true,provider,from,to:message.to,subject:message.subject,text:message.text}));process.exit(0);}
const apiKey=process.env[keys[provider]];
if(!apiKey){console.error(`${keys[provider]} is not set in this shell.`);process.exit(2);}
const result=await createMailSender({provider,mode:'production',apiKey}).send(message);
// "accepted" means the provider took the message; check the inbox for delivery.
console.log(JSON.stringify({provider:result.provider,status:result.status,providerMessageId:result.providerMessageId,code:result.code??null}));
process.exitCode=result.status==='accepted'?0:1;
