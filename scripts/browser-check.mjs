// Real-browser checks against a running app: same-origin writes, a cross-origin attempt,
// keyboard access to the ranking table's offscreen buttons at 390 px, and axe rules.
// Usage: npm run dev (other terminal), then APP_URL=http://127.0.0.1:8787 node scripts/browser-check.mjs
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const APP = (process.env.APP_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const SHOTS = process.env.SHOTS ?? 'docs/screenshots';
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const out = { app: APP, checks: [] };
const record = (name, pass, detail) => out.checks.push({ name, pass, ...detail });
const revision = (page) => page.evaluate(async () => (await (await fetch('/api/state')).json()).revision);

// A plain page on another origin (another port), with no CSP of its own, to act as the attacker.
// Same host means same site, so the SameSite=Lax visitor cookie is still sent: only the server checks stand in the way.
const other = createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<!doctype html><title>Other origin</title><p>Other origin</p>'); });
await new Promise((ok) => other.listen(0, new URL(APP).hostname, ok));
const OTHER = `http://${new URL(APP).hostname}:${other.address().port}`;

const browser = await chromium.launch();
try {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mobile.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${APP}/#/choose`);
  const region = page.getByRole('region', { name: /Workflow ranking table/ });
  await region.waitFor();

  const name = await region.getAttribute('aria-label');
  const hint = await page.locator(`#${await region.getAttribute('aria-describedby')}`);
  const box = await region.boundingBox();
  const widths = await region.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  record('ranking table scrolls inside its card at 390 px, and says so', widths.scroll > widths.client && (await hint.isVisible()), { regionName: name, hint: await hint.textContent(), clientWidth: widths.client, scrollWidth: widths.scroll });

  await region.focus();
  const before = await region.evaluate((el) => el.scrollLeft);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  const afterArrows = await region.evaluate((el) => el.scrollLeft);
  record('arrow keys scroll the focused region', afterArrows > before, { scrollLeftBefore: before, scrollLeftAfter: afterArrows });

  await region.evaluate((el) => { el.scrollLeft = 0; });
  await region.focus();
  let tabs = 0, active = null;
  while (tabs < 40) {
    await page.keyboard.press('Tab'); tabs++;
    active = await page.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, label: a.getAttribute('aria-label') ?? a.textContent?.trim() } : null; });
    if (active?.tag === 'BUTTON' && /^Select /.test(active.label ?? '')) break;
  }
  const geo = await page.evaluate(() => {
    const a = document.activeElement.getBoundingClientRect();
    const r = document.activeElement.closest('.scroll'); const rr = r.getBoundingClientRect();
    return { button: [Math.round(a.left), Math.round(a.right)], region: [Math.round(rr.left), Math.round(rr.right)], scrollLeft: r.scrollLeft, inside: a.left >= rr.left - 1 && a.right <= rr.right + 1 };
  });
  await page.screenshot({ path: `${SHOTS}/m-choose-keyboard-select.png` });
  record('Tab reaches the offscreen Select button and scrolls it into view', /^Select /.test(active?.label ?? '') && geo.inside && geo.scrollLeft > 0, { tabsFromRegion: tabs, focused: active?.label, ...geo, screenshot: `${SHOTS}/m-choose-keyboard-select.png` });

  const rev0 = await revision(page);
  await page.keyboard.press('Enter');
  const dialog = page.locator('dialog[open]');
  await dialog.waitFor();
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/commands') && r.method() === 'POST'),
    dialog.getByRole('button', { name: 'Select workflow' }).click(),
  ]);
  const res = await req.response();
  const h = await req.allHeaders();
  await page.getByRole('button', { name: /Select .*/ }).first().waitFor();
  const rev1 = await revision(page);
  record('normal same-origin browser write succeeds', res.status() === 200 && rev1 === rev0 + 1, { origin: h.origin, secFetchSite: h['sec-fetch-site'], xRequestedWith: h['x-requested-with'], status: res.status(), revisionBefore: rev0, revisionAfter: rev1 });

  {
    const evil = await mobile.newPage();
    await evil.goto(`${OTHER}/`);
    const seen = [];
    evil.on('response', async (r) => {
      if (!r.url().startsWith(`${APP}/api/commands`)) return;
      const h = await r.request().allHeaders();
      let error = null; try { error = (await r.json()).error; } catch { /* opaque */ }
      seen.push({ method: r.request().method(), status: r.status(), error, origin: h.origin ?? null, cookieSent: /cwl_visitor=/.test(h.cookie ?? '') });
    });
    const body = JSON.stringify({ expectedRevision: rev1, command: { type: 'reset' } });
    const attempts = await evil.evaluate(async ({ target, body }) => {
      const tryFetch = async (init) => { try { const r = await fetch(target, init); return r.type === 'opaque' ? 'sent; response opaque to the page' : `status ${r.status}`; } catch (e) { return `blocked by the browser: ${e.name}`; } };
      return {
        fetchWithCustomHeader: await tryFetch({ method: 'POST', mode: 'cors', credentials: 'include', headers: { 'content-type': 'application/json', 'x-requested-with': 'cwl' }, body }),
        simpleNoCorsPost: await tryFetch({ method: 'POST', mode: 'no-cors', credentials: 'include', headers: { 'content-type': 'text/plain' }, body }),
      };
    }, { target: `${APP}/api/commands`, body });
    const [nav] = await Promise.all([
      evil.waitForResponse((r) => r.url().startsWith(`${APP}/api/commands`) && r.request().method() === 'POST' && r.request().resourceType() === 'document'),
      evil.evaluate(({ target, body }) => { const f = document.createElement('form'); f.method = 'POST'; f.action = target; f.enctype = 'text/plain'; const i = document.createElement('input'); i.name = body.slice(0, -2); i.value = '"}'; f.append(i); document.body.append(f); f.submit(); }, { target: `${APP}/api/commands`, body }),
    ]);
    attempts.formPost = `status ${nav.status()}`;
    await evil.waitForTimeout(300);
    const rev2 = await revision(page);
    record('cross-origin page cannot write, even with the visitor cookie attached', rev2 === rev1 && seen.every((x) => x.status >= 400 || x.method === 'OPTIONS'), { attackerOrigin: OTHER, attempts, serverResponsesSeen: seen, revisionBefore: rev1, revisionAfter: rev2 });
  }

  const axe = {};
  for (const [label, ctxOpts] of [['390', { viewport: { width: 390, height: 844 } }], ['1366', { viewport: { width: 1366, height: 900 } }]]) {
    // The app's CSP (script-src 'self') blocks injected scripts; axe needs one, so only these contexts bypass CSP.
    const p = await (await browser.newContext({ ...ctxOpts, bypassCSP: true })).newPage();
    for (const route of ['choose', 'build-buy', 'desk', 'effort', 'playbook', 'evals', 'about']) {
      await p.goto(`${APP}/#/${route}`);
      await p.locator('#page-title').waitFor();
      await p.waitForTimeout(150);
      await p.addScriptTag({ content: axeSource });
      const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((v) => v.id));
      axe[`${label} ${route}`] = r;
    }
  }
  record('axe: no violations on 7 pages at 390 and 1366 px', Object.values(axe).every((v) => v.length === 0), { axe });
  record('no console or page errors', errors.length === 0, { errors });
} finally {
  await browser.close();
  other.close();
}
console.log(JSON.stringify(out, null, 2));
process.exitCode = out.checks.every((c) => c.pass) ? 0 : 1;
