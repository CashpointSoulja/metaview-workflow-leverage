// Records the real running app (no staged UI). Frames are screenshots of the live page;
// the pointer dot follows real mouse events and turns yellow on press.
// Usage: APP_URL=http://127.0.0.1:8787 node video/record.mjs   (after ./video/tts.sh)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const work = path.join(here, 'work');
const frames = path.join(work, 'frames');
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });
const APP = process.env.APP_URL ?? 'http://127.0.0.1:8787';
const narration = JSON.parse(fs.readFileSync(path.join(here, 'narration.json'), 'utf8'));
const dur = Object.fromEntries(fs.readFileSync(path.join(work, 'vo', 'durations.txt'), 'utf8').trim().split('\n').map((l) => l.split(' ')).map(([k, v]) => [k, Number(v)]));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    Object.assign(d.style, { position: 'fixed', left: '0', top: '0', width: '18px', height: '18px', margin: '-9px 0 0 -9px', borderRadius: '50%', background: 'rgba(1,5,27,.85)', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.4)', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(640px,360px)' });
    document.documentElement.appendChild(d);
    addEventListener('mousemove', (e) => (d.style.transform = `translate(${e.clientX}px,${e.clientY}px)`), true);
    addEventListener('mousedown', () => (d.style.background = '#FFD23F'), true);
    addEventListener('mouseup', () => setTimeout(() => (d.style.background = 'rgba(1,5,27,.85)'), 180), true);
  });
});
const page = await ctx.newPage();
await page.goto(`${APP}/#/choose`);
await page.waitForSelector('h1');
await page.waitForTimeout(800);

const t0 = Date.now();
const log = { frames: [], lines: [] };
let running = true, n = 0;
const loop = (async () => {
  while (running) {
    const t = (Date.now() - t0) / 1000;
    const file = `f${String(n++).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: path.join(frames, file), type: 'jpeg', quality: 88 });
    log.frames.push({ t, file });
  }
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mx = 640, my = 360;
async function settle(loc) {
  await loc.scrollIntoViewIfNeeded();
  let prev = null;
  for (let i = 0; i < 20; i++) { const b = await loc.boundingBox(); if (prev && b && Math.abs(b.y - prev.y) < 0.5) return b; prev = b; await sleep(50); }
  return loc.boundingBox();
}
async function moveTo(loc, steps = 24) {
  const b = await settle(loc);
  const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await page.mouse.move(mx + (x - mx) * e, my + (y - my) * e); await sleep(16); }
  mx = x; my = y;
}
async function click(loc) {
  const covered = await loc.evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 60), r.top + r.height / 2); return !(hit && (el === hit || el.contains(hit))); });
  if (covered) await scrollTo(loc);
  await moveTo(loc); await sleep(120); await page.mouse.down(); await sleep(90); await page.mouse.up(); await sleep(350); }
async function scrollTo(loc) {
  const target = await loc.evaluate((el) => el.getBoundingClientRect().top + scrollY - (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) - 40);
  const start = await page.evaluate(() => scrollY);
  for (let i = 1; i <= 14; i++) { const k = i / 14, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await page.evaluate((y) => new Promise((r) => { scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(r)); }), start + (target - start) * e); await sleep(30); }
}
const dlg = () => page.locator('dialog[open]');
const submit = (name) => click(dlg().getByRole('button', { name, exact: true }));
const nav = (name) => click(page.locator('nav').getByRole('link', { name }));
const pkt = (id) => click(page.locator('.packets a', { hasText: id }));
const vis = (sel) => page.locator(sel).filter({ visible: true }).first();

const actions = {
  intro: [
    () => moveTo(page.locator('h1')),
    () => moveTo(page.getByText('SYNTHETIC DATA').first()),
    () => moveTo(page.getByText(/^leverage = occurrences/).first()),
    async () => { const row = page.getByText('Candidate search for open roles').first(); await scrollTo(row); await moveTo(row); },
  ],
  select: [
    async () => { const v = page.locator('.verdict').first(); await scrollTo(page.locator('h1')); await moveTo(v); },
    async () => { await click(page.getByRole('button', { name: 'Select Closed-won to onboarding handoff (Enterprise)' })); await sleep(700); await submit('Select workflow'); },
  ],
  buildbuy: [
    () => nav(/Build vs buy/),
    () => moveTo(page.getByText('Buy an onboarding platform (category)').first()),
    async () => { await click(page.locator('main').getByRole('button', { name: /Record/ }).first()); await sleep(400); await dlg().locator('#dec-by').fill('Business Operations (synthetic)'); await sleep(400); await submit('Record decision'); },
  ],
  contradiction: [
    async () => { await nav(/Handoff desk/); await pkt('HO-1002'); await moveTo(vis('blockquote.ev')); },
    () => moveTo(page.locator('.field', { hasText: 'Applicant tracking system' }).locator('.chip').first()),
    async () => {
      await click(page.getByRole('button', { name: 'Resolve applicant tracking system' })); await sleep(300);
      await click(dlg().locator('label', { hasText: 'Greenhouse' }).first());
      await dlg().locator('#rs-r').fill('Recruiters run hiring in it; Workday is HR only'); await dlg().locator('#rs-b').fill('Dana Whitlock'); await sleep(300);
      await submit('Resolve');
    },
  ],
  hostile: [
    async () => { await scrollTo(page.locator('h1')); await pkt('HO-1004'); const q = page.locator('.quarantine'); await scrollTo(q); await moveTo(q); },
    () => moveTo(page.locator('.quarantine pre').first()),
  ],
  execute: [
    async () => {
      await scrollTo(page.locator('h1')); await pkt('HO-1001');
      const a = page.locator('main').getByRole('button', { name: 'Assign owner', exact: true });
      await click(a); await sleep(300); await submit('Assign owner');
    },
    async () => { await click(page.locator('main').getByRole('button', { name: 'Set checkpoint', exact: true })); await sleep(300); await dlg().locator('#cp-d').fill('2026-11-03'); await sleep(250); await submit('Save checkpoint'); },
    async () => { await click(page.locator('main').getByRole('button', { name: 'Approve', exact: true })); await sleep(500); await submit('Approve'); },
    async () => { await click(page.getByRole('button', { name: 'Run bounded workflow' })); await sleep(500); await submit('Run simulation'); const plan = page.locator('ol.plan'); await scrollTo(plan); await moveTo(plan); },
  ],
  effort: [
    async () => { await scrollTo(page.locator('h1')); await nav(/Effort/); await moveTo(page.locator('main table').first()); },
    async () => { const ex = page.getByText(/[Ee]xclu/).last(); await scrollTo(ex); await moveTo(ex); },
  ],
  playbook: [
    async () => { await scrollTo(page.locator('h1')); await nav(/Playbook/); await moveTo(page.locator('pre.export')); },
  ],
  evals: [
    async () => { await nav(/Evals/); await page.waitForSelector('.evalrow'); await moveTo(page.locator('.chip', { hasText: 'pass' }).first()); },
    async () => { const f = page.locator('tr.evalrow.fail').first(); await scrollTo(f); await moveTo(f); },
  ],
};

try {
for (const s of narration) {
  for (let i = 0; i < s.lines.length; i++) {
    const key = `${s.scene}-${i}`;
    const start = (Date.now() - t0) / 1000;
    log.lines.push({ key, start, text: s.lines[i] });
    const minMs = (dur[key] + 0.3) * 1000;
    await Promise.all([actions[s.scene][i]?.(), sleep(minMs)]);
    await sleep(80);
  }
}
} catch (e) { running = false; await loop; await page.screenshot({ path: path.join(work, 'fail.png') }); console.error(e); await browser.close(); process.exit(1); }
await sleep(400);
running = false;
await loop;
log.end = (Date.now() - t0) / 1000;
const errs = await page.evaluate(() => document.querySelector('.toast.error:not([hidden])')?.textContent ?? null);
log.toastError = errs;
fs.writeFileSync(path.join(work, 'timeline.json'), JSON.stringify(log, null, 1));
console.log('frames', log.frames.length, 'seconds', log.end.toFixed(1), 'fps', (log.frames.length / log.end).toFixed(1), 'toastError', errs);
await browser.close();
