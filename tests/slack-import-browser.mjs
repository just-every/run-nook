// Parent runtime/browser lane: existing local Worker with native owner setup.
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { keyed } from './dev-key.mjs';
import { mkdir } from 'node:fs/promises';
import { slackFixture, zipFixture } from './slack-import/fixture.mjs';
import {pathToFileURL} from 'node:url';
export async function runSlackBrowser(origin){
const browser = await keyed(chromium).launch({ headless: true });
try {
    for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } }), page = await context.newPage();
        try {
            await page.goto(origin + '/signin');
            await page.locator('#auth-email').fill('nativeowner@example.test');
            await page.getByRole('button', { name: 'Send sign-in link', exact: true }).click();
            await page.waitForURL(origin + '/__dev/outbox');
            await page.locator('article').filter({ hasText: 'To: nativeowner@example.test' }).first().getByRole('link').first().click();
            await page.getByRole('link', { name: 'Open this link', exact: true }).first().click();
            await page.getByRole('button', { name: 'Confirm', exact: true }).click();
            await page.waitForURL(origin + '/app');
            await page.goto(origin + '/app?view=you');
            await page.getByRole('link',{name:'Import Slack history',exact:true}).click();
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
            await page.getByRole('button', { name: 'Discard unused raw upload', exact: true }).click();
            await page.getByRole('status').filter({ hasText: 'Raw upload discarded.' }).waitFor();
            await page.getByLabel('Slack export ZIP').setInputFiles({ name: 'slack-fixture.zip', mimeType: 'application/zip', buffer: slackFixture() });
            await page.getByLabel('Source workspace namespace').fill('browser-' + width + '-' + Date.now());
            for (const channel of ['general', 'engineering'])
                await page.getByLabel(channel + ' public source').check();
            for (const [index, name] of ['general', 'engineering'].entries()) await page.getByLabel('New channel name', { exact: true }).nth(index).fill(`Imported ${name} ${width}`);
            for (const select of await page.locator('select').all())
                await select.selectOption('external');
            await page.getByRole('button', { name: 'Preview exact import', exact: true }).click();
            await page.getByLabel('I have reviewed these omissions and accept this exact list.').check();
            await page.getByRole('button', { name: 'Confirm omissions and preview again', exact: true }).click();
            await page.getByRole('button', { name: 'Apply reviewed plan', exact: true }).first().click();
            await page.getByRole('status').filter({ hasText: 'completed' }).waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'wizard has no horizontal overflow');
            await mkdir('evidence/nook-1', { recursive: true });
            await page.screenshot({ path: `evidence/nook-1/slack-import-${width}.png`, fullPage: true });
            const channels = await (await context.request.get(origin + '/api/conversations')).json(), channel = channels.find(c => c.name === `Imported general ${width}`);
            assert.ok(channel);
            await page.goto(`${origin}/app?conversation=${channel.id}`);
            const imported = page.locator('.message[data-immutable="true"]').first();
            await imported.waitFor();
            assert.equal(await imported.locator('.message-body').textContent(), '  Exact café 日本語 👋\n');
            assert.equal(await imported.getByRole('button', { name: 'Ask someone', exact: true }).count(), 0);
            assert.equal(await imported.getByRole('button', { name: 'Remove file', exact: true }).count(), 0);
            await imported.getByRole('button', { name: 'Open thread', exact: true }).click();
            await page.locator('.thread-log .message[data-immutable="true"]').nth(1).waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Reply in thread', exact: true }).count(), 0);
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
            assert.ok(await page.getByRole('button', { name: 'Undo this import', exact: true }).count());
            const job = page.locator('.import-job').filter({ hasText: `Imported general ${width}` });
            if (width === 390) {
                // Later native work depends on the import, so undo is refused before any request.
                assert.equal(await job.getByRole('button', { name: 'Undo this import', exact: true }).isDisabled(), true);
                await job.getByRole('note').filter({ hasText: 'Undo is unavailable' }).waitFor();
                await page.screenshot({ path: 'evidence/nook-1/slack-undo-guard-390.png', fullPage: true });
            } else { await job.getByRole('button', { name: 'Undo this import', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'undone' }).waitFor(); }

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
