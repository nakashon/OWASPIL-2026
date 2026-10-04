# Visual direction: attack stories, not decoration

Design research reviewed on 3 October 2026, following the speaker's request
to avoid a generic AI-generated presentation. No third-party slide template,
photograph, screenshot, or illustration is redistributed in the deck.

## References and decisions

| Reference | Principle used | Concrete application |
|---|---|---|
| [Michael Alley's assertion-evidence approach](https://www.assertion-evidence.com/) and its [model talks](https://www.assertion-evidence.com/models.html) | Organize technical explanation around a message supported by evidence, rather than topic headings and bullet inventories | Case headlines make bounded claims. A primary excerpt or an explicit mechanism diagram carries the slide; detailed qualification lives in the speaking notes. |
| [Matthew Butterick: Presentations](https://practicaltypography.com/presentations.html), including the light/dark visual examples | Design for the audience's viewing conditions; use restrained contrast, consistent text sizes, deliberate alignment, and comfortable space | Warm paper instead of pure white, ink instead of pure black, and no decorative gradients. Dark frames mark the opening, architecture pivot, and close. Room lighting still needs an onsite check. |
| [Bret Victor: Up and Down the Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/) | A visual representation should expose a relationship that is harder to understand as prose alone | The sender-handoff chain exposes the group's contribution. The remote-login request stays fixed while the reply changes. The S01 diagram changes authenticated caller while keeping visible context. |

These sources inform different decisions, not a single universal style.
The deck is not an adaptation of a downloaded template.

## Why the first layout pass was insufficient

The first contact sheet had better typography than the historical deck but
still relied too heavily on paired text blocks and numbered rows. That would
remain a generic presentation with an editorial palette.

The next revision still made audiences read both sides of a transcript while
listening to the speaker. The convention revision instead treats the conversation
as a stage and restores the March deck's story structure:

- The opening architecture uses a group, an agent, and a reachable device.
- Each case opens with the situation, relevant resource, and request.
- March: establish the account route, show recognition, pause on the intent
  question, then enlarge the retraction. Retain the later refusal.
- April 10: map, contradictory replies, an audience question, the bot's offer,
  alternate-route discussion, and a participant-reported effect. End with
  a five-node speaker handoff, not a claim that everyone conspired.
- April 14: the request stays in a fixed card during the challenge and apology.
  The later approval ladder remains visible before the connection-details
  description. No fake terminal or reproduced login details.
- Each click exposes one message. Stable A/B/bot positions, an active-speaker
  color and a fixed or changing task card carry relationships visually.
- A short, source-checked EARLIER excerpt remains visible at consequential
  replies. Do not replace the actual request, the bot's explanation, or its
  options with editorial summaries just to reduce the word count.
- Widened dialogue cards fit the full selected SSH refusal and ownership
  rationale. Definitions and editorial context sit outside the quote card.
- English translations lead; Hebrew originals and fuller curated translations
  are in notes rather than doubling the reading load. Names and times anchor the speakers.
  Text is selected, not a full-message screenshot. Joined omissions are marked.
- The TV case shows the actual pairing discussion and the request for another
  route rather than substituting a network diagram for those messages.
- The ending follows a reported defender change into one complete synthetic
  caller-switch test and its legitimate-use control. No fake passed-test output.
- The clarified ending first ties one practical lesson to each story, then
  explains the research's three deliverables and demonstrates how to adapt a
  dummy-report test. File/control identifiers support the explanation; they
  do not replace it. The research QR points to a human-facing guide, not an
  unexplained instruction to read a repository.
- The refusal-reversal chapter first shows the SSH request and refusal, then
  the challenge and apology, then the later approval exchanges.
- A typographic personal introduction connects Asaf to Context Window without
  a résumé list, employer branding, or invented audience metrics.

## Design system

- Ink `#141C25`; paper `#F7F3E9`; participant A `#89ADFF`;
  participant B `#FFC56F`; bot `#9CD8C5`; inactive cast `#283542`.
- Color identifies the active speaker, not a safe or permitted action. Labels carry
  the distinction independently of color.
- Arial is used throughout, with large, bold dialogue and quiet annotations.
  No online fonts or platform-specific Morph effects are required.
- Every main frame has at most 60 visible words, including labels. The limit is
  enforced in the build and checker. A click is not a separate topic.
- Layouts use editable text and original vector shapes in PowerPoint,
  except the generated QR codes. No mock WhatsApp screenshot disguises a
  paraphrase as an original artifact.
- No stock robots, shields, brains, network wallpaper, fake terminal output,
  or ornamental dashboards.
- Sources and evidence limits stay visible but subordinate. PowerPoint notes
  contain the spoken Hebrew and one delivery cue, not editorial research
  instructions. Full links, original excerpts and detailed caveats are in the
  separate source notes and a collapsed browser-notes section.

## Review criteria

The speaker rejected the first narrative as process-heavy, and the next as
assuming too much prior knowledge. The current structure is setup, numbered
exchanges, outcome, then explanation and a practical response. Methods remain
backup material. Do not bring the explanation forward at the expense of the
actual prompts and answers.

Consistent typography and speaker positions support the replay. Light analysis
frames stop the conversation and inspect what changed. Deliberate pauses change
the rhythm without fragile animation.
Setup and takeaway frames separate the chapters. Check that shortened excerpts still expose the actual
request and response, and that participant labels do not collapse multiple
speakers into one invented attacker.

Check overflow, text hidden behind later shapes, projector-size readability, Hebrew direction, English wrapping,
native PowerPoint rendering, and offline delivery. The same content must remain
understandable without animation. PDF is a supplementary fallback, not a
replacement for the organizer's requested PowerPoint backup.
