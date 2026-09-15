---
description: Pin down what the problem actually is before any work starts — resolves what the repo can answer, then asks you only the questions that would change the outcome.
argument-hint: <the request, however vague>
---

# /clarify — understand the problem before solving it

Request: **$ARGUMENTS**

Nothing gets built here. The output is a shared, written understanding of what "done" means.

## 1 · Investigate before asking

Send `$ARGUMENTS` to `clarifier`. It reads the repo first and answers everything the repo can
answer, so the questions that come back are only the ones that genuinely need you.

If the request mentions something broken, launch `diagnostician` **in the same message** — a
misdiagnosed symptom is the most common way a clear-sounding request turns out to be the wrong
problem, and knowing the cause often dissolves half the questions.

## 2 · Ask — properly

Take the clarifier's question set and put it to the user with `AskUserQuestion`. The set is
built to span four axes, and that spread is the point — four questions about one detail leave
you knowing that detail and still not knowing what the user wants:

| Axis | Settles |
|---|---|
| **PROBLEM** | what is actually wrong, or what must be true afterwards |
| **APPROACH** | which solution shape they want — the real fork in the road |
| **SCOPE** | how far this goes, and what stays broken on purpose |
| **TRADE-OFF** | what wins when correctness, speed, cost and simplicity collide |

- **Ask them together, in axis order**, in one round. Not four rounds of one, and not one
  question when three axes are still open.
- At most one question per axis. If the clarifier returns two from the same axis, that is a bug
  in the set — send it back rather than spending a round on it.
- Fewer than four is fine when the repo already settled an axis. The clarifier reports which it
  dropped and why in `AXES-DROPPED`; relay that, so the user can correct an axis you closed
  wrongly.
- Every option is a **concrete choice** with a real consequence, never "yes / no / not sure".
- The recommended option goes first, marked `(Recommended)`. You are expected to have an opinion.
- Where the options are structural — two designs, two output shapes, two schemas — use the
  `preview` field to show them side by side. Seeing beats describing.

If the clarifier returns no questions, do not manufacture any. Say the request is already clear,
state the assumptions you are proceeding on, and move on.

## 3 · Write it down

Produce the brief — short, and in the user's own terms:

```
PROBLEM:    <one sentence, observable behaviour>
REAL-GOAL:  <the goal behind the request, if different>
DONE-WHEN:  <the observable test for success>
CONSTRAINTS:<what must not change, what budget it lives inside>
SCOPE:      in — <…>  ·  out — <…>
ASSUMPTIONS:<what you are proceeding on, unanswered>
UNKNOWNS:   <what is still open, and how it would be settled>
NEXT:       <the single cheapest next move>
```

Then stop and offer the routes: `/recon` if the unknowns are external, `/diagnose` if something
is broken, `/rnd` to build it, or a direct ask if it turned out to be small.

**Confirm the brief before building.** A brief the user has not agreed to is just your opinion
written down more neatly.
