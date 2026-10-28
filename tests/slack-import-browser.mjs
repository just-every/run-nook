import {clickMessageAction} from './conversation-details.mjs'
import {createBrowserPlan,reconcileBrowserJob} from './import-browser-support.mjs';
import {browserEmailSignIn} from './auth-support.mjs';
// Parent runtime/browser lane: existing local Worker with native owner setup.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { keyed } from './dev-key.mjs';
import { mkdir } from 'node:fs/promises';
import {privateSlackFixture} from './slack-private-fixture.mjs';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import { slackFixture, zipFixture } from './slack-import/fixture.mjs';
import {pathToFileURL} from 'node:url';
async function guardedUndo(page, context, origin, planId, channel, live) {
    // A cold navigation can show the server-rendered job before its handlers
    // exist. Hold only script delivery; the page, import and API remain real.
    let releaseScripts;
    const scripts = new Promise(resolve => { releaseScripts = resolve; });
    const deliveries = new Set();
    const holdScripts = async route => {
        const delivery = (async () => {
            if (route.request().resourceType() === 'script') await scripts;
            await route.continue();
        })();
        deliveries.add(delivery);
        try { await delivery; } finally { deliveries.delete(delivery); }
    };
    await page.route('**/*', holdScripts);
    const job = page.locator('.import-job').filter({ hasText: planId });
    const undo = job.getByRole('button', { name: 'Undo this import', exact: true });
    try {
        await page.goto(origin + '/imports', { waitUntil: 'commit' });
        await expect(undo).toBeVisible();
        await expect(undo).toBeDisabled();
        releaseScripts();
        const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/operator/import/undo' && r.request().method() === 'POST');
        await undo.click();
        assert.equal((await response).status(), 409, 'browser undo refuses later live work');
        await expect(page.getByRole('alert')).toBeVisible();
        const retained = await context.request.get(origin + `/api/conversations/${channel.id}/messages`);
        assert.equal(retained.status(), 200);
        assert.ok((await retained.json()).some(message => message.body === live), 'refused undo preserves live work');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'guarded undo fits the viewport');
    } finally {
        releaseScripts();
        await Promise.all(deliveries);
        await page.unroute('**/*', holdScripts);
    }
}
export async function runSlackBrowser(origin){
const browser = await keyed(chromium).launch({ headless: true });
try {
    for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } }), page = await context.newPage();
        try {
            await page.clock.install({time:new Date()});
            await browserEmailSignIn(page,origin,'nativeowner@example.test');
            await page.goto(origin + '/app?view=you');
            await page.getByRole('link',{name:'Import Slack history',exact:true}).click();
            const shot=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no import screen overflow');await mkdir('evidence/nook-1',{recursive:true});await page.screenshot({path:`evidence/nook-1/slack-${name}-${width}.png`,fullPage:true,animations:'disabled'})};
            await shot('entry');
            const me=await (await context.request.get(origin+'/api/me')).json();
            await expect(page.getByLabel('Slack export ZIP')).toBeEnabled();
            await page.getByLabel('Slack export ZIP').setInputFiles({name:'private.zip',mimeType:'application/zip',buffer:privateSlackFixture()});
            try { await page.getByLabel('Source workspace namespace').fill('synthetic-nook-browser-private-'+width+'-'+Date.now()); } catch (error) { console.error('Slack local inspection:',await page.locator('main').innerText()); throw error; }
            const selects=page.locator('.import-actors select');
            await selects.nth(0).selectOption(me.id);
            // Earlier browser journeys create guests. This private-DM fixture needs a
            // current full member; guests deliberately cannot enter native DMs.
            const teamResponse=await context.request.get(origin+'/api/team');assert.equal(teamResponse.status(),200);
            const team=await teamResponse.json();
            const other=team.find(person=>person.id!==me.id&&person.status==='active'&&person.productActive===1&&person.mode==='member')?.id;
            assert.ok(other);await selects.nth(1).selectOption(other);await selects.nth(2).selectOption('external');
            await page.getByLabel('private-history private source').check();
            await page.getByLabel('synthetic-nook-5 dm source').check();
            await page.getByLabel('group-history group-dm source').check();
            await page.getByLabel('New channel name',{exact:true}).nth(0).fill('Imported webhook channel '+width);
            await page.getByLabel('New channel name',{exact:true}).nth(1).fill('Imported private DM '+width);
            await shot('private-mapping');
            const privatePlan=await createBrowserPlan(page,{omissions:'I have reviewed these omissions and accept this exact list.'});
            await expect(page.getByText('private-membership-not-exactly-mapped',{exact:false})).toBeVisible();
            await expect(page.getByRole('heading',{name:'Integration inventory'})).toBeVisible();
            await page.addScriptTag({content:await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8')});
            const violations=await page.evaluate(async()=> (await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)));
            assert.deepEqual(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
            await shot('private-review');
            await page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first().click();
            await page.getByRole('status').filter({hasText:'Historical import completed.'}).waitFor();
            await reconcileBrowserJob(page,page.locator('.import-job').filter({hasText:privatePlan.planId}));
            const privateRooms=await (await context.request.get(origin+'/api/conversations')).json();
            const privateRoom=privateRooms.find(c=>c.name==='Imported private DM '+width);assert.ok(privateRoom);
            await page.goto(origin+'/app?conversation='+privateRoom.id);
            await page.getByRole('link',{name:'Open imported Slack thread',exact:true}).click();
            await expect(page.getByRole('region',{name:'Thread messages',exact:true}).locator('.message-body').filter({hasText:'Synthetic private channel canary'})).toBeVisible();
            await shot('private-link');
            const mappedWebhook=privateRooms.find(c=>c.name==='Imported webhook channel '+width);assert.ok(mappedWebhook);
            await page.goto(origin+'/app?view=team');const apps=page.getByRole('region',{name:'Notification apps',exact:true});await apps.getByLabel('App name',{exact:true}).fill('Incoming webhook');await apps.getByRole('checkbox',{name:'#'+mappedWebhook.name,exact:true}).check();await apps.getByRole('button',{name:'Approve app',exact:true}).click();
            const secret=apps.getByRole('region',{name:'New app tokens',exact:true});await expect(secret).toBeVisible();const repointed=(await secret.locator('samp').textContent()).trim();assert.equal(new URL(repointed).origin,origin);assert.match(new URL(repointed).pathname,/^\/hooks\/slack\//);
            await page.addScriptTag({content:await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8')});assert.deepEqual(await page.evaluate(async()=>(await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)),[]);
            await page.screenshot({path:`evidence/nook-1/slack-webhook-approval-${width}.png`,fullPage:true,animations:'disabled',mask:[secret.locator('code'),secret.locator('samp')]});
            const webhookText='synthetic-nook imported webhook delivery '+width,delivered=await fetch(repointed,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:webhookText})});assert.equal(delivered.status,200);assert.equal(await delivered.text(),'ok');
            await secret.getByRole('button',{name:'I have saved the tokens',exact:true}).click();await page.goto(origin+'/app?conversation='+mappedWebhook.id);const webhookRow=page.locator('[data-message]').filter({hasText:webhookText});await expect(webhookRow).toHaveCount(1);await expect(webhookRow.getByText('Incoming webhook',{exact:true})).toBeVisible();await expect(webhookRow.getByText('App',{exact:true})).toBeVisible();await shot('webhook-delivered');
            await page.addScriptTag({content:await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8')});assert.deepEqual(await page.evaluate(async()=>(await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)),[]);
            await page.goto(origin+'/app?view=team');await apps.getByRole('button',{name:'Revoke Incoming webhook in '+mappedWebhook.name,exact:true}).click();await expect(apps.getByRole('article',{name:'Incoming webhook in '+mappedWebhook.name,exact:true})).toContainText('Revoked');

            await page.goto(origin+'/app?view=you');await page.getByRole('link',{name:'Import Slack history',exact:true}).click();
            const incomplete = zipFixture([['users.json', []], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', [{ type: 'message', user: 'Umissing', ts: '1.000001', text: 'Missing source actor' }]]]);
            await expect(page.getByLabel('Slack export ZIP')).toBeEnabled();
            await page.getByLabel('Slack export ZIP').setInputFiles({ name: 'incomplete.zip', mimeType: 'application/zip', buffer: incomplete });
            await page.getByLabel('Source workspace namespace').fill('blocked-browser-' + width + '-' + Date.now());
            await page.getByLabel('general public source').check();
            await page.getByRole('button', { name: 'Preview exact import', exact: true }).click();
            await page.getByRole('heading', { name: 'Import blocked: selected history is incomplete or unsupported' }).waitFor();
            assert.equal(await page.locator('form').getByRole('button', { name: 'Apply reviewed plan', exact: true }).count(), 0);
            assert.equal(await page.getByLabel('I have reviewed these omissions and accept this exact list.').count(), 0);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'blocked preview has no horizontal overflow');
            await mkdir('evidence/nook-1', { recursive: true });
            await page.screenshot({ path: `evidence/nook-1/slack-import-blocked-${width}.png`, fullPage: true });
            await page.getByRole('button', { name: 'Discard local export', exact: true }).click();
            await page.getByRole('status').filter({ hasText: 'Local export and unused dry run discarded.' }).waitFor();
            await page.getByLabel('Slack export ZIP').setInputFiles({ name: 'slack-fixture.zip', mimeType: 'application/zip', buffer: slackFixture() });
            await page.getByLabel('Source workspace namespace').fill('browser-' + width + '-' + Date.now());
            for (const channel of ['general', 'engineering'])
                await page.getByLabel(channel + ' public source').check();
            for (const [index, name] of ['general', 'engineering'].entries()) await page.getByLabel('New channel name', { exact: true }).nth(index).fill(`Imported ${name} ${width}`);
            for (const select of await page.locator('select').all())
                await select.selectOption('external');
            await shot('mapping');
            const planned=await createBrowserPlan(page,{omissions:'I have reviewed these omissions and accept this exact list.'});
            await shot('dry-run');
            await page.clock.fastForward(31*60*1000);await expect(page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first()).toBeDisabled();await shot('expired');
            await page.clock.setFixedTime(new Date());await page.clock.runFor(15000);await expect(page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first()).toBeEnabled();
            await page.getByRole('button', { name: 'Apply reviewed plan', exact: true }).first().click();
            await page.getByRole('status').filter({ hasText: 'Historical import completed.' }).waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'wizard has no horizontal overflow');
            await mkdir('evidence/nook-1', { recursive: true });
            await page.screenshot({ path: `evidence/nook-1/slack-import-${width}.png`, fullPage: true });
            await reconcileBrowserJob(page,page.locator('.import-job').filter({hasText:planned.planId}));
            const channels = await (await context.request.get(origin + '/api/conversations')).json(), channel = channels.find(c => c.name === `Imported general ${width}`);
            assert.ok(channel);
            await page.goto(`${origin}/app?conversation=${channel.id}`);
            const imported = page.locator('.message[data-immutable="true"]').first();
            await imported.waitFor();
            assert.equal(await imported.locator('.message-body').textContent(), '  Exact café 日本語 👋\n');
            assert.equal(await imported.getByRole('button', { name: 'Ask someone', exact: true }).count(), 0);
            assert.equal(await imported.getByRole('button', { name: 'Remove file', exact: true }).count(), 0);
            await clickMessageAction(imported.getByRole('button', { name: 'Open thread', exact: true }));
            await page.locator('.thread-log .message[data-immutable="true"]').nth(1).waitFor();
            await expect(page.getByRole('textbox', { name: 'Reply in thread', exact: true })).toBeVisible();
            await page.screenshot({ path: `evidence/nook-1/slack-history-thread-${width}.png`, fullPage: true });
            await page.goto(`${origin}/app?conversation=${channel.id}`);
            if (width === 390) {
                await page.getByRole('textbox', { name: `Message Imported general ${width}`, exact: true }).fill('Later native work survives import undo');
                await page.getByRole('button', { name: 'Send', exact: true }).click();
                await page.getByText('Later native work survives import undo', { exact: true }).waitFor();
            }
            await page.goto(origin + '/imports');
            await page.reload();
            await page.getByRole('heading', { name: 'Import jobs' }).waitFor();
            await page.getByRole('heading',{name:'Import access',exact:true}).scrollIntoViewIfNeeded();await shot('business');
            const job = page.locator('.import-job').filter({ hasText: planned.planId });
            if (width === 390) {
                await guardedUndo(page, context, origin, planned.planId, channel, 'Later native work survives import undo');
                await page.screenshot({ path: 'evidence/nook-1/slack-undo-guard-390.png', fullPage: true });
                await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'evidence/nook-1/slack-undo-guard-1440.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});
            } else { await job.getByRole('button', { name: 'Undo this import', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'undone' }).waitFor(); }

            const business=page.locator('section').filter({has:page.getByRole('heading',{name:'Import access',exact:true})});
            await business.getByRole('checkbox',{name:'Allow connected imports',exact:true}).click();
            await expect(business.getByRole('checkbox',{name:'Allow connected imports',exact:true})).toBeChecked();
            const kid='retired-migration-key-'+width;await business.getByLabel('Key to revoke',{exact:true}).fill(kid);await business.getByRole('button',{name:'Revoke key',exact:true}).click();
            await expect(business.getByText(kid,{exact:true})).toBeVisible();await business.screenshot({path:`evidence/nook-1/business-revoked-${width}.png`,animations:'disabled'});
            await business.getByRole('checkbox',{name:'Allow connected imports',exact:true}).click();await expect(business.getByRole('checkbox',{name:'Allow connected imports',exact:true})).not.toBeChecked();
            await expect(business.getByText(kid,{exact:true})).toBeVisible();await business.screenshot({path:`evidence/nook-1/business-disabled-${width}.png`,animations:'disabled'});
        }
        finally {
            await context.close();
        }
    }
}
finally {
    await browser.close();
}

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runSlackBrowser(process.env.SLACK_PROOF_ORIGIN??'http://127.0.0.1:15930');
