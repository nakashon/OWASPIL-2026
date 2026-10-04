#!/usr/bin/env node
/**
 * Stage 3 — stats.
 * Recomputes every headline number quoted in the talk directly from the parsed
 * dataset, so no figure in the slides is hand-maintained.
 *
 * Reads data/anonymized/ only. Never publish aggregates with raw sender labels.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'data/derived');

function load() {
  for (const dir of ['data/anonymized']) {
    const file = path.join(ROOT, dir, 'interactions.jsonl');
    const messagesFile = path.join(ROOT, dir, 'messages.jsonl');
    if (fs.existsSync(file)) {
      const readJsonl = (f) =>
        fs.existsSync(f)
          ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
          : [];
      return {
        stage: dir,
        interactions: readJsonl(file),
        messages: readJsonl(messagesFile) || [],
      };
    }
  }
  console.error('No anonymized dataset found. Run `npm run anonymize` first; stats never reads data/interim/.');
  process.exit(1);
}

const pct = (n, d) => (d ? Number(((n / d) * 100).toFixed(1)) : 0);

function main() {
  const { stage, interactions, messages } = load();
  fs.mkdirSync(OUT, { recursive: true });

  const botResponses = messages.filter((m) => m.is_bot_response);
  const humanMessages = messages.filter((m) => !m.is_bot_response);
  const participants = new Set(humanMessages.map((m) => m.sender));
  const days = [...new Set(messages.map((m) => m.timestamp.slice(0, 10)))].sort();

  const scored = interactions.filter((i) => i.score_total !== null);
  const hacked = interactions.filter((i) => (i.hacked ?? 0) > 0);
  const broke = interactions.filter((i) => (i.broke ?? 0) > 0);

  const dimensions = ['creativity', 'challenge', 'humor', 'cleverness', 'engagement'];
  const averages = Object.fromEntries(
    dimensions.map((d) => {
      const values = interactions.map((i) => i[d]).filter((v) => typeof v === 'number');
      const mean = values.length
        ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
        : null;
      return [d, mean];
    }),
  );

  const perDay = days.map((day) => {
    const dayInteractions = interactions.filter((i) => i.timestamp.startsWith(day));
    const dayHacked = dayInteractions.filter((i) => (i.hacked ?? 0) > 0).length;
    return {
      day,
      interactions: dayInteractions.length,
      hacked: dayHacked,
      hacked_rate_pct: pct(dayHacked, dayInteractions.length),
    };
  });

  const perMonth = [...new Set(interactions.map((i) => i.timestamp.slice(0, 7)))]
    .sort()
    .map((month) => {
      const rows = interactions.filter((i) => i.timestamp.startsWith(month));
      const hackedRows = rows.filter((i) => (i.hacked ?? 0) > 0).length;
      return {
        month,
        interactions: rows.length,
        hacked: hackedRows,
        hacked_rate_pct: pct(hackedRows, rows.length),
        active_attackers: new Set(rows.map((i) => i.attacker)).size,
      };
    });

  /**
   * Holding cohort membership fixed addresses one population confound, not
   * differences in attempt volume, attack mix, scoring, or deployed controls.
   */
  const SPLIT = process.env.COHORT_SPLIT ?? '2026-04-01';
  const cohortAgg = (predicate) => {
    const map = new Map();
    for (const i of interactions) {
      if (i.attacker === 'unattributed' || !predicate(i)) continue;
      const entry = map.get(i.attacker) ?? { attempts: 0, hacked: 0 };
      entry.attempts += 1;
      entry.hacked += (i.hacked ?? 0) > 0 ? 1 : 0;
      map.set(i.attacker, entry);
    }
    return map;
  };

  const early = cohortAgg((i) => i.timestamp < SPLIT);
  const late = cohortAgg((i) => i.timestamp >= SPLIT);
  const MIN_ATTEMPTS = 5;
  const returning = [...early.keys()].filter(
    (a) => late.has(a) && early.get(a).attempts >= MIN_ATTEMPTS && late.get(a).attempts >= MIN_ATTEMPTS,
  );

  const sum = (map, key) => returning.reduce((acc, a) => acc + map.get(a)[key], 0);
  const perAttacker = returning.map((a) => ({
    early_rate_pct: pct(early.get(a).hacked, early.get(a).attempts),
    late_rate_pct: pct(late.get(a).hacked, late.get(a).attempts),
  }));
  const cohort = {
    split_date: SPLIT,
    min_attempts_per_period: MIN_ATTEMPTS,
    returning_attackers: returning.length,
    early: { attempts: sum(early, 'attempts'), hacked: sum(early, 'hacked') },
    late: { attempts: sum(late, 'attempts'), hacked: sum(late, 'hacked') },
  };
  cohort.early.rate_pct = pct(cohort.early.hacked, cohort.early.attempts);
  cohort.late.rate_pct = pct(cohort.late.hacked, cohort.late.attempts);
  cohort.declined = perAttacker.filter((a) => a.late_rate_pct < a.early_rate_pct).length;

  const stats = {
    generated_at: new Date().toISOString(),
    source_stage: stage,
    window: {
      first_day: days[0] ?? null,
      last_day: days.at(-1) ?? null,
      // Distinct days carrying at least one message, not the calendar span.
      // The group went quiet for stretches, so these differ substantially.
      active_days: days.length,
      span_days:
        days.length > 1
          ? Math.round((Date.parse(days.at(-1)) - Date.parse(days[0])) / 86400000) + 1
          : days.length,
    },
    totals: {
      messages: messages.length,
      bot_responses: botResponses.length,
      human_messages: humanMessages.length,
      participants: participants.size,
      scored_interactions: interactions.length,
    },
    outcomes: {
      scored: scored.length,
      hacked: hacked.length,
      hacked_rate_pct: pct(hacked.length, interactions.length),
      broke: broke.length,
      broke_rate_pct: pct(broke.length, interactions.length),
    },
    score_averages: averages,
    per_day: perDay,
    per_month: perMonth,
    returning_attacker_cohort: cohort,
  };

  fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');

  const md = `# Dataset Statistics

> Auto-generated by \`npm run stats\` on ${stats.generated_at}.
> Source stage: \`${stats.source_stage}\`. **Do not edit by hand.**
> Hacked and Broke are labels assigned by the target agent, not independently
> confirmed compromises. Participant-level identifiers and leaderboards are
> excluded from these public aggregates.

## Corpus

| Metric | Value |
|---|---|
| Observation window | ${stats.window.first_day} → ${stats.window.last_day} (${stats.window.span_days} day span, ${stats.window.active_days} active days) |
| Total messages | ${stats.totals.messages.toLocaleString()} |
| Bot responses | ${stats.totals.bot_responses.toLocaleString()} |
| Human messages | ${stats.totals.human_messages.toLocaleString()} |
| Participants | ${stats.totals.participants} |
| Scored interactions | ${stats.totals.scored_interactions.toLocaleString()} |

## Agent-assigned outcome labels

| Metric | Value |
|---|---|
| Interactions with Hacked > 0 | ${stats.outcomes.hacked} (${stats.outcomes.hacked_rate_pct}%) |
| Interactions with Broke > 0 | ${stats.outcomes.broke} (${stats.outcomes.broke_rate_pct}%) |

## Average scores

| Dimension | Mean |
|---|---|
${dimensions.map((d) => `| ${d} | ${averages[d] ?? 'n/a'} |`).join('\n')}

## Agent-assigned labels by month

Monthly differences do not isolate the effect of a defense. The population,
attempt volume, attack mix, deployment and scoring may all change.

| Month | Scored interactions | Hacked > 0 | Label rate | Distinct target labels |
|---|---|---|---|---|
${perMonth.map((m) => `| ${m.month} | ${m.interactions} | ${m.hacked} | ${m.hacked_rate_pct}% | ${m.active_attackers} |`).join('\n')}

## Returning-participant comparison

Restricting to participant labels present in **both** periods (at least
${cohort.min_attempts_per_period} scored interactions each side of ${cohort.split_date})
holds cohort membership fixed, but does not equalize attempt volume or establish
a causal effect of hardening.

| Cohort | Scored interactions | Hacked > 0 | Label rate |
|---|---|---|---|
| Before ${cohort.split_date} | ${cohort.early.attempts} | ${cohort.early.hacked} | **${cohort.early.rate_pct}%** |
| After ${cohort.split_date} | ${cohort.late.attempts} | ${cohort.late.hacked} | **${cohort.late.rate_pct}%** |

${cohort.declined} of ${cohort.returning_attackers} returning participant labels
had a lower non-zero Hacked-label rate in the later period. This is an
observational comparison, not an independently adjudicated success rate.

## Daily agent-assigned labels

| Day | Scored interactions | Hacked > 0 | Label rate |
|---|---|---|---|
${perDay.map((d) => `| ${d.day} | ${d.interactions} | ${d.hacked} | ${d.hacked_rate_pct}% |`).join('\n')}
`;

  fs.writeFileSync(path.join(OUT, 'stats.md'), md);
  console.log(`Wrote data/derived/stats.json and stats.md (source: ${stage})`);
  console.log(
    `  ${stats.totals.messages} messages | ${stats.totals.participants} participants | ` +
      `${stats.outcomes.hacked}/${stats.totals.scored_interactions} non-zero Hacked labels (${stats.outcomes.hacked_rate_pct}%)`,
  );
}

main();
