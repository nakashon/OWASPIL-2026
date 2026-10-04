import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBlockedPaths, hasPrivatePhone, publicationBlocker } from '../src/release-check.mjs';

test('release policy blocks unpublished stages and translation scratch outside data', () => {
  for (const file of [
    'data/raw/export/_chat.txt', 'data/interim/messages.jsonl',
    'data/anonymized/messages.csv', 'data/translated/messages.jsonl',
    'data/translation-cache.json', 'data/.translate-run/input.json',
    'pipeline/.batch43_items.txt', 'pipeline/batch42_input.jsonl',
    'pipeline/batch42_translations.py', 'pipeline/translation_items/000.txt',
    'pipeline/translation_input_lines.txt', 'pipeline/translate_out_3.json',
    'pipeline/.venv-translate/bin/python',
  ]) assert.ok(publicationBlocker(file), file);
});

test('release policy permits published source, synthetic tests, aggregates and artwork', () => {
  for (const file of [
    'README.md', 'START_HERE.md', 'defense/regression-scenarios.md',
    'pipeline/package.json', 'pipeline/src/stats.mjs', 'pipeline/test/pipeline.test.mjs',
    'data/README.md', 'data/derived/stats.md', 'data/derived/stats.json',
    'talk/assets/sched-cover.svg', 'talk/assets/sched-cover.png',
  ]) assert.equal(publicationBlocker(file), null, file);
});

test('release policy blocks export and secret filenames without banning salt-related source names', () => {
  for (const file of [
    'exports/corpus.ZIP', 'nested/_chat.txt', '.env', '.env.local',
    'config/.env.production', 'config/ANON_SALT.txt', 'secret.salt',
  ]) assert.ok(publicationBlocker(file), file);
  assert.equal(publicationBlocker('pipeline/test/salt.test.mjs'), null);
});

test('blocked path reporting deduplicates paths and contains reasons, not contents', () => {
  assert.deepEqual(findBlockedPaths(['', 'README.md', 'data/raw/x.txt', 'data/raw/x.txt']), [
    { file: 'data/raw/x.txt', reason: 'Dataset stage or artifact not approved for publication' },
  ]);
});

test('phone detection returns a boolean without copying values into output', () => {
  const synthetic = '+' + '9725' + '00000000';
  assert.equal(hasPrivatePhone(`contact ${synthetic}`), true);
  assert.equal(hasPrivatePhone('[PHONE] or +972XXXXXXXXX'), false);
});
