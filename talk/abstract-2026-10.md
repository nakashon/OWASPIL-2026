# Recognition ≠ Resistance

**Registered title:** Recognition ≠ Resistance: The Agent Knew It Was Being
Attacked. It Complied Anyway

**Speaker:** Asaf Nakash

**Event:** OWASP AppSec Israel, 6 October 2026

**Session:** 11:30 start, Keynote Hall; 35 minutes including Q&A, then a 10-minute buffer
**Level:** Intermediate

[Official session](https://appsecdayisrael2026.sched.com/event/2WQYH/recognition-resistance-the-agent-knew-it-was-being-attacked-it-complied-anyway).
The public description below was checked against Sched on 28 September 2026.
The [current presentation](README.md) follows the attack-led revision below.
Earlier private submissions and drafts are not included in the public snapshot.

## Public description

An AI agent can explain its security rules. That does not mean it will enforce them.

Alex Liverant built AlexBot, connected it to real tools and persistent memory,
and invited a WhatsApp community to try to break it. Participants tested
everything from familiar jailbreak prompts to patient social engineering,
fabricated shared history, and owner impersonation. Alex documented the failures
and evolved the defenses in public.

I joined as a participant, then analyzed six months of interactions. This talk
combines that independent analysis with Alex’s published incident reports to
examine what changed as the agent hardened—and why recognizing suspicious
language is not the same as enforcing identity, permissions, and data boundaries.

We’ll follow concrete attack sequences, distinguish the bot’s claims from
observable outcomes, and examine the limits of using the target’s own scores to
measure security. The focus is not another list of clever prompts, but the
engineering question behind them: where must a boundary be enforced so that
conversation cannot negotiate it away?

You’ll leave with an open-source, agent-readable hardening workflow you can point
your own agent at: inspect the deployment, identify evidence-backed gaps, propose
changes for approval, and adapt synthetic regression scenarios that check both
unauthorized actions and legitimate work.

Alex’s experiment. Independent field analysis. Practical lessons for anyone
building agents with tools, memory, or access to private data.

## Presentation shape

The organizer's email supplied on 3 October clarifies that sessions are
35 minutes including any Q&A. The following 10 minutes are a room-change/setup
buffer, not speaking time, despite the 45-minute block on Sched. Target
30 minutes of content and 5 minutes of questions.

The [current deck](README.md) restores the March deck's narrative spine while
correcting its claims. It begins with an explicit risk-aware remote-access
refusal, follows with assessment retraction, and contrasts those with a useful
task growing into television control. One-message reveals precede explanation;
Hebrew originals and fuller evidence live in the notes. A short Context Window
introduction connects the speaker to the research. The
[case studies](../research/attack-patterns.md) explain the evidence and
limitations. These are rehearsal allocations, not measured timings.
The public description above remains a record of the checked Sched text,
not a newly published update.

| Elapsed | Segment |
|---|---|
| 00:00–03:00 | Experiment setup, Context Window, and a familiar refusal |
| 03:00–12:00 | Remote-access refusal, ownership assumption, and approvals |
| 12:00–16:00 | Talk the bot out of its security assessment |
| 16:00–23:00 | The group and the bot extend a helpful task |
| 23:00–24:00 | Recognition versus resistance: what the cases establish |
| 24:00–27:00 | One lesson from each case: caller identity, the reason for a reversal, and permission for each new action |
| 27:00–29:00 | Research contents and a concrete dummy-report test to adapt |
| 29:00–30:00 | Close |
| 30:00–35:00 | Questions |

## Evidence and publication contract

- All research figures come from [generated statistics](../data/derived/stats.md),
  not manually maintained slide numbers.
- A non-zero `Hacked` score is an agent-assigned label, not an independently
  confirmed compromise. Participants are inferred senders, not a verified
  count of trained or untrained attackers.
- The cohort result is observational. It does not isolate a control's causal
  effect or establish superiority of one attack class.
- Attribute public incidents to Alex and distinguish reported actions from
  independently verified tool effects. Do not present styled chat replays as
  verbatim transcripts without provenance.
- The [community scenarios](../defense/regression-scenarios.md) are synthetic
  test designs, not an executed benchmark or a universal scanner.
- Only publishable code, methods, aggregates, and approved de-identified
  illustrations are offered. Private transcripts and translation artifacts are
  not part of the release; public artifacts alone cannot regenerate the corpus.

## Original contribution and prior work

The contribution is independent longitudinal analysis and a portable,
evidence-based hardening workflow. The experiment, public incident reports, and
builder-side analysis are Alex Liverant's. Multi-turn manipulation and agent
authorization failures are not claimed as new attack classes.

The [evidence map](../defense/evidence-map.md) links the public reports, Crescendo,
and the OWASP Agentic Top 10. Present the cases as operational examples of
existing threat categories, not proof that OWASP has omitted identity or memory.

The earlier private figures and claims must not be reused as current findings. See
[methodology](../research/methodology.md) for limitations and
[the catalogue's correction note](../research/attack-patterns.md) for the
history of the analysis.

## Credit

Alex Liverant built, deployed, and operated the agent and published what failed:
[alextwin.ai](https://www.alextwin.ai/) and
[alexbot-public](https://github.com/alexliv1234/alexbot-public).
Asaf Nakash participated in the community and developed the independent analysis
and hardening resource in this repository.
