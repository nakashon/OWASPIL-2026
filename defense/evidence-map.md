# Evidence, lessons, and attribution

Alex Liverant built and operated the AlexBot experiment and published the
builder-side analysis at [alextwin.ai](https://www.alextwin.ai/) and
[alexliv1234/alexbot-public](https://github.com/alexliv1234/alexbot-public).
Asaf Nakash's independent field analysis is in [research/](../research/).
The protocol and synthetic scenarios here translate lessons into checks for
other deployments; they are not claims to have discovered each attack class.

## Evidence levels

| Label | What it establishes |
|---|---|
| Reported incident | A source describes an event. This alone does not verify tool effects or remediation. |
| Transcript observation | The available exchange shows particular text. Claims of execution still need action evidence. |
| Demonstrated effect | An authorized observer has a tool receipt, state change, or other independently inspectable outcome. State the environment. |
| Synthetic scenario | An original test design inspired by a mechanism. Not evidence that a model or deployment failed. |
| Executed regression | A scenario was run with recorded configuration, expected/actual effects, and legitimate-use controls. Bounded to those runs. |

Do not promote evidence from one level to another without the supporting
artifact. An agent grading its own attack outcome is not an independent judge.
The repository's current scenarios are **synthetic designs**, not a published
cross-platform benchmark or completed set of deployment tests.

## From public reports to checks

Sources below were reviewed on 2026-09-19. GitHub links pin the reviewed public
repository revision, rather than assuming a live page will remain unchanged.
Summaries are paraphrases; the linked material retains its own ownership and
licensing. These accounts motivate hypotheses, not certified fixes.

| Public source | Reported mechanism | Checks to adapt |
|---|---|---|
| [Critical breaches: BREACH-009](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/critical-breaches.md#L19) | Display-name impersonation and reversal of a refusal preceded remote-access operations | C01/S01: caller and approval binding; C02/S02: independent tool authorization |
| [Critical breaches: BREACH-007](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/critical-breaches.md#L112) | Helpful diagnostics progressed to unauthorized local-network/device operations | C02/S02: resource-scoped authorization on each effect |
| [Attack encyclopedia](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/attack-encyclopedia.md) | Feedback and autonomy framing were used to seek governing-file modifications | C03/S03: separate runtime and administrative policy-write authority |
| [Critical breaches: BREACH-001](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/critical-breaches.md#L296) | Claimed shared history and trusted-looking formatting preceded archive delivery | C04/S04: provenance; C05/S05: data and recipient checks |
| [Critical breaches: BREACH-003](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/critical-breaches.md#L473) | An alternate agent offered a route around protections on the main agent | C07/S07: preserve scope across delegation |
| [Enforcement patterns](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/learning-guides/enforcement-patterns.md) | Documented rules did not necessarily run before actions | All controls: identify executable enforcement, not just policy text |
| [Defense gaps](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/defense-gaps.md) | Cross-session correlation and aggregate load were identified as gaps | C04/S04 and C08/S08: persistent provenance and bounded work |

C06/S06 extends the trust-boundary lesson to retrieved content. It is a
generalization, not a claim that these public incidents tested every retrieval
surface. Likewise, the scenarios' approval replay, redirect, and fault-injection
variants are proposed regression coverage, not additional AlexBot observations.

## What we must not infer

- A page marked "fixed" does not prove the fix was deployed, remained effective,
  or covered every execution path. The public
  [testing-scenarios page](https://github.com/alexliv1234/alexbot-public/blob/642684e16b223821d2496614cd94deb74abf987c/docs/security-kb/testing-scenarios.md)
  lists scenarios as untested.
- Styled chat replays are not automatically verbatim transcripts. The
  [April documentation commit](https://github.com/alexliv1234/alexbot-public/commit/208ad27b8f826dd511123993047e410d39bbc4e4)
  describes chat mocks. Verify provenance before quoting an exchange as evidence.
- Public guides contain historical inconsistencies, including dates and scoring
  descriptions. Prefer a specific sourced event over a page's headline count.
- Public accounts and this repository study the same experiment; agreement
  between them is not an independent replication.
- A bot's statement that it changed a file, disclosed a secret, or blocked an
  attack requires corroboration before being treated as an observed tool effect.
- A recorded demo establishes only what was actually observable in that demo.
  Record a timestamp and the visible evidence; do not infer a deployment-wide
  result from an edited presentation or a spoken claim.

## Research context

Use [data/derived/stats.md](../data/derived/stats.md) for this repository's
computed figures and [methodology](../research/methodology.md) for limitations.
Counts of participants, scored interactions, technique families, and confirmed
incidents have different denominators and must not be compared as equivalent.
The cohort analysis reduces one population confound; it does not eliminate
changes in attack mix, effort, models, or scoring.

Multi-turn manipulation is not a newly discovered category here.
[Crescendo](https://arxiv.org/abs/2404.01833) is prior research on gradual
multi-turn jailbreaks. The
[OWASP Agentic Top 10](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/)
already includes goal hijacking, tool misuse, identity/privilege abuse, memory
poisoning, and insecure inter-agent communication. The community value here
is operationalizing these concerns in a target's actual controls.

## Reuse and contribution boundary

Our synthetic scenarios contain no copied private conversations and require no
research dataset. Link and attribute third-party reports; do not redistribute
their transcripts, screenshots, or recordings without a suitable licence or
permission. Public visibility alone does not grant redistribution rights.

To strengthen a check, contribute a synthetic reproduction with authorized
execution evidence and a legitimate-use control. Distinguish operator reports,
your interpretation, and results you actually measured. Never submit real
credentials, raw chat exports, or identifiable participant excerpts.
