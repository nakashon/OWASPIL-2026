import { createHash } from 'node:crypto';

/** Fields emitted for every parsed interaction, in output order. */
export const FIELDS = [
  'id',
  'source',
  'date',
  'time',
  'timestamp',
  'sender',
  'is_bot_response',
  'target_user',
  'message',
  'score_total',
  'creativity',
  'challenge',
  'humor',
  'cleverness',
  'engagement',
  'broke',
  'hacked',
  'leaderboard_position',
];

const MESSAGE_START =
  /^\u200e?\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\]\s(.+?):\s([\s\S]*)$/;

/** Lines WhatsApp injects that are not real participant messages. */
const SYSTEM_MARKERS = [
  'Messages and calls are end-to-end encrypted',
  'created this group',
  'joined using a group link',
  'added you',
  'changed the subject',
  'changed this group',
  'changed their phone number',
  'image omitted',
  'video omitted',
  'audio omitted',
  'sticker omitted',
  'document omitted',
  'This message was deleted',
];

function stripInvisible(value) {
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
}

function isSystemMessage(body) {
  const clean = stripInvisible(body).trim();
  return SYSTEM_MARKERS.some((marker) => clean.includes(marker));
}

function normalizeSender(raw) {
  return stripInvisible(raw).replace(/^~\s*/, '').trim();
}

/**
 * Splits a WhatsApp `_chat.txt` export into messages. Continuation lines belong
 * to the preceding message, so buffering is required rather than a per-line map.
 */
export function parseChatExport(text, { source }) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const body = current.bodyLines.join('\n').trim();
    if (body && !isSystemMessage(body)) {
      messages.push({ ...current, message: body, source });
    }
    current = null;
  };

  for (const line of lines) {
    const match = line.match(MESSAGE_START);
    if (match) {
      flush();
      const [, dd, mm, yyyy, hh, min, ss, sender, rest] = match;
      current = {
        date: `${dd}/${mm}/${yyyy}`,
        time: `${hh}:${min}:${ss}`,
        timestamp: `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`,
        sender: normalizeSender(sender),
        bodyLines: [rest],
      };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  flush();

  return messages.map((msg, index) => {
    const { bodyLines, ...rest } = msg;
    return { id: `${source}-${String(index + 1).padStart(6, '0')}`, ...rest };
  });
}

const NUM = '(-?\\d+)';
const SCORE_PATTERNS = {
  creativity: new RegExp(`Creativity:\\s*${NUM}`, 'i'),
  challenge: new RegExp(`Challenge:\\s*${NUM}`, 'i'),
  humor: new RegExp(`Humor:\\s*${NUM}`, 'i'),
  cleverness: new RegExp(`Cleverness:\\s*${NUM}`, 'i'),
  engagement: new RegExp(`Engagement:\\s*${NUM}`, 'i'),
  broke: new RegExp(`Broke:\\s*${NUM}`, 'i'),
  hacked: new RegExp(`Hacked:\\s*${NUM}`, 'i'),
  leaderboard_position: new RegExp(`Position:\\s*#${NUM}`, 'i'),
};

/** Header of a scorecard block: `📊 **SCORE: 35/70**` or `📊 **Aviad: 30/70**`. */
const SCORE_HEADER = /📊\s*\*{0,2}\s*([^*\n:]{0,40}?)\s*:?\s*(\d+)\s*\/\s*70/g;
const TARGET_ARROW = /→\s*\*{0,2}\s*([^*\n]{1,60})/;
const BOT_PREFIX = /^\s*🤖/;

function firstInt(pattern, text) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

/**
 * A single bot message can score several participants in one block, so every
 * scorecard is extracted and its dimensions read from the slice of text that
 * follows its header (up to the next header).
 */
export function extractScorecards(body, fallbackTarget) {
  const headers = [...body.matchAll(SCORE_HEADER)];
  if (headers.length === 0) return [];

  return headers.map((header, index) => {
    const start = header.index + header[0].length;
    const end = index + 1 < headers.length ? headers[index + 1].index : body.length;
    const block = body.slice(start, end);

    const label = header[1].trim();
    const named = label && !/^score$/i.test(label);

    const dims = {};
    for (const [key, pattern] of Object.entries(SCORE_PATTERNS)) {
      dims[key] = firstInt(pattern, block);
    }

    return {
      target_user: named ? label : (fallbackTarget ?? null),
      score_total: Number(header[2]),
      ...dims,
    };
  });
}

/**
 * The bot answers as its operator's WhatsApp account, so authorship is inferred
 * from the message shape (🤖 prefix / scorecard block) rather than the sender.
 */
export function enrich(message, { botSenders = [] } = {}) {
  const body = message.message;
  const arrow = body.match(TARGET_ARROW);
  const fallbackTarget = arrow ? arrow[1].trim() : null;
  const cards = extractScorecards(body, fallbackTarget);

  const isBot =
    BOT_PREFIX.test(body) ||
    cards.length > 0 ||
    SCORE_PATTERNS.creativity.test(body) ||
    botSenders.includes(message.sender);

  const primary = cards[0] ?? {};
  const blank = Object.fromEntries(Object.keys(SCORE_PATTERNS).map((k) => [k, null]));

  return {
    ...message,
    is_bot_response: isBot,
    target_user: isBot ? (primary.target_user ?? fallbackTarget) : null,
    score_total: primary.score_total ?? null,
    ...blank,
    ...(isBot ? cards[0] ?? {} : {}),
    scorecards: isBot ? cards : [],
  };
}

/** Loose name match — WhatsApp display names and bot labels rarely match exactly. */
function matchSender(lastHumanBySender, target) {
  if (!target) return null;
  const needle = target.toLowerCase();
  for (const [sender, row] of lastHumanBySender) {
    const hay = sender.toLowerCase();
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) return row;
  }
  return null;
}

/**
 * Links each scorecard back to the most recent human message from the scored
 * participant, producing one row per attempted attack.
 */
export function buildInteractions(rows) {
  const interactions = [];
  const lastHumanBySender = new Map();

  for (const row of rows) {
    if (!row.is_bot_response) {
      lastHumanBySender.set(row.sender, row);
      continue;
    }

    const cards = row.scorecards ?? [];
    cards.forEach((card, index) => {
      const candidate = matchSender(lastHumanBySender, card.target_user);
      interactions.push({
        id: cards.length > 1 ? `${row.id}-${index + 1}` : row.id,
        timestamp: row.timestamp,
        source: row.source,
        attacker: candidate?.sender ?? card.target_user ?? 'unknown',
        attack_message: candidate?.message ?? null,
        bot_response: row.message,
        score_total: card.score_total,
        creativity: card.creativity,
        challenge: card.challenge,
        humor: card.humor,
        cleverness: card.cleverness,
        engagement: card.engagement,
        broke: card.broke,
        hacked: card.hacked,
        leaderboard_position: card.leaderboard_position,
      });
    });
  }

  return interactions;
}

/**
 * Exports are point-in-time snapshots of the same groups, so the same message
 * appears in several archives. Identity is (timestamp, sender, message body).
 */
export function dedupe(messages) {
  const seen = new Set();
  const out = [];
  for (const msg of messages) {
    const key = `${msg.timestamp}|${msg.sender}|${msg.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(msg);
  }
  return out;
}

export function pseudonym(name, salt, prefix = 'participant') {
  const digest = createHash('sha256').update(`${salt}:${name}`).digest('hex');
  return `${prefix}_${digest.slice(0, 8)}`;
}

/**
 * Labels the agent uses to address the room rather than a person. These reach
 * the scorecard parser looking exactly like names, and because they are ordinary
 * Hebrew words, pseudonymizing them rewrites the word everywhere it appears in
 * normal prose.
 */
const COLLECTIVE_LABELS = new Set([
  'קבוצה',
  'הקבוצה',
  'כולם',
  'כולם בקבוצה',
  'group',
  'the group',
  'everyone',
  'all',
]);

/** Ordinary words seen emitted as scorecard targets. Not names, not collectives. */
const NON_NAME_WORDS = new Set(['עבד', 'חסימה', 'נפתחת', 'זה אבוד', 'video', 'pl']);

/**
 * Whether a scorecard label plausibly denotes a person.
 *
 * The agent's output is free text, so the target extractor also picks up score
 * fragments, shell snippets, table borders and whole sentences. Treating those
 * as names is not just untidy: any label added to the name map is substituted
 * throughout every message, so one bad label corrupts the corpus wherever that
 * string happens to occur. Anything not clearly a name is therefore left alone.
 */
export function classifyLabel(label) {
  const s = (label ?? '').trim().replace(/[\s\-–—:,.]+$/u, '');
  if (!s) return 'unknown';

  const lower = s.toLowerCase();
  if (COLLECTIVE_LABELS.has(lower) || COLLECTIVE_LABELS.has(s)) return 'collective';
  if (NON_NAME_WORDS.has(lower) || NON_NAME_WORDS.has(s)) return 'not-a-name';

  if (s.length > 24) return 'not-a-name';
  if (/[\d]/u.test(s)) return 'not-a-name';
  if (/[(){}[\]|│┃→←/\\"'`+*=<>@#]/u.test(s)) return 'not-a-name';
  if (/\p{Extended_Pictographic}/u.test(s)) return 'not-a-name';
  if (/[\n\r]/u.test(s)) return 'not-a-name';
  if (s.split(/\s+/u).length > 3) return 'not-a-name';

  return 'person';
}

const REDACTIONS = [
  [/\+?\d{1,3}[-\s]?\(?\d{1,4}\)?[-\s]?\d{3}[-\s]?\d{4}\b/g, '[PHONE]'],
  [/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, '[EMAIL]'],
  [/https?:\/\/\S+/g, '[URL]'],
  [/\b\d{9}\b/g, '[ID]'],
];

export function redact(text) {
  if (!text) return text;
  return REDACTIONS.reduce((acc, [pattern, token]) => acc.replace(pattern, token), text);
}

export function toCsv(rows, fields) {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [fields.join(',')];
  for (const row of rows) lines.push(fields.map((f) => escape(row[f])).join(','));
  return `${lines.join('\n')}\n`;
}

/**
 * Real names appear inside message bodies too, not just the sender column.
 * Replacement is boundary-aware: some display names are ordinary Hebrew words,
 * and a naive substring swap corrupts unrelated text. JavaScript's `\b` is
 * ASCII-only, so letter/digit lookarounds are used instead.
 *
 * Hebrew attaches single-letter prefixes (ב ו ה כ ל מ ש) directly to a name, as
 * in "לאלכס", so those are matched and preserved rather than blocking the hit.
 */
const HEBREW_PREFIXES = '\u05d1\u05d5\u05d4\u05db\u05dc\u05de\u05e9';

export function scrubNames(text, nameMap) {
  if (!text) return text;
  let out = text;
  for (const [real, alias] of nameMap) {
    if (real.length < 3) continue;
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}])([${HEBREW_PREFIXES}]{0,2})${escaped}(?![\\p{L}\\p{N}])`,
        'gu',
      ),
      `$1${alias}`,
    );
  }
  return out;
}
