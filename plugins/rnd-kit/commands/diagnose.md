---
description: Root-cause a failure, regression, bad output, or a metric that moved the wrong way — competing hypotheses, discriminating evidence, and the check that should have caught it. Explains; does not fix.
argument-hint: <the symptom — what you saw vs what you expected>
---

# /diagnose — why is this happening?

Symptom: **$ARGUMENTS**

This command explains. It does not fix, and it does not run anything that costs money or touches
a live service — if the decisive observation needs a harness, it says so and stops at the gate.

If `$ARGUMENTS` is vague ("search is bad", "it's broken"), do not start guessing. Get the precise
symptom first — observed versus expected, on a specific input — via `clarifier` or by asking
directly. Diagnosing an unstated symptom produces a confident answer to an unasked question.

## 1 · Investigate along independent axes

Launch **in a single message**:

- `diagnostician` — owns the differential: hypotheses across code, **data**, config, dependency,
  boundary and measurement layers, each with the cheapest observation that discriminates it.
- `scout-repo` — the ground truth of the failing path: real call sequence, state, config that
  changes behaviour, what the tests actually assert.
- `scout-web` — **only if** an upstream dependency is plausibly implicated. Known bug, changed
  behaviour between versions, an issue thread with the same signature.

Do not skip the data layer because the code layer looks guilty. In a retrieval or ingestion
system especially, the most common root cause is not broken code — it is content that never made
it into a form the system could match, and the code faithfully doing what it was told with it.

## 2 · Refute the conclusion

Send the proposed root cause to `refuter` before you believe it, with the reproduction lens:
*construct the concrete input that produces this failure through this exact mechanism.* A causal
chain nobody could reproduce is a story, and a plausible story is the most expensive thing in
debugging — it gets fixed, the symptom persists, and now there is one more change to reason about.

If the chain does not survive, report the differential honestly: what is eliminated, what remains,
and the cheapest observation that would separate the survivors.

## 3 · Report

Lead with the causal chain, one line:

> `<root cause>` → `<mechanism>` → `<symptom>`

Then: the evidence at `file:line` for each link · confidence and what would settle any doubt ·
**the check that should have caught this and did not** · the blast radius found by grep, not
guessed · containment versus cure, with trade-offs · and the gated run that would confirm it,
proposed and not started.

Stop there. Fixing is a separate decision, and often a separate command — `/rnd` if the fix needs
design, a direct ask if it is obvious. The user decides whether the cure is worth it.
