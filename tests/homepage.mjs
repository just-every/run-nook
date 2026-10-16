import assert from 'node:assert/strict'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {sitePreview} from '@runeditrun/rer/internal/cli/site-preview.mjs'

const instance = new URL(process.env.TEAM_CHAT_HOMEPAGE_ORIGIN || 'http://127.0.0.1:15970')
const site = await sitePreview(resolve('dist/site'), {ports: Array.from({length: 30}, (_, i) => 18720 + i)})
const origin = new URL(site.url)
const evidence = resolve(process.env.TEAM_CHAT_HOMEPAGE_EVIDENCE_DIR || '/tmp/team-chat-homepage-evidence')
const {sourceRepository} = JSON.parse(await readFile(new URL('../rer-project.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({headless: true,channel:'chromium'})
const contexts = []
const requestLog = []
const pageErrors = []
const failedRequests = []

async function open(viewport, options = {}) {
  const context = await browser.newContext({viewport, reducedMotion: 'reduce', ...options})
  contexts.push(context)
  const page = await context.newPage()
  page.on('request', request => requestLog.push(request.url()))
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()) })
  page.on('requestfailed', request => failedRequests.push({url: request.url(), error: request.failure()?.errorText}))
  const response = await page.goto(origin.href, {waitUntil: 'networkidle'})
  assert.equal(response?.status(), 200, `homepage responds at ${viewport.width}x${viewport.height}`)
  if (options.javaScriptEnabled !== false) await page.evaluate(() => document.fonts.ready)
  return page
}

// Geometry a visitor would notice: the fold, overflow, and the drawing staying whole.
function layout(page) {
  return page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
    const alcove = box('.hero-alcove')
    const cards = [...document.querySelectorAll('.hero-alcove .alcove-card')].map(card => card.getBoundingClientRect().toJSON())
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1: box('h1'), primary: box('.hero-primary'), secondary: box('.hero-secondary[href="/docs"]'), brand: box('.site-brand'),
      alcove, cards,
      drawingFont: Math.min(...[...document.querySelectorAll(':is(.hero-alcove, .nook-drawing) :is(p, span, strong, small)')].filter(node => node.textContent.trim() && !node.closest('[aria-hidden="true"]')).map(node => Number.parseFloat(getComputedStyle(node).fontSize))),
    }
  })
}

// The two cards sit whole inside the alcove art, share a left edge and never touch.
function cardsFitAlcove({alcove, cards}) {
  return cards.length === 2
    && cards.every(card => card.left >= alcove.left - 1 && card.right <= alcove.right + 1 && card.top >= alcove.top - 1 && card.bottom <= alcove.bottom + 1)
    && Math.abs(cards[0].left - cards[1].left) <= 1
    && cards[0].bottom <= cards[1].top
}

try {
  await mkdir(evidence, {recursive: true})
  const desktop = await open({width: 1440, height: 900})
  assert.equal(await desktop.getByRole('banner').count(), 1)
  assert.equal(await desktop.getByRole('main').count(), 1)
  assert.equal(await desktop.getByRole('heading', {level: 1}).count(), 1)
  assert.equal(await desktop.locator('h1').evaluate(h1 => h1.childNodes.length === 1 && h1.firstChild.nodeType === Node.TEXT_NODE), true, 'the headline stays one editable text label')

  // Every hero destination is real: home, docs, source and the existing sign-in route.
  const nav = desktop.getByRole('navigation', {name: 'Primary navigation'})
  assert.equal(await desktop.locator('.site-brand').getAttribute('href'), '/')
  assert.equal(await desktop.getByRole('link', {name: 'Nook', exact: true}).count(), 1, 'the brand home link is named for the product')
  assert.deepEqual(await nav.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/docs', sourceRepository])
  assert.equal(await desktop.locator('.hero-primary').getAttribute('href'), '/run')
  assert.equal(await desktop.locator('.hero-secondary[href="/docs"]').count(), 1)
  assert.equal(await desktop.locator('a[href="#"], a[href=""]').count(), 0, 'no placeholder links')
  assert.equal(await desktop.locator(':is(.hero-alcove, .nook-drawing) :is(button, input, a)').count(), 0, 'the drawings contain no false controls')

  // Every link on the page leads somewhere real: on-site pages answer, off-site links go to the declared source or the hosted demo.
  const hrefs = [...new Set(await desktop.locator('a[href]').evaluateAll(links => links.map(link => link.href)))]
  for (const href of hrefs) {
    const url = new URL(href)
    if (url.origin !== origin.origin) { assert.ok(href.startsWith(sourceRepository) || href === 'https://demo.run-nook.com/', `off-site link is the source repository or the demo: ${href}`); continue }
    if (url.pathname === '/' && url.hash) { assert.equal(await desktop.locator(url.hash).count(), 1, `${url.hash} exists`); continue }
    const response = await desktop.request.get(href, {maxRedirects: 0})
    assert.ok(response.status() < 400, `${url.pathname} answers (${response.status()})`)
  }

  // The drawings are real text: each one named for assistive technology; the hero is one alcove figure with two live cards over decorative art.
  assert.equal(await desktop.locator('figure.hero-alcove').count(), 1)
  assert.equal(await desktop.locator('.hero-alcove > svg[aria-hidden="true"]').count(), 1, 'the alcove art is decoration')
  assert.equal(await desktop.getByRole('figure').evaluateAll(figures => figures.every(figure => (figure.getAttribute('aria-label') || '').length > 0)), true, 'every drawing has an accessible description')
  assert.equal(await desktop.locator('.hero-alcove .alcove-card').count(), 2)
  assert.equal(await desktop.locator('.hero-alcove .alcove-card').evaluateAll(cards => cards.every(card => !card.closest('[aria-hidden="true"]') && card.innerText.trim().length > 0)), true)
  assert.equal(await desktop.evaluate(() => document.fonts.check('600 20px "Nook Display"') && document.fonts.check('400 16px "Nook Text"')), true, 'self-hosted brand fonts load')

  const wide = await layout(desktop)
  assert.ok(wide.scrollWidth <= wide.width, '1440px has no horizontal overflow')
  assert.ok(wide.secondary.bottom < 900 && wide.primary.bottom < 900, 'both actions are above the 1440 fold')
  assert.ok(wide.alcove.bottom < 900 && wide.cards.every(card => card.bottom < 900), 'the whole alcove is above the 1440 fold')
  assert.ok(cardsFitAlcove(wide), '1440px cards sit inside the alcove, aligned and apart')
  assert.ok(wide.drawingFont >= 15, 'drawing strings read at a glance on desktop')
  await desktop.screenshot({path: resolve(evidence, 'homepage-1440-fold.jpg'), type: 'jpeg', quality: 86})

  await desktop.keyboard.press('Tab')
  assert.equal(await desktop.evaluate(() => document.activeElement.className), 'home-skip-link', 'the skip link is the first stop')
  await desktop.keyboard.press('Enter')
  await desktop.waitForFunction(() => document.activeElement?.id === 'main-content')

  await desktop.locator('.hero-secondary[href="/docs"]').click()
  await desktop.waitForURL('**/docs')
  assert.equal(await desktop.getByRole('navigation', {name: 'Documentation'}).count(), 1, 'Read the docs opens the public guides')

  for (const viewport of [{width: 768, height: 1024}, {width: 390, height: 844}, {width: 320, height: 700}]) {
    const page = await open(viewport)
    const narrow = await layout(page)
    assert.ok(narrow.scrollWidth <= narrow.width, `${viewport.width}px has no horizontal overflow`)
    assert.ok(narrow.brand.left >= 0, `${viewport.width}px header stays on screen`)
    assert.ok(narrow.alcove.left >= 0 && narrow.alcove.right <= narrow.width, `${viewport.width}px alcove stays on screen`)
    assert.ok(cardsFitAlcove(narrow), `${viewport.width}px cards sit inside the alcove, aligned and apart`)
    assert.ok(narrow.drawingFont >= 13, `${viewport.width}px drawing strings stay readable`)
    if (viewport.width === 390) {
      assert.ok(narrow.secondary.bottom < 844, 'both actions are above the 390 fold')
      for (const selector of ['.site-brand', '.site-nav a[href="/docs"]', '.hero-primary', '.hero-secondary[href="/docs"]', '.hero-secondary[href="https://demo.run-nook.com/"]']) {
        const bounds = await page.locator(selector).boundingBox()
        assert.ok(bounds && bounds.height >= 44, `${selector} is a 44px tap target`)
      }
      await page.screenshot({path: resolve(evidence, 'homepage-390-fold.jpg'), type: 'jpeg', quality: 86})
      await page.screenshot({path: resolve(evidence, 'homepage-390-full.jpg'), type: 'jpeg', quality: 82, fullPage: true})
    }
  }

  for (const url of requestLog) {
    const request = new URL(url)
    assert.equal(request.origin, origin.origin, `public homepage requests stay local: ${url}`)
    assert.ok(!request.pathname.startsWith('/api/'), `public homepage makes no private API request: ${url}`)
  }
  assert.deepEqual(pageErrors, [], 'no browser, hydration or console errors')
  assert.deepEqual(failedRequests, [], 'all homepage assets load')

  // A visitor who scrolls sees every drawing below the hero settle in and stay.
  const scroller = await open({width: 390, height: 844}, {reducedMotion: 'no-preference'})
  const drawings = scroller.locator('.home-section .nook-drawing')
  assert.ok(await drawings.count() >= 4, 'each section below the hero has its drawing')
  for (let index = 0; index < await drawings.count(); index++) {
    await drawings.nth(index).scrollIntoViewIfNeeded()
    await scroller.waitForFunction(element => getComputedStyle(element).opacity === '1', await drawings.nth(index).elementHandle(), {timeout: 3000})
  }
  await scroller.evaluate(() => scrollTo(0, 0))
  assert.equal(await drawings.evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1')), true, 'drawings stay visible after scrolling back up')

  // Server-rendered: the hero, its drawing and its links work without JavaScript.
  const noJs = await open({width: 390, height: 844}, {javaScriptEnabled: false})
  assert.ok(await noJs.locator('.hero-sub').isVisible(), 'SSR hero is readable without JavaScript')
  assert.equal(await noJs.locator('.hero-alcove .alcove-card').count(), 2, 'SSR drawing is present without JavaScript')
  assert.equal(await noJs.locator('.home-section .nook-drawing').evaluateAll(nodes => nodes.length >= 4 && nodes.every(node => getComputedStyle(node).opacity === '1')), true, 'every section drawing is in place without JavaScript')
  assert.equal(await noJs.locator('a[href="/signin"]').count(), 0, 'the run site omits instance-only links')
  await noJs.goto(new URL('/docs', origin).href)
  await noJs.locator('.docs-menu summary').click()
  await noJs.locator('.docs-menu-list a[href="/docs/install"]').click()
  assert.equal(new URL(noJs.url()).pathname, '/docs/install', 'static mobile navigation works without JavaScript')
  await noJs.goto(new URL('/signin', instance).href)
  assert.equal(new URL(noJs.url()).pathname, '/signin', 'Sign in reaches the existing route without JavaScript')
  assert.equal(await noJs.getByRole('link', {name: 'Read the Nook guides', exact: true}).getAttribute('href'), '/docs')
  const emailInput = noJs.getByLabel(/email/i)
  assert.equal(await emailInput.count(), 1, '/signin exposes the operator email challenge without JavaScript')
  assert.equal(await emailInput.getAttribute('type'), 'email')
  assert.equal(await emailInput.getAttribute('required'), '')
  const signInForm = noJs.locator('form').filter({has: emailInput})
  assert.equal(await noJs.locator('form').count(), 1, '/signin exposes only the sign-in request form')
  assert.equal(await signInForm.getAttribute('method'), 'post')
  assert.equal(new URL(await signInForm.getAttribute('action'), noJs.url()).pathname, '/auth/magic-link')
  assert.equal(await noJs.locator('input[type="password"]').count(), 0, 'operator sign-in does not request a password')
  await noJs.getByRole('link', {name: 'Read the Nook guides'}).click()
  await noJs.waitForURL('**/docs')
  assert.equal(await noJs.getByRole('heading', {level: 1}).count(), 1, 'sign-in opens the public docs without JavaScript')

  const docs = await open({width: 390, height: 844})
  await docs.goto(new URL('/docs', instance).href, {waitUntil: 'networkidle'})
  const docsMenu = docs.locator('.docs-menu details')
  const docsMenuSummary = docsMenu.locator('summary')
  assert.equal(await docsMenuSummary.isVisible(), true, 'the narrow docs view exposes a section menu')
  await docsMenuSummary.click()
  assert.equal(await docsMenu.evaluate(element => element.open), true)
  await docs.locator('.docs-menu-list a').first().focus()
  await docs.keyboard.press('Escape')
  assert.equal(await docsMenu.evaluate(element => element.open), false, 'Escape closes the docs menu')
  assert.equal(await docsMenuSummary.evaluate(element => element === document.activeElement), true, 'Escape returns focus to the docs menu summary')
  assert.ok(await docs.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px docs view has no horizontal overflow')

  const report = {status: 'passed', origin: origin.href, layout: wide, screenshots: ['homepage-1440-fold.jpg', 'homepage-390-fold.jpg', 'homepage-390-full.jpg']}
  await writeFile(resolve(evidence, 'homepage-results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({status: report.status, screenshots: evidence}))
} finally {
  for (const context of contexts) await context.close()
  await browser.close()
  await site.close()
}
