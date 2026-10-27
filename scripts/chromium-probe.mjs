import {chromium} from '@playwright/test';

// Use the installed, bundled headless shell and Playwright's default arguments.
const browser = await chromium.launch({
  headless: true,
  args: ['--use-mock-keychain', '--password-store=basic'],
});
try {
  const page = await browser.newPage();
  await page.goto('data:text/html,<title>Chromium probe</title>');
  if (await page.title() !== 'Chromium probe') throw new Error('Chromium probe failed');
} finally {
  await browser.close();
}
