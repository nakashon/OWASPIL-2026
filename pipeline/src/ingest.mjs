#!/usr/bin/env node
/**
 * Stage 1 — ingest.
 * Reads WhatsApp `_chat.txt` exports (or their `.zip` archives) from data/raw/,
 * de-duplicates overlapping snapshots of the same group, and writes normalized
 * messages + derived interactions to data/interim/.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FIELDS, parseChatExport, enrich, buildInteractions, dedupe, toCsv } from './lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const RAW = path.join(ROOT, 'data/raw');
const INTERIM = path.join(ROOT, 'data/interim');

/**
 * Exports of the same group are re-downloaded over time, so trailing date
 * markers are stripped to collapse snapshots onto one logical group name.
 */
function groupName(filename) {
  return path
    .basename(filename)
    .replace(/\.(zip|txt)$/i, '')
    .replace(/WhatsApp Chat -\s*/i, '')
    .replace(/[-\s_]*\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i, '')
    .replace(/[-\s_]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}$/i, '')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function findExports(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findExports(full));
    else if (/\.(zip|txt)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function readExport(full) {
  if (full.toLowerCase().endsWith('.txt')) return fs.readFileSync(full, 'utf8');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owaspil-'));
  try {
    execFileSync('unzip', ['-o', '-q', full, '-d', tmp]);
    const chat = fs.readdirSync(tmp).find((f) => f.endsWith('.txt'));
    if (!chat) throw new Error(`No .txt chat file inside ${path.basename(full)}`);
    return fs.readFileSync(path.join(tmp, chat), 'utf8');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  fs.mkdirSync(INTERIM, { recursive: true });

  if (!fs.existsSync(RAW) || findExports(RAW).length === 0) {
    console.error(
      'No exports found in data/raw/.\n' +
        'Drop your WhatsApp "Export chat (without media)" .zip or _chat.txt files there and re-run.\n' +
        'Multiple snapshots of the same group are fine — duplicates are removed automatically.',
    );
    process.exit(1);
  }

  const byGroup = new Map();
  for (const file of findExports(RAW)) {
    const group = groupName(file);
    const parsed = parseChatExport(readExport(file), { source: group });
    byGroup.set(group, (byGroup.get(group) ?? []).concat(parsed));
    console.log(`  ${path.relative(RAW, file)} -> ${parsed.length} raw messages [${group}]`);
  }

  const allMessages = [];
  const allInteractions = [];

  for (const [group, raw] of byGroup) {
    const unique = dedupe(raw).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const rows = unique.map((m, index) => ({
      ...enrich(m),
      id: `${group}-${String(index + 1).padStart(6, '0')}`,
    }));
    const interactions = buildInteractions(rows);
    allMessages.push(...rows);
    allInteractions.push(...interactions);
    console.log(
      `\n[${group}] ${raw.length} raw -> ${unique.length} unique messages, ` +
        `${interactions.length} scored interactions`,
    );
  }

  allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  allInteractions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const slim = allMessages.map(({ scorecards, ...rest }) => rest);
  fs.writeFileSync(path.join(INTERIM, 'messages.csv'), toCsv(slim, FIELDS));
  fs.writeFileSync(
    path.join(INTERIM, 'messages.jsonl'),
    slim.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(INTERIM, 'interactions.jsonl'),
    allInteractions.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );

  console.log(
    `\nTotal: ${allMessages.length} messages / ${allInteractions.length} interactions -> data/interim/`,
  );
}

main();
