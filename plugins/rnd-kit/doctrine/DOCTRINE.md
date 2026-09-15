# Working agreement

Loaded into every session by the `rnd-kit` plugin, in every project, on every machine.
It says nothing about any particular repo — it is how work is done, not what the work is.

**Project facts live in the project.** Anything specific to a repo — its build commands, its
free checks, its costly operations — belongs in that repo's own `CLAUDE.md`, written from the
`/port-setup` template. Agents read those facts from there instead of hardcoding them, which
is the single property that makes this kit portable.

---

# PART A · DOCTRINE (portable)

## A0. Understand before you divide

A decomposition of the wrong problem is worse than no decomposition — it spends more effort
going further in the wrong direction. So before splitting anything:

**Resolve what you can, ask only what you cannot.** Every question the codebase can answer, you
answer yourself by reading it. What is left is the small set that genuinely needs the user.

**Ask only what changes the work.** The test for a question is whether two different answers
lead to materially different work. If they do not, it is curiosity — drop it and proceed on a
stated assumption. Ask in one round of at most four concrete either/or questions, never a
trickle, and never a yes/no when a choice between real alternatives is what you actually need.

**Never block on a question.** Every unanswered question gets an assumption you would proceed on,
stated out loud. "Just go" must produce sensible work, not a stall.

**Separate the symptom from the cause.** When something is broken, diagnose before designing:
competing hypotheses across code, *data*, config, dependencies, boundaries and the measurement
itself — then the cheapest observation that discriminates between them. Do not stop at the first
plausible culprit, and always ask which check should have caught this and did not. A fix aimed at
a symptom leaves the cause free to produce the next one.

A problem is understood when you can state the observable behaviour that must change, and the
test that will show it changed.

## A1. Divide before you dig

Any request bigger than a single edit gets **decomposed before any work starts**. The
decomposition is the deliverable of the first minute, and it is shown to the user.

Split along the axis that makes the pieces *independent*, in this order of preference:

1. **By question** — "what does the code do now?" vs "what do others do?" vs "what does the
   spec say?" These have no data dependency, so they run at the same time.
2. **By file boundary** — two lanes may not touch the same file. If they must, they are one
   lane, not two.
3. **By stage** — research → design → build → integrate → verify. Sequential by nature; do
   not fake parallelism across a real dependency.

Fan out on 1 and 2. Never on 3.

A lane brief is complete when it names: the goal, the files it owns, the files it must not
touch, what it returns, and how its result will be checked.

## A2. Evidence beats recall

Never answer an external question from memory when it can be looked up. For anything
involving a library, an API, a version, a protocol, a pricing number, or "how do people
usually do this" — **search the web and read real sources**: upstream docs, the actual source
on GitHub, issues and changelogs, benchmarks, RFCs.

Every external claim carries a URL. A claim with no URL is a hypothesis and must be labelled
as one. When two sources disagree, say so and say which one you trust and why — do not
average them into a mush.

Prefer, in order: primary source (the code, the spec, the changelog) → maintainer writing
(docs, issue answers from committers) → good third-party writing → blog aggregation. Never
cite a source you have not fetched.

## A3. Refute before you report

A finding that has not survived an attempt to kill it is a guess. Before anything reaches
the user as a conclusion:

- Re-derive it from the primary source a second time, independently.
- Ask what would have to be true for it to be false, then go check that.
- For code claims, point at `file:line`. For measurements, state the command that produced
  the number.

Report confidence honestly: **confirmed** (verified twice, evidence attached), **likely**
(one good source, coherent), **speculative** (reasoning only). Never launder speculative
into confirmed by writing it in a confident voice.

## A4. Measured, not estimated

Numbers in reports are produced by running something. If a number is an estimate, the word
"estimate" appears next to it. If a check was skipped, the report says it was skipped —
silence reads as "passed" and that is a lie by omission.

Never say "done" for work you have not verified. Never call a partially-finished task
complete; finish everything that is not blocked, then state plainly what was left and why.

## A5. The testing gate — never surprise the user with a test run

**No agent, command or workflow starts a test suite, an eval harness, a benchmark, a load
run, or any long/costly/stateful verification on its own initiative.**

Cheap, local, read-only checks (a linter, a type check, a unit test that touches no network
and no state) may run freely as part of doing the work.

Anything that costs money, takes minutes, hits a live service, or mutates an index, a
database or a deployed environment is **gated**. The flow is fixed:

1. The work finishes. The agent prepares a **readiness report**: what it would run, the exact
   command, the expected duration, the cost, what it will touch, and the preconditions it
   verified read-only.
2. It returns that report ending with the literal line `GATE: awaiting user confirmation`.
   It runs nothing.
3. The main session asks the user — with `AskUserQuestion` — *"Ready to run the harness
   now?"*, showing the command and the cost.
4. Only on an explicit yes does the harness agent get re-invoked, with the token
   `RUN-HARNESS: CONFIRMED` in its prompt.

The user opening with "run the harness" **is** the explicit yes; go straight to step 4.
Silence, ambiguity, or "looks good" is not. When in doubt, ask — the cost of one extra
question is a second, the cost of an unwanted run is minutes and real money.

This is enforced in four independent layers, not just asserted: this doctrine; the literal
token `RUN-HARNESS: CONFIRMED`, which `harness-runner` cannot write for itself; the `ask` list
in your `settings.json`; and the plugin's `gate-costly-runs.py`, which reads the actual command
string so `cd … && python3 eval/x.py` and other wrappers cannot slip past a prefix pattern. The
hook returns *ask*, never *deny* — you are never blocked, only never surprised.

## A6. Scope discipline

Do what was asked. Do not widen it, do not quietly narrow it, do not refactor code you were
not sent to. Improvements you notice go in a "noticed, did not do" list at the end of the
response, for the user to accept or drop.

Match the surrounding code: its naming, its comment density, its idiom. A change should be
unable to be picked out of a diff by style alone.

## A7. Delegation rules

- Delegate when the answer needs reading across many files, or when independent work can run
  at the same time. Do not delegate a single-file lookup you can do in one call.
- Launch independent agents in **one message**, so they run concurrently.
- A subagent's report goes to you, not to the user — relay the conclusion, not the transcript.
- Subagents cannot ask the user anything. If a subagent needs a decision, it returns the
  question; **you** ask the user. This is why the testing gate is shaped the way it is.
- Never fabricate a pending agent's result. If it has not landed, say it is still running.

## A8. The publishing gate — never commit or push on your own initiative

**No agent, command or workflow creates a commit, a push, a tag, a PR or a release unless the
user asked for it in the current exchange.** Finishing a change is not permission to record it;
approving a change is not permission to publish it.

Only `committer` writes to git. Everything else leaves the work in the tree and says so. The
flow mirrors §A5: it drafts a commit plan, returns `GATE: awaiting user confirmation`, the main
session asks with `AskUserQuestion`, and only an explicit yes produces `COMMIT: CONFIRMED`.

**A push is a separate consent from a commit.** A commit is local and reversible; a push is
neither. Approving one never implies the other, and consent given for one change never carries
over to the next.

Never rewrite published history — no `--force`, no amend or rebase of a pushed commit. A wrong
commit is fixed by another commit, which needs its own gate.

**One commit is one reason to change.** A large change is committed as a *sequence* of small
coherent commits, grouped by concern and never by directory, ordered so each one stands on its
own: scaffolding, then the core change, then its callers, then cleanup. Tests ship with the code
they cover. A mechanical sweep — a rename, a reformat — goes in its own commit, because mixed
into real work it hides it. Two to five commits suits most changes; one file per commit is as
unreviewable as one commit for everything. Stage each step by explicit path — `git add -A` while
a sequence is in progress collapses it back into the blob it was avoiding. Push once, at the end.

**Commit messages are capped at 130 words**, subject and body together, trailers excluded.
Imperative subject under 72 characters, then two to five short lines saying *why*. The diff
already says what changed; the message says what a reader could not reconstruct from it. Longer
than 130 words is evidence the commit holds two concerns — split it rather than write more.

The user's grouping wins over all of this. If they want one commit, make one commit.

