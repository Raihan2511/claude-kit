---
description: Full divide-and-conquer run on a problem — parallel recon (repo + web + prior art), adversarial synthesis, a lane plan you approve, parallel implementation, integration, then a gated harness offer.
argument-hint: <the problem, in your own words>
---

# /rnd — research, decide, build, integrate, verify

Problem: **$ARGUMENTS**

Run the phases below in order. **Stop at every ⛔ and wait for the user.** Between the stops
you are autonomous — do not check in for permission to continue mid-phase.

If `$ARGUMENTS` is empty, ask what the problem is and stop. If it is a one-line fix that needs
no research, say so and just do it — this pipeline is for problems with genuine unknowns, and
running it on a typo wastes everyone's time.

---

## Phase 0 · Understand the problem — ⛔ if it is not clear

Cheap, and it protects every phase after it. Skip only when the request is already unambiguous
and precisely scoped; say that you are skipping it and why.

Launch `clarifier`. If the request describes something **broken**, launch `diagnostician` in the
same message — the cause frequently dissolves half the questions, and reframes the rest.

- **No questions came back** → state the assumptions you are proceeding on and go to Phase 1.
- **Questions came back** → ⛔ **STOP.** Put them to the user with `AskUserQuestion`: at most four
  in one round, concrete options, recommended first. Then write the one-paragraph brief —
  problem, done-when, in scope, out of scope, assumptions — and carry it into every later phase.

If Phase 0 reveals the request targets a symptom rather than the cause, say so **now** and ask
whether to re-aim. Solving a precisely-specified wrong problem is the most expensive outcome
available, and this is the cheapest moment to catch it.

## Phase 1 · Recon (parallel, no barrier between angles)

Decompose the problem into independent questions, then launch **in a single message**:

- `scout-repo` × 1–3 — one per subsystem the problem touches. How does it work *now*, where are
  the seams, what do the tests pin down, what is the blast radius.
- `scout-web` × 1–3 — one per external angle, each with a distinct brief so they do not overlap:
  *upstream docs and version semantics* · *real implementations on GitHub, issues, changelogs* ·
  *prior art and published benchmarks — how do others solve this shape of problem*.

Scale the count to the problem: two agents for something narrow, six for something open. Do not
launch two agents with briefs that would return the same thing.

While they run, read the project's own docs on the subject yourself. Do not idle.

**Report to the user when they land**: the findings that matter, each with its source, and the
contradictions between them. Keep it to what changes the decision.

## Phase 2 · Refute (parallel)

Take the findings the decision actually rests on — usually two to four — and send each to a
`refuter`, all in one message, with different lenses where the claim can fail more than one way.

Anything refuted is dropped, loudly. Anything that survives narrowed is carried forward in its
narrowed form. Do not carry an unverified assumption into a plan without labelling it.

## Phase 3 · Decide and cut lanes

Hand the surviving evidence to `architect`. It returns options, one decision with reasons, and a
lane breakdown with disjoint file ownership.

⛔ **STOP.** Present to the user: the decision in two sentences, what it trades away, the lanes
and their order, and anything the architect flagged as genuinely the user's call. Ask for
approval with `AskUserQuestion` — offer *approve as-is*, *approve with changes*, and the
strongest rejected option, so the choice is real. Do not write code until this is answered.

## Phase 4 · Build (parallel lanes)

For an approved plan, launch one `builder` per lane **in a single message** — but only for lanes
that are genuinely concurrent. A lane that defines a shared interface goes first, alone; its
dependents start after it lands.

Verify the lanes' file ownership is disjoint before launching. If two lanes want the same file,
merge them into one lane. If a builder reports a `COLLISION`, stop, re-cut the lanes, relaunch —
do not let a builder cross into another's files.

## Phase 5 · Integrate

Two or more lanes → `integrator`, always. One lane → skip it. The integrator fixes the seams and
gets the whole tree through every **cheap** check (lint, types, unit tests).

**Do not review here.** The review gate is Phase 7, after verification, and it is the user's
call — not something this phase triggers on its own.

## Phase 6 · Verify — ⛔ THE GATE

Invoke `harness-runner` **with no confirmation token**. It returns a readiness report and runs
nothing.

Relay it to the user and ask with `AskUserQuestion`:

> **Ready to run the harness now?** `<command>` · ~`<duration>` · `<cost>` · touches `<what>`

- **Yes** → re-invoke `harness-runner` with `RUN-HARNESS: CONFIRMED` in the prompt.
- **No / later** → stop cleanly. Report what *is* verified by the cheap checks and what remains
  unproven, and leave the exact command for when they want it. This is a completely acceptable
  ending; do not nudge.

Never skip the gate because the change looks safe, because the user seemed to be in a hurry, or
because they approved a harness run earlier in the session. Each run is its own consent.

## Phase 7 · Review — ⛔ THE REVIEW GATE

Implementation and validation are done. The change is *ready* for review — which is not the same
as reviewing it.

**Invoke `review-gate` first.** It reads the diff, checks whether the work is actually finished,
runs the project's cheap checks, and decides whether a review is worth running *now* and at what
scope. It runs no review itself and returns `GATE: awaiting user confirmation`.

Its recommendation comes back as one of four, and you relay it honestly rather than always
asking the same question:

| It says | You do |
|---|---|
| **review now** | ask the question below |
| **fix first** | report what fails the cheap checks; a review of a tree failing its own type check is spent on noise. Offer to fix, then re-gate |
| **not yet** | report what looks unfinished, with `file:line`. Do not ask about reviewing |
| **not worth it** | say why — trivial, generated, already reviewed — and go to Phase 8 |

When it says **review now**, ask with `AskUserQuestion`:

> Implementation and validation are complete. The changes are ready for code review.
> **Would you like me to run the code review?**

- **Yes** → run `/code-review` at the effort `review-gate` proposed, on the current diff, and
  relay the findings.
- **Yes, security too** → offer this option **only** when `review-gate` named the `file:line`
  that triggers it. Run `/security-review` as well.
- **No, I'll review it myself** → say fine and go to Phase 8. Do not argue, do not run a
  "quick partial check anyway", and do not list what the review *would* have found. A user who
  reviews their own diff is doing the right thing.

Rules for this gate:

- **The main session runs the review, not the agent.** `/code-review` and `/security-review` are
  skills and load here; a subagent cannot invoke them. `review-gate` judges and proposes only.
- **Never run a review because the diff looks risky.** That is the reasoning that turns a gate
  into a formality. If it genuinely needs one, say why in one sentence *inside the question* —
  then accept the answer.
- **Do not chain reviews.** One yes runs one review pass. A follow-up review after fixes is a
  new question.
- **Do not review your own work silently** as part of "closing out". Phase 8 reports; it does not
  inspect.
- The reviewers are unmodified — `/code-review` and `/security-review` are the built-in skills.
  This gate decides *whether* they run, never *how* they work.

## Phase 8 · Close

Report, in this order: what changed and where · what is verified and by which check · what is
**not** verified · what you noticed and deliberately did not do · the obvious next step.

Documentation only if the user asks — then `scribe`.

---

**If the problem turns out to be the wrong problem**, say so at the phase where you learn it and
stop. Finishing the wrong pipeline correctly is the most expensive possible outcome.
