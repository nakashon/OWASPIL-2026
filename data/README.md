# Data and publication boundaries

Only `derived/stats.md` and `derived/stats.json` are published data artifacts.
They are generated aggregates. Participant-level identifiers, leaderboards,
message datasets, translations and caches are excluded.

| Stage | Contents | Publication |
|---|---|---|
| `raw/` | Original exports | Private; never commit |
| `interim/` | Parsed messages with identifying information | Private; never commit |
| `anonymized/` | Pseudonymized and redacted messages | Private; do not commit |
| `translated/` | Original and translated message text | Private; do not commit |
| Translation caches and scratch files | Message text and intermediate results | Private; do not commit, including outside `data/` |
| `derived/stats.{md,json}` | Aggregate counts and target-assigned labels | Published |

The selected, de-identified excerpts in the talk are not a release of the full
dataset. Pseudonymization does not eliminate re-identification risk, particularly
for people familiar with a conversation.

## Recomputing aggregates

The public repository does not include the research inputs. With separately
authorized private input, ingestion precedes anonymization, and statistics
read only the anonymized stage. The salt is supplied through `ANON_SALT`,
never through a committed file. Keep it stable if identifiers must remain
comparable across private runs.

Translation is optional, runs after anonymization, and adds companion fields
without overwriting original messages. Do not point it at intermediate data.
Redaction and translation are fallible; review what is sent to any model
under the applicable authorization and privacy requirements.

Do not hand-edit the published figures. Change the generator and rerun
`npm --prefix pipeline run stats`. If substantive results change, document the
change in the [research correction note](../research/attack-patterns.md#correction-and-public-release).

## Interpretation

`Hacked` and `Broke` are scores assigned by the target agent. A non-zero label
is not an independently verified compromise. Participant and bot attribution
are heuristic. Counts and rates have different denominators; consult the
[methodology](../research/methodology.md).

The public output excludes individual pseudonym rows. The cohort comparison
is observational and does not isolate the effectiveness of a defense.

## Contributing safely

Use synthetic messages, accounts, resources and outcomes. Do not submit raw
exports, real credentials, private messages, salts, or copied translation
artifacts. The release check examines paths and limited text patterns; it is
not a privacy certification.
