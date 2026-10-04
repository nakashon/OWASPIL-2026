#!/usr/bin/env node
/**
 * Stage 2 — anonymize.
 * Pseudonymizes participants and redacts phone numbers, emails, URLs and ID
 * numbers for private analysis. This does not make the free text safe to publish.
 * The salt is read from ANON_SALT and must never be committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FIELDS, classifyLabel, pseudonym, redact, scrubNames, toCsv } from './lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const INTERIM = path.join(ROOT, 'data/interim');
const OUT = path.join(ROOT, 'data/anonymized');

const SALT = process.env.ANON_SALT;
if (!SALT) {
  console.error(
    'ANON_SALT is required.\n' +
      'Generate one and keep it out of the repo:\n' +
      "  export ANON_SALT=$(node -e \"console.log(require('crypto').randomBytes(16).toString('hex'))\")",
  );
  process.exit(1);
}

function readJsonl(file) {
  const full = path.join(INTERIM, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${full}. Run \`npm run ingest\` first.`);
    process.exit(1);
  }
  return fs
    .readFileSync(full, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** Loose match between a bot-supplied label and a real WhatsApp display name. */
function resolveName(label, senders) {
  if (!label) return null;
  const needle = label.trim().toLowerCase();
  if (!needle) return null;
  return (
    senders.find((s) => s.toLowerCase() === needle) ??
    senders.find((s) => {
      const hay = s.toLowerCase();
      return hay.includes(needle) || needle.includes(hay);
    }) ??
    null
  );
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const messages = readJsonl('messages.jsonl');
  const interactions = readJsonl('interactions.jsonl');

  const humans = [...new Set(messages.filter((m) => !m.is_bot_response).map((m) => m.sender))];
  const bots = [...new Set(messages.filter((m) => m.is_bot_response).map((m) => m.sender))];

  const nameMap = new Map();
  for (const name of humans) nameMap.set(name, pseudonym(name, SALT, 'participant'));
  for (const name of bots) if (!nameMap.has(name)) nameMap.set(name, 'agent');

  /**
   * The agent refers to people by short nicknames that never appear as senders,
   * so those labels are resolved to a real participant where possible and
   * otherwise pseudonymized in their own right — never passed through untouched.
   *
   * Labels that are not people are handled separately: the agent addresses the
   * whole room, and the target extractor also yields sentences and fragments.
   * Those must not become pseudonyms, because every pseudonymized label is then
   * substituted throughout the corpus.
   */
  const aliasFor = (label) => {
    if (!label) return null;
    if (nameMap.has(label)) return nameMap.get(label);
    if (label === 'unknown') return 'unattributed';

    const resolved = resolveName(label, humans);
    if (resolved) return nameMap.get(resolved);

    const kind = classifyLabel(label);
    if (kind === 'collective') return 'group';
    if (kind !== 'person') return 'unattributed';
    return pseudonym(label, SALT, 'participant');
  };

  /**
   * Only confirmed people are rewritten inside message bodies. A label that
   * resolves to nobody and does not look like a name is left in the text as
   * written — replacing it would silently corrupt ordinary prose.
   */
  const scrubMap = new Map(nameMap);
  const labels = new Set();
  for (const m of messages) if (m.target_user) labels.add(m.target_user);
  for (const i of interactions) if (i.attacker) labels.add(i.attacker);
  for (const label of labels) {
    if (scrubMap.has(label) || label === 'unknown') continue;
    const alias = aliasFor(label);
    const isPerson = resolveName(label, humans) || classifyLabel(label) === 'person';
    if (isPerson && alias) scrubMap.set(label, alias);
  }

  // Longest-first so "Alex Liverant" is replaced before a bare "Alex".
  const ordered = [...scrubMap.entries()].sort((a, b) => b[0].length - a[0].length);
  const clean = (text) => redact(scrubNames(text, ordered));

  const safeMessages = messages.map((m) => ({
    ...m,
    sender: nameMap.get(m.sender) ?? 'unknown',
    target_user: aliasFor(m.target_user),
    message: clean(m.message),
  }));

  const safeInteractions = interactions.map((i) => ({
    ...i,
    attacker: aliasFor(i.attacker) ?? 'unattributed',
    attack_message: clean(i.attack_message),
    bot_response: clean(i.bot_response),
  }));

  fs.writeFileSync(path.join(OUT, 'messages.csv'), toCsv(safeMessages, FIELDS));
  fs.writeFileSync(
    path.join(OUT, 'messages.jsonl'),
    safeMessages.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  fs.writeFileSync(
    path.join(OUT, 'interactions.jsonl'),
    safeInteractions.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );

  console.log(
    `Anonymized ${safeMessages.length} messages across ${humans.length} participants -> data/anonymized/`,
  );
}

main();
