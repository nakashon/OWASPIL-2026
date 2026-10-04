import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owaspil-stats-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'pipeline/src'), { recursive: true });
  fs.copyFileSync(new URL('../src/stats.mjs', import.meta.url), path.join(root, 'pipeline/src/stats.mjs'));
  return root;
}

test('stats refuses an interim-only dataset rather than publishing raw labels', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'data/interim'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/interim/interactions.jsonl'), '{}\n');
  const run = spawnSync(process.execPath, [path.join(root, 'pipeline/src/stats.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No anonymized dataset/);
  assert.equal(fs.existsSync(path.join(root, 'data/derived/stats.json')), false);
});

test('stats still generates aggregates from anonymized synthetic input', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'data/anonymized'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/anonymized/messages.jsonl'), JSON.stringify({
    sender: 'participant_test', timestamp: '2026-02-11T10:00:00', is_bot_response: false,
  }) + '\n');
  fs.writeFileSync(path.join(root, 'data/anonymized/interactions.jsonl'), JSON.stringify({
    attacker: 'participant_test', timestamp: '2026-02-11T10:00:00', score_total: 10, hacked: 0, broke: 0,
  }) + '\n');
  const run = spawnSync(process.execPath, [path.join(root, 'pipeline/src/stats.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(fs.readFileSync(path.join(root, 'data/derived/stats.json'), 'utf8'));
  assert.equal(result.source_stage, 'data/anonymized');
  assert.equal(result.totals.messages, 1);
  assert.equal(result.totals.scored_interactions, 1);
  assert.equal(result.outcomes.hacked, 0);
  const markdown = fs.readFileSync(path.join(root, 'data/derived/stats.md'), 'utf8');
  assert.equal('top_attackers' in result, false);
  assert.equal('per_attacker' in result.returning_attacker_cohort, false);
  assert.equal(JSON.stringify(result).includes('participant_test'), false);
  assert.equal(markdown.includes('participant_test'), false);
  assert.match(markdown, /not independently/);
  assert.doesNotMatch(markdown, /against a harder target|Compromised|Top attackers/);
});
