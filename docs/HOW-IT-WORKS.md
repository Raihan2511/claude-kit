# How the kit works

Twelve agents, nine commands, three workflows. This is what actually happens between *"here is
my problem"* and *"here is the change, and here is what is proven about it"*.

Every diagram below is drawn from the files in `plugins/rnd-kit/`, not from a design sketch.

---

## 1 · The model in one paragraph

You talk to **one** session. It never does the deep work itself — it **decomposes** your problem,
**launches specialists in parallel**, and **reassembles** what they return. Each specialist gets a
clean context, one job, and no ability to talk to you. That last constraint shapes everything:
when an agent needs a decision, it *returns the question*, and the main session asks you.

```
                            ┌───────────┐
                            │    YOU    │
                            └─────┬─────┘
                       problem in │ answer out
                            ┌─────▼──────────────────────┐
                            │       MAIN SESSION         │
                            │  decompose · dispatch ·    │
                            │        reassemble          │
                            └─────┬──────────────────────┘
                                  │
             launches them ───────┤       they report back ──────┐
             (they cannot         │       (to the session,       │
              reply to you)       │        never to you)         │
              ┌───────────┬───────┴───────┬───────────┐          │
              ▼           ▼               ▼           ▼          │
          ┌───────┐   ┌───────┐       ┌───────┐   ┌───────┐      │
          │ agent │   │ agent │       │ agent │   │ agent │ ─────┘
          └───────┘   └───────┘       └───────┘   └───────┘
             all running at the same time
```

---

## 2 · The twelve agents

| Role | Agents | Edits files? |
|---|---|---|
| **Understand** | `clarifier` · `diagnostician` | no |
| **Research** | `scout-repo` · `scout-web` | no |
| **Attack** | `refuter` | no |
| **Decide** | `architect` | no |
| **Build** | `builder` · `integrator` | **yes** |
| **Gate** | `review-gate` | no |
| **Operate** | `setup-runner` · `harness-runner` · `committer` | gated |
| **Write** | `scribe` | docs only |

Three of them hold gates — `setup-runner`, `harness-runner` and `committer` are the *only* agents
allowed to start a setup, run an eval, or write to git, and each refuses to act without a literal
confirmation token that it cannot write for itself.

---

## 3 · What happens when you give it a problem

`/rnd <problem>` is the full pipeline. It stops for you at exactly **four** points and runs
autonomously everywhere else.

```
  /rnd "<your problem>"
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 0 · UNDERSTAND                          2 in parallel  │
├──────────────────────────────────────────────────────────────┤
│   clarifier                    diagnostician                 │
│   what is the real problem?    why is it broken?             │
│                                (only if something is)        │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
  ╔══════════════════════════════════════════════════════════╗
  ║  ⛔ STOP 1 — you answer                                  ║
  ║     4 questions, one round, one per axis:                ║
  ║     PROBLEM · APPROACH · SCOPE · TRADE-OFF               ║
  ╚══════════════════════════════════════════════════════════╝
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 1 · RECON                        up to 6 in parallel   │
├──────────────────────────────────────────────────────────────┤
│  scout-repo   scout-repo  │  scout-web   scout-web  scout-web│
│  subsystem A  subsystem B │  specs       source     prior art│
│                           │              + issues            │
│      how our code works   │     what the outside world says  │
└──────────────────────────────────────────────────────────────┘
       │   findings, each with a source
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 2 · REFUTE                          2–4 in parallel    │
├──────────────────────────────────────────────────────────────┤
│   refuter      refuter      refuter                          │
│   "kill this claim" — one per load-bearing finding           │
│                                                              │
│   refuted  → dropped, loudly                                 │
│   survives → carried forward, narrowed if it must be         │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 3 · architect                              1, alone    │
│   options → one decision with reasons → lanes with           │
│   disjoint file ownership                                    │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
  ╔══════════════════════════════════════════════════════════╗
  ║  ⛔ STOP 2 — approve the plan                            ║
  ║     the decision · what it trades away · the lanes       ║
  ║     · and the strongest REJECTED option, so the          ║
  ║       choice is real                                     ║
  ╚══════════════════════════════════════════════════════════╝
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 4 · BUILD                           one per lane       │
├──────────────────────────────────────────────────────────────┤
│   builder A        builder B        builder C                │
│   owns src/a/**    owns src/b/**    owns src/c/**            │
│                                                              │
│   file sets are DISJOINT — a builder that reaches outside    │
│   its lane reports COLLISION and the lanes are re-cut        │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 5 · integrator                             1, alone    │
│   the seams — the defects that exist only BETWEEN            │
│   correct pieces. Gets the whole tree through every          │
│   cheap check.                                               │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 6 · harness-runner          PREPARE ONLY — runs nothing│
│   returns: command · duration · cost · what it touches       │
│            · preconditions it checked read-only              │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
  ╔══════════════════════════════════════════════════════════╗
  ║  ⛔ STOP 3 — run the harness?                            ║
  ║     yes → re-invoked with RUN-HARNESS: CONFIRMED         ║
  ║     no  → stops cleanly, tells you what IS verified      ║
  ╚══════════════════════════════════════════════════════════╝
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ PHASE 7 · review-gate — is NOW the time, and at what scope?  │
│   checks: anything to review? finished? cheap checks pass?   │
│           already reviewed? big enough to be worth it?       │
│   → review now | fix first | not yet | not worth it          │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
  ╔══════════════════════════════════════════════════════════╗
  ║  ⛔ STOP 4 — run the code review?                        ║
  ║     "Implementation and validation are complete.         ║
  ║      The changes are ready for code review.              ║
  ║      Would you like me to run the code review?"          ║
  ║                                                          ║
  ║     yes → /code-review on the current diff               ║
  ║           (+ /security-review if it touches auth,        ║
  ║            secrets, input parsing, deps …)               ║
  ║     no  → straight to close, no argument                 ║
  ╚══════════════════════════════════════════════════════════╝
       │
       ▼
   PHASE 8 · close
   what changed · what is verified and by which check ·
   what is NOT verified · what was noticed and deliberately
   not done · the obvious next step
```

**The four stops are the whole ergonomic design.** Between them nothing asks permission to
continue; at them, nothing proceeds without you. Phase 1 might be five agents at once and Phase 4
three more — you are not consulted about any of it, because you already agreed the problem and
the plan.

Note what is *not* in that chain: **build does not flow into review automatically.** The pipeline
goes build → harness → **ask** → review-or-finish. A reviewer that runs itself is not a gate, and
"the diff looked risky" is exactly the reasoning that turns a gate into a formality. `/code-review`
and `/security-review` are the built-in skills, unmodified — this gate decides *whether* they run,
never *how* they work.

---

## 4 · Why some of it is parallel and some is not

This is the part that decides whether a decomposition helps or just costs more. The rule from the
doctrine (§A1) is to split on the axis that makes pieces **independent** — and to refuse to fake
it on the axis that does not.

```
   A request bigger than one edit
              │
              ├──► ① SPLIT BY QUESTION                    FAN OUT ✓
              │       "what does our code do now?"
              │       "what does the spec say?"
              │       "how do others solve this?"
              │       └─ no data dependency between them
              │
              ├──► ② SPLIT BY FILE BOUNDARY               FAN OUT ✓
              │       lane A owns  src/a/**
              │       lane B owns  src/b/**
              │       └─ disjoint, so they cannot collide
              │
              └──► ③ SPLIT BY STAGE                      SEQUENTIAL ✗
                      research → design → build → verify
                      └─ each one needs the previous one's
                         output, so "parallelising" it just
                         builds on answers that do not exist yet
```

So: **scouts run together, refuters run together, builders run together. Stages do not.** An
architect cannot decide before the evidence lands; an integrator cannot fix seams that do not
exist yet.

Two mechanics make the parallel parts real rather than nominal:

- **One message, many agents.** Agents launched in a single message run concurrently; launched
  one per message, they queue. The commands say "in a single message" for exactly this reason.
- **Disjoint file ownership.** Two builders may never touch the same file. If two lanes want one
  file, they *are* one lane — and `lanes.js` refuses to start rather than risk it.

---

## 5 · The workflows — same shapes, deterministic

The phases above are the main session's judgement. The three workflows are the same shapes
written as **code**, so the control flow does not depend on a model deciding well. They cost real
tokens and only run when you ask for one.

### `recon` — 4 angles, each refuted the moment it lands

```
   your question
        │
        ├──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐
   │  repo   │   │   spec   │   │  source  │   │ prior art │
   │scout-   │   │scout-web │   │scout-web │   │ scout-web │
   │ repo    │   │docs only │   │ GitHub,  │   │benchmarks,│
   │         │   │          │   │ issues   │   │ trade-offs│
   └────┬────┘   └────┬─────┘   └────┬─────┘   └─────┬─────┘
        │             │              │               │
        ▼             ▼              ▼               ▼
   refuter ×2    refuter ×2     refuter ×2      refuter ×2
        │             │              │               │
        └──────────────┴──────────────┴──────────────┘
                       │  ◄── barrier: needs everything
                       ▼
              ┌──────────────────┐
              │      CRITIC      │  what modality was never run?
              │                  │  what claim went unverified?
              └────────┬─────────┘
                       ▼
                   SYNTHESIS
            one answer, graded by confidence
```

**Pipeline, not barrier.** The repo angle's findings go to refuters the moment they land — it does
not wait for prior art to finish. A barrier appears only at the critic, which genuinely needs
everything at once. At most **2 load-bearing findings per angle** get refuted, and when it skips
one it **logs that it skipped it** — a silent cap reads as full coverage, which is a lie.

### `lanes` — overlap refused before anything starts

```
   lanes: [A, B, C]
        │
        ▼
   ┌─────────────────────────────────────┐
   │ do any two lanes own the same file? │
   └────────┬──────────────────┬─────────┘
         YES│                  │NO
            ▼                  │
   ╔══════════════════════╗    │
   ║  THROW               ║    │
   ║  refuses to run at   ║    │
   ║  all — merge them    ║    │
   ║  into one lane       ║    │
   ╚══════════════════════╝    │
                               ▼
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌───────────┐    ┌───────────┐    ┌───────────┐
        │ builder A │    │ builder B │    │ builder C │
        │ src/a/**  │    │ src/b/**  │    │ src/c/**  │
        └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
              ▼                ▼                ▼
        ┌───────────┐    ┌───────────┐    ┌───────────┐
        │self-review│    │self-review│    │self-review│
        │ (refuter) │    │ (refuter) │    │ (refuter) │
        └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
              │                │                │
              └────────────────┼────────────────┘
                               ▼  ◄── barrier: needs every lane
                       ┌───────────────┐
                       │   INTEGRATE   │  the seams between
                       │               │  correct pieces
                       └───────┬───────┘
                               ▼
                     one coherent change
```

The overlap check is the point of the workflow. Two builders racing in one file corrupts both
lanes, and a hard error up front is cheaper than discovering it afterwards.

### `deep-review` — 3 dimensions, unanimity to survive

```
   the diff
        │
        ├────────────────┬────────────────┐
        ▼                ▼                ▼
  ┌────────────┐  ┌────────────┐  ┌──────────────┐
  │correctness │  │  contract  │  │simplification│
  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘
        │               │                │
        └───────────────┴────────────────┘
                        │
                        ▼   for EACH finding:
              ┌──────────────────────┐
              │      refuter #1      │  lens: correctness
              │  is it actually      │  — or is the path
              │  wrong, or unusual?  │    even reachable?
              └──────────┬───────────┘
              ┌──────────▼───────────┐
              │      refuter #2      │  lens: reproduction
              │  construct the exact │  — no constructible
              │  input that triggers │    case means it is
              │  it                  │    theoretical
              └──────────┬───────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   both failed to kill it      either one refuted it
          │                             │
          ▼                             ▼
     ┌─────────┐                 ┌──────────────┐
     │CONFIRMED│                 │   DROPPED    │
     └─────────┘                 │ reported,    │
                                 │ NOT hidden   │
                                 └──────────────┘
```

**Two skeptics per finding, and unanimity is required** — one credible refutation drops it. The
refuters are told to open the file themselves rather than trust the citation, because a cited line
often says something merely *adjacent* to the claim. Dropped findings are **reported, not hidden**:
what a naive pass would have told you and been wrong about is usually the most useful section.

---

## 6 · The gates

Three agents can spend money, change live state, or publish. None acts on its own initiative, and
none can manufacture its own permission.

```
   setup-runner  ·  harness-runner  ·  committer
        │
        │  invoked normally = PREPARE MODE
        ▼
   ┌───────────────────────────────────────────────┐
   │  a plan, a cost, and the exact command        │
   │  ending in the literal line:                  │
   │       GATE: awaiting user confirmation        │
   │  ── nothing has run ──                        │
   └───────────────────┬───────────────────────────┘
                       ▼
   ╔══════════════════════════════════════════════╗
   ║  the MAIN SESSION asks you                   ║
   ║  (the agent cannot — subagents never talk    ║
   ║   to the user; this is why the gate exists)  ║
   ╚═══════════════┬══════════════════╤═══════════╝
       explicit yes│                  │anything else
                   ▼                  ▼
      re-invoked with the        stops cleanly,
      literal token              reports what IS
                   │             already verified
                   ▼
      executes exactly what you approved
```

| Agent | Token | Notes |
|---|---|---|
| `setup-runner` | `SETUP: CONFIRMED` + a named run path | the token alone is not enough — an unnamed path stays in survey mode |
| `harness-runner` | `RUN-HARNESS: CONFIRMED` | each run is its own consent; an earlier yes does not carry over |
| `committer` | `COMMIT: CONFIRMED`, then `PUSH: CONFIRMED` | a push is a **separate** consent from a commit |

Four independent layers hold this up, each covering the others' weakness:

```
  1. DOCTRINE      §A5, §A8         weakness: a model must read it
  2. THE TOKEN     cannot self-write weakness: covers one agent only
  3. settings ask  allow/ask/deny    weakness: prefix match — `cd /x && …` slips past
  4. PreToolUse    the whole command weakness: none of the above
     hook          string, anywhere
```

Layer 4 is the one that closes the hole. It returns **ask**, never **deny** — you are never
blocked from running your own eval, only never surprised by one starting itself.

---

## 7 · Which entry point

```
   what do you have?
        │
        ├─ a repo you just cloned that does not run? ──────► /setup
        │
        ├─ something is broken? ───────────────────────────► /diagnose
        │
        ├─ you want to KNOW, not to change? ───────────────► /recon
        │
        ├─ you want to change it, approach already settled?► /lanes
        │
        ├─ you want to change it, real unknowns? ──────────► /rnd
        │
        ├─ the work is done and should be recorded? ───────► /commit
        │
        └─ a repo should tell the kit what it is? ─────────► /port-setup
```

| Command | Use it when | Ends with |
|---|---|---|
| `/clarify` | the ask is vague, or a wrong assumption is expensive | an agreed brief |
| `/diagnose` | something is broken, slow, or wrong | a causal chain — no fix applied |
| `/recon` | you want to *know*, not to change | a graded, source-backed answer |
| `/rnd` | a real problem with real unknowns | a built, integrated change + a harness offer |
| `/lanes` | the approach is settled, you want it built fast | an integrated change |
| `/setup` | you just cloned it and want it running | a verified working checkout + `SETUP.md` |
| `/harness` | you are ready to test | numbers, and what they do **not** mean |
| `/commit` | the work should be recorded | a sequence of small commits you approved |
| `/port-setup` | a repo should tell the kit what it is | that repo's `CLAUDE.md` |

You rarely need to pick. Doctrine §A0 routes a vague request to `clarifier` before anything else
happens, whether or not you typed a command.
