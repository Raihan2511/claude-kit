---
description: Cut a task into independent lanes with disjoint file ownership, run them in parallel builders, then integrate the seams. Skips research — use when the approach is already decided.
argument-hint: <the task to split and build>
---

# /lanes — parallel implementation of a decided approach

Task: **$ARGUMENTS**

The approach is assumed settled. If it is not — if there is a real choice still open — stop and
say so; `/rnd` is the command that decides, this one builds.

## 1 · Cut

Work out the lanes yourself (fast path), or send it to `architect` if the split is not obvious.

The rule that makes this work: **two lanes may never own the same file.** Concretely —

- Grep for the files each lane must change *before* deciding the split. Overlap you discover
  after launching costs a restart.
- Files two lanes both need mean they are one lane. Merge them.
- A shared interface, type, or config key is its own lane, it runs **first**, and it runs alone.
  Its dependents start only after it lands.
- Tests live with the lane that owns the code they test.

Show the user the lane table before launching: lane · goal · files owned · runs when. Two lines
per lane, no more.

## 2 · Build

Launch one `builder` per concurrent lane, **all in one message**. Each brief must state: goal,
owned files, forbidden files, the contract to honour, and the cheap check that proves it works.

If a builder reports `COLLISION`, do not patch around it — re-cut the lanes and relaunch the
affected ones. A builder reaching into another lane's files is the one failure mode this whole
structure exists to prevent.

If a builder reports failing checks, believe it. Do not paper over a red result in your summary.

## 3 · Integrate

Two or more lanes → `integrator`, always. It owns the seams: contracts implemented differently
on each side, work duplicated because neither lane could see the other, registrations both
assumed the other would add, tests silently invalidated. Then the full cheap check set, green
without weakening anything.

One lane only → run the cheap checks yourself and skip the integrator.

## 4 · Close

Report: the diff by file · what each cheap check proves · what is **not** covered by any check ·
anything noticed and left alone.

Then invoke `harness-runner` with **no** confirmation token to produce a readiness report, relay
it, and ask the user whether to run it. Never start it yourself.
