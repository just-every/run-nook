import {zipFixture} from './slack-import/fixture.mjs';
export function privateSlackFixture(){
 return zipFixture([
  ['users.json',[{id:'synthetic-nook-1',name:'Private member one'},{id:'synthetic-nook-2',name:'Private member two'},{id:'synthetic-nook-3',name:'Private member three'}]],
  ['channels.json',[]],
  ['groups.json',[{id:'synthetic-nook-4',name:'private-history',members:['synthetic-nook-1','synthetic-nook-2']}]],
  ['dms.json',[{id:'synthetic-nook-5',members:['synthetic-nook-1','synthetic-nook-2']}]],
  ['mpims.json',[{id:'synthetic-nook-6',name:'group-history',members:['synthetic-nook-1','synthetic-nook-2','synthetic-nook-3']}]],
  ['private-history/2026-10-01.json',[{type:'message',user:'synthetic-nook-1',ts:'1700000000.000001',text:'Synthetic private channel canary'}]],
  ['synthetic-nook-5/2026-10-01.json',[{type:'message',user:'synthetic-nook-1',ts:'1700000001.000001',text:'Synthetic private DM canary <https://synthetic.slack.com/archives/synthetic-nook-4/p1700000000000001|private thread>'}]],
  ['group-history/2026-10-01.json',[{type:'message',user:'synthetic-nook-2',ts:'1700000002.000001',text:'Synthetic private group DM canary'}]],
  ['integration_logs.json',[{app_id:'synthetic-nook-7',app_name:'Polly'},{app_id:'synthetic-nook-8',app_name:'Donut'},{service_id:'synthetic-nook-9',service_name:'Incoming webhook',service_type:'incoming-webhook'},{app_id:'synthetic-nook-10',app_name:'Reminder app'},{app_id:'synthetic-nook-11',app_name:'Unknown workflow',type:'workflow'}]]
 ]);
}
