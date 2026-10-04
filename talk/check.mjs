import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { makeDeck } from './deck.mjs';
import { excerpts, caseDates } from './cases.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const stats = JSON.parse(await fs.readFile(path.join(root, '../data/derived/stats.json'), 'utf8'));
const slides = makeDeck(stats);
const mainCount = slides.filter(slide => !slide.backup).length;
const out = path.join(root, 'slides');
const render = path.join(root, '.render');
await fs.mkdir(render, { recursive: true });
const deliveryScript = await fs.readFile(path.join(out, 'recognition-resistance-2026-speaker-notes.md'), 'utf8');
const sourceNotes = await fs.readFile(path.join(out, 'recognition-resistance-2026-source-notes.md'), 'utf8');
assert.equal((deliveryScript.match(/^## \d{2} · /gm) ?? []).length, slides.length);
assert.equal((sourceNotes.match(/^## \d{2} · /gm) ?? []).length, slides.length);
assert.ok(!deliveryScript.includes('**Sources / evidence:**'), 'Keep research blocks out of the delivery script');
assert.equal(slides.filter(s => !s.backup).reduce((sum, s) => sum + s.seconds, 0), 1800);
const previousTimes = new Map();
for (const turn of Object.values(excerpts)) {
  assert.match(turn.record, /^\d{6}$/);
  assert.equal(turn.date, caseDates[turn.caseId]);
  assert.ok(turn.en && turn.role);
  assert.ok(turn.kind !== 'excerpt' || turn.he, 'Quoted excerpts need the Hebrew original');
  if (turn.time) {
    assert.ok(turn.time > (previousTimes.get(turn.caseId) ?? ''),
      `Case ${turn.caseId}: curated excerpts must remain chronological`);
    previousTimes.set(turn.caseId, turn.time);
  }
}
assert.equal(slides.filter(slide => slide.preview).length, 4);
const used = new Set(slides.flatMap(slide => slide.dialogue));
for (const turn of Object.values(excerpts)) assert.ok(used.has(turn), `Unused excerpt: ${turn.record}`);
const replayed = new Map(slides.filter(slide => slide.quotes.length).map(slide =>
  [slide.quotes[0].turn, slide.quotes[0].display]));
for (const key of ['rce', 'rceRefusal', 'ssh', 'sshRefusal', 'apology', 'testRequest',
  'testSent', 'spoofReason', 'intent', 'mapped', 'noAccess', 'retrieved', 'launched']) {
  assert.ok(replayed.has(excerpts[key]), `Essential context must appear on screen, not only in notes: ${key}`);
}
assert.equal(replayed.get(excerpts.apology), excerpts.apology.en, 'Keep the complete ownership rationale');
assert.ok(replayed.get(excerpts.intent).includes('1)') && replayed.get(excerpts.intent).includes('2)'),
  'Show the actual alternatives before the participant selects one');
const seen = new Set(), lastShown = new Map();
for (const slide of slides.filter(slide => !slide.backup)) {
  for (const turn of slide.dialogue) {
    assert.ok(Object.values(excerpts).includes(turn), 'Slide cites an unknown excerpt');
    if (seen.has(turn)) continue; // Takeaway slides can revisit earlier evidence.
    assert.ok(turn.time > (lastShown.get(turn.caseId) ?? ''), `Out-of-order reveal: ${turn.record}`);
    lastShown.set(turn.caseId, turn.time);
    seen.add(turn);
  }
}
for (const [index, slide] of slides.entries()) {
  assert.match(slide.speech.spoken, /[\u0590-\u05ff]/, `Slide ${index + 1} needs a Hebrew speaking script`);
  assert.match(slide.speech.cue, /[\u0590-\u05ff]/, `Slide ${index + 1} needs a Hebrew delivery cue`);
  assert.ok(slide.reference.length > 100, `Slide ${index + 1} needs research reference notes`);
  assert.ok(slide.notes.indexOf(slide.speech.spoken) < slide.notes.indexOf(slide.speech.cue),
    `Slide ${index + 1}: speaking text must precede delivery instructions`);
  assert.ok(deliveryScript.includes(`**לומר**\n\n${slide.speech.spoken}\n\n**ביצוע — לא להקריא**\n\n${slide.speech.cue}`),
    `Slide ${index + 1}: missing or altered delivery script`);
  assert.ok(sourceNotes.includes(slide.reference), `Slide ${index + 1}: missing research reference`);
  if (!slide.backup) assert.ok(slide.visibleWords <= 60, `Too much stage text: ${index + 1}`);
  for (const item of slide.items) {
    assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.w <= 1600 && item.y + item.h <= 900,
      `Out-of-frame item on slide ${index + 1}`);
    if (item.type === 'qr') assert.ok(item.alt && item.url, `QR destination needs a label on slide ${index + 1}`);
  }
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, offline: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(out, 'recognition-resistance-2026.html')).href);
  await page.evaluate(() => { document.getElementById('help').hidden = true; });
  const overflows = [];
  const overlaps = [];
  const occlusions = [];
  for (let i = 1; i <= slides.length; i++) {
    await page.evaluate(n => { location.hash = String(n); }, i);
    await page.waitForFunction(n => document.querySelector('.slide.active').id === `slide-${n}`, i);
    const issues = await page.locator('.slide.active .text').evaluateAll(elements => elements.flatMap(el =>
      el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2
        ? [{ text: el.textContent.slice(0, 80), actual: [el.scrollWidth, el.scrollHeight], box: [el.clientWidth, el.clientHeight] }] : []));
    overflows.push(...issues.map(issue => ({ slide: i, ...issue })));
    const collisions = await page.locator('.slide.active .text').evaluateAll(elements => {
      const boxes = elements.map(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return { bounds: range.getBoundingClientRect(), text: el.textContent.slice(0, 65) };
      });
      return boxes.flatMap((a, n) => boxes.slice(n + 1).flatMap(b => {
        const width = Math.min(a.bounds.right, b.bounds.right) - Math.max(a.bounds.left, b.bounds.left);
        const height = Math.min(a.bounds.bottom, b.bounds.bottom) - Math.max(a.bounds.top, b.bounds.top);
        return width > 3 && height > 3 ? [{ first: a.text, second: b.text }] : [];
      }));
    });
    overlaps.push(...collisions.map(collision => ({ slide: i, ...collision })));
    const coveredText = await page.locator('.slide.active .text').evaluateAll(elements => elements.flatMap(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const bounds = range.getBoundingClientRect();
      for (let next = el.nextElementSibling; next; next = next.nextElementSibling) {
        if (!next.matches('div[aria-hidden="true"]') || getComputedStyle(next).backgroundColor === 'rgba(0, 0, 0, 0)') continue;
        const cover = next.getBoundingClientRect();
        const width = Math.min(bounds.right, cover.right) - Math.max(bounds.left, cover.left);
        const height = Math.min(bounds.bottom, cover.bottom) - Math.max(bounds.top, cover.top);
        if (width > 3 && height > 3) return [{ text: el.textContent.slice(0, 80) }];
      }
      return [];
    }));
    occlusions.push(...coveredText.map(issue => ({ slide: i, ...issue })));
    await page.screenshot({ path: path.join(render, `slide-${String(i).padStart(2, '0')}.png`) });
  }
  await page.keyboard.press('Home');
  await page.mouse.click(800, 450);
  assert.equal(await page.locator('.slide.active').getAttribute('id'), 'slide-2');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('.slide.active').getAttribute('id'), 'slide-1');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.slide.active').getAttribute('id'), 'slide-2');
  await page.keyboard.press('n');
  assert.equal(await page.locator('#notes').isVisible(), true);
  assert.equal(await page.locator('#spoken-notes').getAttribute('dir'), 'rtl');
  assert.equal(await page.locator('#spoken-notes').textContent(), slides[1].notes);
  assert.equal(await page.locator('#reference-notes').isVisible(), false);
  await page.locator('#notes summary').click();
  assert.equal(await page.locator('#reference-notes').isVisible(), true);
  assert.equal(await page.locator('.slide.active').getAttribute('id'), 'slide-2');
  await page.locator('#notes summary').click();
  await page.locator('#notes h2').click();
  assert.equal(await page.locator('.slide.active').getAttribute('id'), 'slide-2');
  await page.keyboard.press('n');
  await page.keyboard.press('End');
  assert.equal(await page.locator('.slide.active').getAttribute('id'), `slide-${mainCount}`);
  await page.keyboard.press('b');
  assert.equal(await page.locator('.slide.active').getAttribute('id'), `slide-${mainCount + 1}`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(() => {
    const bounds = document.querySelector('.slide.active').getBoundingClientRect();
    return Math.abs(bounds.width - 1280) < 1 && Math.abs(bounds.height - 720) < 1;
  });
  const box = await page.locator('.slide.active').boundingBox();
  assert.ok(Math.abs(box.width - 1280) < 1 && Math.abs(box.height - 720) < 1);
  await fs.writeFile(path.join(render, 'layout-report.json'), JSON.stringify({ overflows, overlaps, occlusions, errors }, null, 2));
  assert.deepEqual(errors, [], 'Browser runtime errors');
  assert.deepEqual(overflows, [], 'Text overflow; inspect .render/layout-report.json');
  assert.deepEqual(overlaps, [], 'Overlapping text; inspect .render/layout-report.json');
  assert.deepEqual(occlusions, [], 'Text hidden by later shapes; inspect .render/layout-report.json');
  await page.locator('.slide').evaluateAll(elements => elements.forEach(el => el.removeAttribute('aria-hidden')));
  await page.pdf({
    path: path.join(out, 'recognition-resistance-2026.pdf'),
    printBackground: true, preferCSSPageSize: true, tagged: true,
  });
  const preview = await context.newPage();
  await preview.setViewportSize({ width: 1600, height: 980 });
  const tiles = [];
  for (const n of slides.flatMap((slide, i) => slide.preview ? [i + 1] : [])) {
    const image = await fs.readFile(path.join(render, `slide-${String(n).padStart(2, '0')}.png`));
    tiles.push(`<figure><figcaption>SLIDE ${String(n).padStart(2, '0')}</figcaption><img src="data:image/png;base64,${image.toString('base64')}"></figure>`);
  }
  await preview.setContent(`<style>
    body{margin:0;padding:16px;background:#D7D2C7;display:grid;grid-template-columns:1fr 1fr;gap:16px;font:16px Arial;color:#202622}
    figure{margin:0}figcaption{height:28px}img{display:block;width:100%}
    </style>${tiles.join('')}`);
  await preview.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await preview.screenshot({ path: path.join(out, 'recognition-resistance-2026-preview.png') });
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1600, height: Math.ceil(slides.length / 5) * 203 + 24 });
  const allTiles = [];
  for (let n = 1; n <= slides.length; n++) {
    const image = await fs.readFile(path.join(render, `slide-${String(n).padStart(2, '0')}.png`));
    allTiles.push(`<figure><figcaption>${n}${slides[n - 1].backup ? ' / BACKUP' : ''}</figcaption><img src="data:image/png;base64,${image.toString('base64')}"></figure>`);
  }
  await sheet.setContent(`<style>body{margin:0;padding:12px;background:#CCD2D3;display:grid;grid-template-columns:repeat(5,1fr);gap:10px;font:16px Arial;color:#141C25}figure{margin:0}figcaption{height:23px}img{width:100%;display:block}</style>${allTiles.join('')}`);
  await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await sheet.screenshot({ path: path.join(render, 'contact-sheet.png'), fullPage: true });
  console.log(`All ${slides.length} slides render offline without text overflow. Navigation and Hebrew notes work.`);
  console.log('Exported 16:9 PDF. Screenshots and layout report: talk/.render/');
} finally {
  await browser.close();
}
