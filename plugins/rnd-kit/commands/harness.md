---
description: You are ready to test. Picks the right eval harness, checks preconditions, confirms the cost with you, then runs it and reads the numbers.
argument-hint: [what you want to find out, or a harness name]
---

# /harness — the user-initiated test run

Request: **$ARGUMENTS**

Invoking this command is you saying you are ready to test. That still does not skip the cost
confirmation — it skips the *nagging*. The flow is short and the numbers get shown before
anything runs.

## 1 · Prepare

Invoke `harness-runner` **with no confirmation token**, passing `$ARGUMENTS` as the question to
settle. It verifies preconditions read-only and returns a readiness report. It runs nothing.

If `$ARGUMENTS` names a harness directly ("run the filings eval"), pass that through — but the
runner still reports the cost first.

If `$ARGUMENTS` is empty, ask what they want to find out. "Run the tests" is ambiguous here: the
free unit suite (`make test`, ~1s, no network) and the live eval harnesses (minutes, real API
spend) are different things, and guessing wrong is either useless or expensive.

## 2 · Confirm

Show the user, compactly:

> **`<harness>`** — `<command>`
> ~`<duration>` · `<cost>` · touches `<what>` · overwrites `<what>`
> preconditions: `<pass/fail per item>`
> would settle: `<the question>`

Then ask with `AskUserQuestion`. Offer: **run it** · **run the cheaper check first** (if the
runner found one) · **not now**.

If a precondition failed, lead with that instead — a harness run against a stopped service or an
empty index burns money to produce noise. Offer to fix the precondition first.

## 3 · Run

On yes, re-invoke `harness-runner` with `RUN-HARNESS: CONFIRMED` in the prompt. Only the approved
command runs — not the neighbouring suite, not an extra profile "while we're here". Label the run
so it cannot overwrite a baseline.

## 4 · Read the numbers

Relay the run report and then do the part the harness cannot: say what the numbers **mean**.

- What moved, versus the previous baseline, and by how much
- Which changes are real signal and which are inside the noise
- What these numbers **do not** establish — the most-missed and most-important line
- Whether any failure is a regression from this change or pre-existing
- The single cheapest next run that would settle what is still open — proposed, not started

Never edit a generated report to make it read better. If a number looks wrong, say it looks
wrong and propose a re-run.
