# Methodology

## Study and attribution

Alex Liverant built and operated AlexBot, connected it to a WhatsApp community
challenge, and published builder-side incident reports. Asaf Nakash participated
and independently analyzed the available conversations. Both accounts concern
the same experiment; they are not independent replications.

This is an observational field study of a changing agent deployment. The
available text supports studying sequences, speaker changes, stated reasoning
and self-reported actions. It does not provide complete tool telemetry or a
controlled comparison of defenses.

See [generated statistics](../data/derived/stats.md) for the observation window,
message counts, scorecard counts and longitudinal aggregates. Figures are
generated, not maintained manually in prose.

## Data processing

The pipeline separates private input from publishable output:

```text
private exports → ingest → private parsed data → anonymize → private pseudonymized data
                                                               ↓
                                                        aggregate statistics
```

Ingestion buffers multiline messages and deduplicates overlapping snapshots
on timestamp, sender and body. Group names are normalized across snapshots.
The bot and operator may use the same account, so bot authorship is inferred
from message shape rather than authenticated by a unique sender identifier.

Scorecards are linked heuristically to the recent message from their named
participant. A bot message can contain several scorecards. A scored interaction
is therefore not necessarily one independently identified attack or attacker.
Collective address and unresolvable targets need separate treatment; see the
parser tests and generated results.

Anonymization uses a private salt for pseudonyms and applies redaction.
Pseudonymization is not a guarantee against re-identification, so the full
anonymized and translated datasets remain private. Translation, when authorized,
reads only anonymized text and adds companion fields rather than replacing the
original. Automated redaction and translation can miss identifying context;
neither justifies publishing the complete conversations.

The public statistics generator reads only the anonymized stage. It emits
aggregate results, excluding participant-level identifiers and leaderboards.
Legacy JSON keys containing `hacked` refer to the bot's scoring dimension,
not confirmed compromises.

## Selecting and presenting cases

The talk uses three qualitatively informative sequences, not a random sample
or a ranked estimate of the most effective attacks. Dates, times and selected
Hebrew excerpts were checked locally against the available pseudonymized records.
Neutral participant labels are consistent within a case and reset between cases.

English text is a selected translation. Joined omissions and removed identifying
details are marked. Editorial diagrams and explanations are distinguished from
quotes. Full selected excerpts, record references and caveats are in the
[source notes](../talk/slides/recognition-resistance-2026-source-notes.md).
The full private conversations are not included.

The [case studies](attack-patterns.md) and [evidence map](../defense/evidence-map.md)
separate visible replies, participant/operator reports, proposed controls and
unexecuted synthetic tests. A statement that a tool ran is not itself a tool
receipt. Public incident reports are pinned to the reviewed revision.

## Limits

- The target assigned its own outcome scores. These are not an independent
  breach benchmark.
- Participant security expertise was not systematically established. Do not
  describe all participants as untrained or all senders as attackers.
- The deployment, attack mix, participation, volume and scoring could change.
  A returning-participant cohort holds membership fixed, not all other factors.
  It does not isolate a mitigation's causal effect.
- Group participation does not prove coordinated planning. Bot suggestions
  can become another participant's next request without such coordination.
- Text visible in a group does not cover all direct messages, abandoned
  attempts, tool calls or device state.
- The selected cases do not establish a controlled effectiveness ranking
  between multi-turn and single-turn attacks.
- Proposed controls and synthetic scenarios are hypotheses to test in a
  specified deployment, not verified cross-platform fixes.

## Reproduction

Anyone can run the source tests and rebuild the talk from public aggregates.
Recomputing the original aggregates requires authorized private input, which
this repository does not supply. Use synthetic fixtures for contributions.

```bash
npm --prefix pipeline test
npm --prefix pipeline run check:release -- --history
```

See [data boundaries](../data/README.md) and the [presentation build](../talk/README.md#rebuild).
The public history intentionally excludes the earlier private repository history.
