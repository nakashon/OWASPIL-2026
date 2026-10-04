#!/usr/bin/env node
/**
 * Stage 4 — translate.
 *
 * Adds an English rendering alongside every message. The original text is never
 * modified or replaced: `message` stays exactly as it was sent, and `message_en`
 * is added next to it. Most of the corpus is Hebrew, and a talk audience — and
 * anyone auditing the numbers later — needs to be able to read what was actually
 * said without trusting a paraphrase.
 *
 * Runs on `data/anonymized/`, never on `data/interim/`. By the time text reaches
 * this stage the senders are already pseudonyms, so no real name is handed to a
 * model. That ordering is enforced below rather than left to convention.
 *
 * Translation is cached by content hash, so identical strings — and the bot
 * repeats itself constantly — cost one call, and an interrupted run resumes
 * where it stopped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { FIELDS, toCsv } from './lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const IN = path.join(ROOT, 'data/anonymized');
const OUT = path.join(ROOT, 'data/translated');
const CACHE = path.join(ROOT, 'data/translation-cache.json');

const MODEL = process.env.TRANSLATE_MODEL ?? 'claude-sonnet-4.6';
const BATCH = Number(process.env.TRANSLATE_BATCH ?? 40);
const LIMIT = Number(process.env.TRANSLATE_LIMIT ?? Infinity);
const CONCURRENCY = Number(process.env.TRANSLATE_CONCURRENCY ?? 1);
const RETRIES = 2;

const HEBREW = /[\u0590-\u05FF]/;

/** Detected purely to decide what needs translating; not a linguistic claim. */
export function detectLang(text) {
  return HEBREW.test(text ?? '') ? 'he' : 'en';
}

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

function readJsonl(file) {
  const full = path.join(IN, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${full}. Run \`npm run anonymize\` first.`);
    process.exit(1);
  }
  return fs
    .readFileSync(full, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function loadCache() {
  if (!fs.existsSync(CACHE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    console.warn('Translation cache unreadable; starting a fresh one.');
    return {};
  }
}

const saveCache = (cache) => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 0));

const PROMPT = [
  'You are translating Hebrew messages from a published security research dataset.',
  'Read the JSON array in the input file. Each element is {"i": <int>, "he": "<text>"}.',
  'Write ONLY a JSON array of {"i": <int>, "en": "<english translation>"} to the output file.',
  'Return one element for every input element, with the same "i" values.',
  '',
  'Rules:',
  '- Translate literally. This is evidence: preserve tone, slang, rudeness and profanity rather than cleaning them up.',
  '- Leave tokens matching participant_XXXX, agent, and unattributed exactly as they are. They are pseudonyms.',
  '- Leave code, commands, file names, URLs and technical identifiers in their original form.',
  '- Keep emoji in place.',
  '- Any personal name that is not already a pseudonym must be replaced with [name] rather than transliterated.',
  '- If a message is already English, copy it through unchanged.',
  '- Never add commentary, notes or explanation to a translation.',
].join('\n');

function runCopilot(inFile, outFile, tmpDirForRun) {
  return new Promise((resolve, reject) => {
    execFile(
      'copilot',
      [
        '-p',
        `${PROMPT}\n\nInput file: ${inFile}\nOutput file: ${outFile}`,
        '--allow-all-tools',
        '--add-dir',
        tmpDirForRun,
        '--no-custom-instructions',
        '--log-level',
        'none',
        '--model',
        MODEL,
      ],
      { timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

async function translateBatch(items, tmpDir, label) {
  const inFile = path.join(tmpDir, `batch-${label}.in.json`);
  const outFile = path.join(tmpDir, `batch-${label}.out.json`);

  fs.writeFileSync(inFile, JSON.stringify(items.map((it, i) => ({ i, he: it.text })), null, 0));

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      fs.rmSync(outFile, { force: true });
      await runCopilot(inFile, outFile, tmpDir);
      const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      const byIndex = new Map(parsed.map((r) => [r.i, r.en]));
      const missing = items.map((_, i) => i).filter((i) => typeof byIndex.get(i) !== 'string');
      if (missing.length) throw new Error(`${missing.length} of ${items.length} missing`);
      return byIndex;
    } catch {
      /* fall through to the next attempt */
    }
  }
  return null;
}

/**
 * Translate a batch, halving it on failure until the problem items are isolated.
 *
 * A batch fails when the model does not produce a usable file, and the cause is
 * rarely the whole batch — one awkward string can take the rest down with it.
 * Splitting converges on the offender instead of discarding good work, and a
 * single item that still fails is left untranslated rather than retried forever.
 */
async function translateWithSplit(items, tmpDir, label, onDone) {
  const result = await translateBatch(items, tmpDir, label);
  if (result) {
    items.forEach((item, i) => onDone(item, result.get(i)));
    return;
  }
  if (items.length === 1) {
    onDone(items[0], null);
    return;
  }
  const mid = Math.ceil(items.length / 2);
  await translateWithSplit(items.slice(0, mid), tmpDir, `${label}a`, onDone);
  await translateWithSplit(items.slice(mid), tmpDir, `${label}b`, onDone);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const messages = readJsonl('messages.jsonl');
  const interactions = readJsonl('interactions.jsonl');
  const cache = loadCache();

  // Every distinct non-English string in the corpus, across both files.
  const pending = new Map();
  const consider = (text) => {
    if (!text || detectLang(text) === 'en') return;
    const key = hash(text);
    if (cache[key] === undefined) pending.set(key, text);
  };
  for (const m of messages) consider(m.message);
  for (const i of interactions) {
    consider(i.attack_message);
    consider(i.bot_response);
  }

  const queue = [...pending.entries()].slice(0, LIMIT).map(([key, text]) => ({ key, text }));
  console.log(
    `${pending.size} untranslated strings (${Object.keys(cache).length} cached); ` +
      `translating ${queue.length} via ${MODEL}.`,
  );

  const tmpDir = fs.mkdtempSync(path.join(ROOT, 'data/.translate-'));
  let done = 0;
  let failed = 0;
  try {
    const batches = [];
    for (let start = 0; start < queue.length; start += BATCH) {
      batches.push(queue.slice(start, start + BATCH));
    }

    /**
     * Batches are independent, so several run at once. The cache is written on
     * the main thread after each completion, which keeps an interrupted run
     * resumable without risking a torn file.
     */
    let next = 0;
    const worker = async () => {
      while (next < batches.length) {
        const n = next++;
        await translateWithSplit(batches[n], tmpDir, String(n + 1), (item, translation) => {
          if (translation === null) {
            failed += 1;
          } else {
            cache[item.key] = translation;
            done += 1;
          }
        });
        saveCache(cache);
        console.log(
          `  batch ${n + 1}/${batches.length} — ${done} translated, ${failed} failed`,
        );
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker),
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  /**
   * The original is always kept verbatim. `*_en` is a companion column, and
   * `translated` records whether it came from a model or was already English —
   * machine translation is an artifact and should be labelled as one.
   */
  const render = (text) => {
    if (!text) return { en: text, lang: 'en', translated: false };
    const lang = detectLang(text);
    if (lang === 'en') return { en: text, lang, translated: false };
    const hit = cache[hash(text)];
    return hit === undefined
      ? { en: null, lang, translated: false }
      : { en: hit, lang, translated: true };
  };

  const outMessages = messages.map((m) => {
    const r = render(m.message);
    return { ...m, message_en: r.en, lang: r.lang, translated: r.translated };
  });

  const outInteractions = interactions.map((i) => {
    const a = render(i.attack_message);
    const b = render(i.bot_response);
    return {
      ...i,
      attack_message_en: a.en,
      bot_response_en: b.en,
      lang: a.lang,
      translated: a.translated || b.translated,
    };
  });

  const fields = [...FIELDS];
  fields.splice(fields.indexOf('message') + 1, 0, 'message_en', 'lang', 'translated');

  fs.writeFileSync(path.join(OUT, 'messages.csv'), toCsv(outMessages, fields));
  fs.writeFileSync(
    path.join(OUT, 'messages.jsonl'),
    outMessages.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(OUT, 'interactions.jsonl'),
    outInteractions.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );

  const untranslated = outMessages.filter((m) => m.lang !== 'en' && m.message_en === null).length;
  console.log(
    `Wrote ${outMessages.length} messages and ${outInteractions.length} interactions -> data/translated/` +
      (untranslated ? ` (${untranslated} still awaiting translation — rerun to continue)` : ''),
  );
}

main();
