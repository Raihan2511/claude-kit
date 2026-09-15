---
description: Parallel research sweep on a question — codebase, upstream docs, GitHub implementations, prior art — with every claim adversarially verified before it is reported. Changes nothing.
argument-hint: <the question to research>
---

# /recon — find out, verify, report. No code changes.

Question: **$ARGUMENTS**

This command is read-only. It writes no files, edits no code, and runs no harness. If the
research points at an obvious fix, describe it and stop — implementing is `/rnd` or a direct ask.

## 1 · Decompose

Break the question into angles that are genuinely independent — different *sources*, not
different phrasings. Typically:

| Angle | Agent | Brief |
|---|---|---|
| How does our code do it now? | `scout-repo` | the real call path, the seams, the tests, the blast radius |
| What does upstream actually specify? | `scout-web` | official docs, the spec, version-to-version semantics |
| How is it really implemented? | `scout-web` | source on GitHub, issues, changelogs, maintainer answers |
| What do others do about this shape of problem? | `scout-web` | prior art, published benchmarks, trade-off write-ups |

Drop angles that do not apply. Add one if the question has a dimension the table misses.
State the decomposition to the user in two lines before launching — they may know one angle is
a dead end and save you the work.

## 2 · Sweep

Launch every scout **in a single message** so they run concurrently. Give each a brief specific
enough that no two could return the same finding.

Meanwhile, read this project's own docs on the subject yourself.

## 3 · Refute

For each finding the answer actually depends on, launch a `refuter` — several in one message,
with different lenses when a claim can fail in more than one way. Default to disbelief: a claim
nobody tried to kill is not a finding.

## 4 · Synthesise

Answer the question in the first three lines. Then:

- **Confirmed** — claim, source URL or `file:line`, what it means for us
- **Likely** — same, with what is missing to confirm it
- **Refuted** — what we might have believed, and why it is wrong. This is often the most
  valuable section; do not drop it because it is negative.
- **Contradictions** — sources that disagree, and which you trust
- **Dead ends** — what you looked for and could not find
- **Bearing** — what this changes about what we should do
- **Next** — the cheapest thing that would settle what is still open

No recommendation may rest on a `speculative` claim without saying so in the same sentence.
