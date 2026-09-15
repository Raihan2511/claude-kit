---
description: Work out how to get this freshly cloned repo running — toolchain, containers, database, frontend, env vars — show you every run path with a recommendation and the reasoning, then set it up once you choose. Fixes nothing on its own.
argument-hint: [path to the repo, or what you want running — defaults to here]
---

# /setup — get this repo running

Target: **$ARGUMENTS** — if empty, the current repo.

Nothing is installed, started or written until the user answers. The point of this command is to
make the decision obvious, not to get past it.

## 1 · Survey

Invoke `setup-runner` **with no confirmation token**. It reads the repo (CI config first — that
is the setup that demonstrably works on a clean machine), measures what is actually installed
here, finds every way the project can be brought up, and returns a `SETUP SURVEY` ending in
`GATE: awaiting user confirmation`. It runs nothing.

Relay its `BLOCKERS` and `conflicts` **first**. A README that disagrees with CI, or a port already
taken, changes the answer to everything below it.

## 2 · ⛔ Ask — which path, and why

If the survey found **more than one run path**, the user picks. Ask with `AskUserQuestion`, and
put the agent's recommendation first — **with its reasoning visible, not just the label**:

> **How should this come up?**
> - **Docker Compose (Recommended)** — CI uses this path and Docker is already running; the
>   local path needs Python 3.12, and you have 3.11. ~4 min, 2.1 GB.
> - **Local venv** — faster iteration, no container overhead, but you must install Python 3.12
>   first.

Use the `preview` field to show the steps of each path side by side when they differ
structurally. The user is choosing a workflow they will live in, not just a command.

If there is only one viable path, do not manufacture a choice — show the plan and ask to proceed.

Show, in the same round: the steps, the total time, what gets written, and **which secrets they
will have to supply themselves**. A plan approved without that last part fails later, confusingly.

## 3 · Execute

Re-invoke `setup-runner` with `SETUP: CONFIRMED` **and the chosen path named**. The token alone
is not enough — an unnamed path leaves it in survey mode, on purpose.

## 4 · When it stops — and it may

`setup-runner` **never repairs anything**. If a step fails it returns `SETUP BLOCKED` with the
real error, the traced cause, the exact fix, what that fix would touch, and — the part that
matters — **whether it genuinely needs fixing at all**, or is cosmetic, optional, or only affects
a feature the user may not want.

Relay all of that and let the user decide. Do not apply the fix on their behalf, do not talk them
into it, and do not retry the step hoping it passes. If they want it fixed, they fix it or
approve a new plan; if they would rather take the alternative path, re-survey for that path.

## 5 · Report

Relay the `SETUP REPORT`: what ran, what was **verified** by a real check, what was skipped and
why, warnings noticed but not acted on, secrets still unfilled, and the command that now runs
the app.

"Exited 0" is not verification. If the health endpoint was never hit and the frontend never
loaded, say that plainly rather than letting silence imply success.

---

**Not to be confused with `/port-setup`.** That one teaches the *kit* about a repo — it writes a
`CLAUDE.md` so the agents know what the project is. This one gets the *project* running for a
human. A freshly cloned repo usually wants `/setup` first.
