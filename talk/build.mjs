import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import QRCode from 'qrcode';
import { makeDeck, palette, sources } from './deck.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'slides');
const stats = JSON.parse(await fs.readFile(path.join(root, '../data/derived/stats.json'), 'utf8'));
const slides = makeDeck(stats);
const mainCount = slides.filter(slide => !slide.backup).length;
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const base = 'recognition-resistance-2026';
await fs.mkdir(out, { recursive: true });

for (const slide of slides) {
  for (const item of slide.items) {
    if (item.type === 'qr') item.data = await QRCode.toDataURL(item.url, {
      width: 780, margin: 3, errorCorrectionLevel: 'M', color: { dark: `#${palette.ink}`, light: `#${palette.paper}` },
    });
  }
}

function element(item) {
  const position = `left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px`;
  if (item.type === 'text') {
    return `<div class="text" ${item.rtl ? 'dir="rtl" lang="he"' : 'dir="ltr"'} style="${position};font:${item.bold ? '700' : '400'} ${item.size}px/1.16 '${item.font ?? 'Arial'}',sans-serif;color:#${item.color};text-align:${item.align ?? 'left'}">${escape(item.text)}</div>`;
  }
  if (item.type === 'line') return `<div aria-hidden="true" style="${position};border-top:${item.thickness}px solid #${item.color}"></div>`;
  if (item.type === 'ellipse') return `<div aria-hidden="true" style="${position};border-radius:50%;background:#${item.fill}"></div>`;
  if (item.type === 'rect') return `<div aria-hidden="true" style="${position};background:#${item.fill}"></div>`;
  if (item.type === 'qr') return `<img alt="${escape(item.alt)}" style="${position}" src="${item.data}">`;
  throw new Error(`Unknown item type: ${item.type}`);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recognition ≠ Resistance — Asaf Nakash</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#202622;overflow:hidden}
.slide{position:absolute;width:1600px;height:900px;transform-origin:top left;display:none;overflow:hidden}
.slide.active{display:block}.slide>div,.slide>img{position:absolute}.text{white-space:pre-wrap;overflow:visible}
#help{position:fixed;bottom:0;left:0;padding:8px 14px;background:#202622;color:#F5F1E8;font:14px Arial;z-index:10}
#notes{position:fixed;right:20px;top:20px;width:min(650px,90vw);max-height:90vh;overflow:auto;
background:#F5F1E8;color:#202622;padding:30px;font:21px/1.6 Arial;box-shadow:0 10px 50px #0008;z-index:20}
#notes[hidden],#help[hidden]{display:none}#notes h2{font-size:22px}#notes a{color:#8E3522;overflow-wrap:anywhere}
@page{size:13.333333in 7.5in;margin:0}
@media print{html,body{width:auto;height:auto;overflow:visible;background:white}
.slide,.slide.active{display:block!important;position:relative;transform:none!important;left:0!important;top:0!important;
width:1600px;height:900px;zoom:.8;break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.slide:last-of-type{break-after:auto}#notes,#help{display:none!important}}
</style></head><body>
${slides.map((s, i) => `<section class="slide${i === 0 ? ' active' : ''}" id="slide-${i + 1}" aria-label="${escape(s.title)}" ${i ? 'aria-hidden="true"' : ''}>${s.items.map(element).join('')}</section>`).join('\n')}
<div id="help">Click / → / Space: next · ←: back · N: Hebrew notes · F: fullscreen · B: backup · H: hide help</div>
<aside id="notes" hidden aria-label="Speaker notes"></aside>
<script type="application/json" id="deck-data">${JSON.stringify(slides.map(s => ({
  title: s.title, notes: s.notes, reference: s.reference, seconds: s.seconds, backup: !!s.backup,
  refs: s.refs.map(k => sources[k]),
}))).replace(/</g, '\\u003c')}</script>
<script>
const slides=[...document.querySelectorAll('.slide')];
const data=JSON.parse(document.getElementById('deck-data').textContent);
const notes=document.getElementById('notes');
let index=0;
function resize(){const scale=Math.min(innerWidth/1600,innerHeight/900);slides.forEach(s=>{
s.style.transform='scale('+scale+')';s.style.left=((innerWidth-1600*scale)/2)+'px';s.style.top=((innerHeight-900*scale)/2)+'px';});}
function show(n){index=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,i)=>{s.classList.toggle('active',i===index);s.setAttribute('aria-hidden',String(i!==index));});
history.replaceState(null,'','#'+(index+1));notes.replaceChildren();
const heading=document.createElement('h2');heading.textContent=(index+1)+' / '+slides.length+' — '+data[index].title;notes.append(heading);
const timing=document.createElement('p');timing.textContent=data[index].backup?'Backup slide':'Rehearsal allocation: '+data[index].seconds+' seconds';notes.append(timing);
const body=document.createElement('div');body.id='spoken-notes';body.dir='rtl';body.lang='he';body.style.whiteSpace='pre-wrap';body.textContent=data[index].notes;notes.append(body);
const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='מקורות והערות מחקר — לא להקריא';summary.dir='rtl';details.append(summary);
const reference=document.createElement('div');reference.id='reference-notes';reference.dir='rtl';reference.lang='he';reference.style.whiteSpace='pre-wrap';reference.textContent=data[index].reference;details.append(reference);
data[index].refs.forEach(ref=>{const p=document.createElement('p'),a=document.createElement('a');a.href=ref.url;a.textContent=ref.label;a.target='_blank';a.rel='noopener noreferrer';p.append(a);details.append(p);});notes.append(details);}
addEventListener('resize',resize);
addEventListener('hashchange',()=>show((Number(location.hash.slice(1))||1)-1));
addEventListener('click',e=>{if(notes.hidden&&!e.target.closest('a,#help'))show(index+1);});
addEventListener('keydown',e=>{
if(['ArrowRight','ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();show(index+1);}
if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();show(index-1);}
if(e.key==='Home')show(0);if(e.key==='End')show(${mainCount - 1});
if(e.key.toLowerCase()==='b')show(${mainCount});
if(e.key.toLowerCase()==='n')notes.hidden=!notes.hidden;
if(e.key.toLowerCase()==='h')document.getElementById('help').hidden=!document.getElementById('help').hidden;
if(e.key.toLowerCase()==='f'){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();}
});
resize();show((Number(location.hash.slice(1))||1)-1);
setTimeout(()=>document.getElementById('help').hidden=true,6000);
</script></body></html>`;
await fs.writeFile(path.join(out, `${base}.html`), html);

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'STAGE', width: 40 / 3, height: 7.5 });
pptx.layout = 'STAGE';
pptx.author = 'Asaf Nakash';
pptx.subject = 'Three conversational attack stories and practical defenses for tool-using agents';
pptx.title = 'Recognition ≠ Resistance';
pptx.company = '';
pptx.lang = 'en-US';
pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'en-US' };
const units = v => v / 120;
for (const [index, definition] of slides.entries()) {
  const slide = pptx.addSlide();
  slide.background = { color: definition.dark ? palette.ink : palette.paper };
  for (const item of definition.items) {
    const box = { x: units(item.x), y: units(item.y), w: units(item.w), h: units(item.h) };
    if (item.type === 'text') {
      slide.addText(item.text, {
        ...box, fontFace: item.font ?? 'Arial', fontSize: item.size * .6,
        color: item.color, bold: !!item.bold, align: item.align ?? 'left',
        valign: 'top', margin: 0, breakLine: false, paraSpaceAfterPt: 0,
        rtlMode: !!item.rtl, lang: item.rtl ? 'he-IL' : 'en-US',
      });
    } else if (item.type === 'line') {
      slide.addShape(pptx.ShapeType.line, { ...box, line: { color: item.color, width: item.thickness * .6 }, rotate: 0 });
    } else if (item.type === 'rect' || item.type === 'ellipse') {
      slide.addShape(item.type === 'ellipse' ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
        ...box, line: { color: item.fill, transparency: 100 }, fill: { color: item.fill },
      });
    } else if (item.type === 'qr') {
      slide.addImage({ ...box, data: item.data, altText: item.alt, hyperlink: { url: item.url } });
    }
  }
  slide.addNotes(`${definition.backup ? 'גיבוי — לשאלות בלבד' : `זמן מוקצה לשקף: ${definition.seconds} שניות`}\n\n${definition.notes}\n\nלעיון בנפרד: recognition-resistance-2026-source-notes.md, שקף ${index + 1}.`);
}
await pptx.writeFile({ fileName: path.join(out, `${base}.pptx`) });

const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
let elapsed = 0;
const notes = ['# Recognition ≠ Resistance — Hebrew speaker notes',
  '', 'תסריט דיבור לפי שקף. הטקסט תחת **לומר** נועד לדיבור; **ביצוע** הוא הוראת במה קצרה, לא טקסט להקראה.',
  'המשפט האחרון בכל קטע מוביל לקליק הבא. בשקפי הדיאלוג הקצרים, קוראים ומתקדמים — לא מוסיפים הסבר חדש בכל קליק.',
  'חלוקת הזמן נשארת 30 דקות ועוד 5 דקות לשאלות. זו הקצאת זמן לחזרה, לא מדידה של דיבור בפועל.',
  'המקורות, הקטעים המקוריים וההסתייגויות המפורטות הועברו ל[מסמך העיון הנפרד](recognition-resistance-2026-source-notes.md).',
  'המשאב הציבורי כולל חומרים שנבחרו לשחרור; התמלילים הפרטיים אינם כלולים.', '',
];
notes.push('## Run of show', '', '| Target | Chapter | First click state |',
  '|---|---|---|');
let chapterTime = 0;
for (const chapter of new Set(slides.filter(s => !s.backup).map(s => s.chapter))) {
  const duration = slides.filter(s => !s.backup && s.chapter === chapter).reduce((sum, s) => sum + s.seconds, 0);
  notes.push(`| ${clock(chapterTime)}–${clock(chapterTime + duration)} | ${chapter} | ${slides.findIndex(s => s.chapter === chapter) + 1} |`);
  chapterTime += duration;
}
notes.push('', 'ב־PowerPoint: להשתמש ב־Presenter View. בדפדפן, N מציג את ההערות באותו מסך — לא לפתוח אותן על המקרן.', '');
const referenceNotes = ['# Recognition ≠ Resistance — source notes',
  '', 'Research reference, not a read-aloud script. For delivery use [the Hebrew speaking script](recognition-resistance-2026-speaker-notes.md).', '',
];
slides.forEach((s, i) => {
  notes.push(`## ${String(i + 1).padStart(2, '0')} · ${s.title.replace(/\n/g, ' ')}`, '',
    s.backup ? '**Backup — outside the 30-minute content allocation.**' : `**${clock(elapsed)}–${clock(elapsed + s.seconds)}**`, '',
    '**לומר**', '', s.speech.spoken, '', '**ביצוע — לא להקריא**', '', s.speech.cue, '');
  referenceNotes.push(`## ${String(i + 1).padStart(2, '0')} · ${s.title.replace(/\n/g, ' ')}`, '',
    s.reference, '', '**Sources / evidence:**', ...s.refs.map(k => `- [${sources[k].label}](${sources[k].url})`), '');
  if (!s.backup) elapsed += s.seconds;
});
await fs.writeFile(path.join(out, `${base}-speaker-notes.md`), notes.join('\n'));
await fs.writeFile(path.join(out, `${base}-source-notes.md`), referenceNotes.join('\n'));
await fs.writeFile(path.join(out, `${base}-manifest.json`), JSON.stringify({
  title: pptx.title, mainSlides: mainCount, backupSlides: slides.length - mainCount,
  contentSeconds: elapsed, qaSeconds: 300, aspectRatio: '16:9',
  maximumMainSlideWords: Math.max(...slides.filter(s => !s.backup).map(s => s.visibleWords)),
  spokenWords: slides.filter(s => !s.backup).reduce((sum, s) => sum + s.spokenWords, 0),
  chapters: [...new Set(slides.filter(s => !s.backup).map(s => s.chapter))].map(chapter => ({
    title: chapter,
    firstSlide: slides.findIndex(s => s.chapter === chapter) + 1,
    seconds: slides.filter(s => !s.backup && s.chapter === chapter).reduce((sum, s) => sum + s.seconds, 0),
  })),
  publicRelease: 'public', corpusGeneratedAt: stats.generated_at,
  slides: slides.map((s, i) => ({
    number: i + 1, title: s.title, chapter: s.chapter, seconds: s.seconds, backup: !!s.backup,
    visibleWords: s.visibleWords,
    spokenWords: s.spokenWords,
    sources: s.refs.map(k => sources[k].url),
    excerpts: (s.dialogue ?? []).map(({ record, role, time, date, kind }) => ({ record, role, time, date, kind })),
    displayedQuotes: s.quotes.map(({ turn, display }, index) => ({
      record: turn.record, date: turn.date, role: turn.role, text: display,
      purpose: index === 0 ? 'current message' : 'earlier context',
    })),
  })),
}, null, 2) + '\n');
console.log(`Built ${mainCount} main slides + ${slides.length - mainCount} backup slides; ${elapsed / 60} minutes.`);
console.log(`Outputs: talk/slides/${base}.{html,pptx}, speaker notes, and source manifest.`);
