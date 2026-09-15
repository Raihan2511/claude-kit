# rnd-kit

A divide-and-conquer working kit for Claude Code: research runs in parallel from independent
sources, every claim gets attacked before anyone acts on it, implementation splits into lanes
that cannot collide, and **nothing expensive ever runs without you saying so.**

It changes how work gets organised. It never changes your project's code on its own.

```
rnd-kit/
├── agents/               eleven specialists, one job each
├── commands/             eight entry points you invoke with /
├── workflows/            deterministic multi-agent orchestration for when depth matters
├── hooks/                enforcement that does not depend on a model reading prose
├── doctrine/DOCTRINE.md  the working agreement, injected into every session
└── templates/            what a project fills in about itself
```

Install it once and every repo on the machine has it — no `.claude/` folder required in any of
them. See the [repo README](../../README.md) for install.

---

## The eight commands

| Command | Use it when | Ends with |
|---|---|---|
| `/clarify <request>` | the ask is vague, or a wrong assumption would be expensive | an agreed brief: problem, done-when, scope |
| `/diagnose <symptom>` | something is broken, slow, or wrong | a causal chain with evidence — no fix applied |
| `/rnd <problem>` | the full pipeline: a real problem with real unknowns | a built, integrated change + a harness offer |
| `/recon <question>` | you want to *know*, not to change anything | a graded, source-backed answer |
| `/lanes <task>` | the approach is settled; you want it built fast | an integrated change + a harness offer |
| `/harness [what]` | **you are ready to test** | numbers, and what they do and do not mean |
| `/commit [context]` | the work is done and should be recorded | a sequence of small commits you approved, each ≤130 words — pushed only if you said so |
| `/port-setup [path]` | a repo should tell the kit what it is | that repo's `CLAUDE.md`, written from its own evidence |

`/rnd` is the one that feels like a platform: it pins down what the problem actually is → recon
fans out across your code, upstream docs, real GitHub implementations and prior art at the same
time → skeptics try to kill each finding → the architect commits to one option and cuts lanes →
builders run those lanes concurrently in files that cannot overlap → the integrator fixes the
seams → you get asked about testing.

It stops for you at exactly three points: **is this the right problem**, **approve the plan**, and
**run the harness?** Everywhere else it runs without pestering you.

## The eleven agents

| Agent | Owns | Can edit? |
|---|---|---|
| `clarifier` | what the problem *is* — resolves from the repo, asks only what changes the work | no |
| `diagnostician` | why it is broken — competing hypotheses, discriminating evidence, root cause | no |
| `scout-repo` | how our code behaves *now* — real call path, seams, tests, blast radius | no |
| `scout-web` | the outside world — docs, specs, GitHub source, issues, prior art, benchmarks | no |
| `architect` | options → one decision with reasons → lanes with disjoint file ownership | no |
| `builder` | exactly one lane, inside its own files only | yes, in its lane |
| `integrator` | the seams between lanes — the bugs that exist only *between* correct pieces | yes |
| `refuter` | destroying claims; a finding that survives it is worth acting on | no |
| `harness-runner` | **the only agent allowed to run an eval, benchmark or live test** | reports only |
| `committer` | **the only agent allowed to commit or push** — splits the change into a sequence, then waits | git only |
| `scribe` | documents in this repo's voice; never invents a number | docs only |

**No agent hardcodes a project fact.** They read them from the project's own `CLAUDE.md`, which
is the single property that makes one installed copy work in every repo. If you ever want to edit
an agent for a specific project, that fact belongs in that project's `CLAUDE.md` instead.

## The doctrine

`doctrine/DOCTRINE.md` is the portable half of a working agreement — understand before you
divide, divide before you dig, evidence beats recall, refute before you report, measured not
estimated, the testing gate, scope discipline, delegation rules, the publishing gate.

A plugin cannot ship a `CLAUDE.md` (memory files are read from the project tree and the user
directory, not from an installed plugin), so it travels as a `SessionStart` hook that prints the
doctrine as `additionalContext`. The effect is the same and it needs no file in your repo. Your
project's own `CLAUDE.md` still loads normally and still wins on any conflict.

---

## The testing gate

**An agent that does harness testing, and that asks you first.**

`harness-runner` has two modes, and the mode is decided by one token in its prompt:

```
no  "RUN-HARNESS: CONFIRMED"  →  MODE A · PREPARE  →  readiness report, runs nothing
yes "RUN-HARNESS: CONFIRMED"  →  MODE B · EXECUTE  →  runs exactly what you approved
```

In Mode A it checks preconditions read-only, works out the *smallest* harness that would answer
the question, and returns:

```
READINESS REPORT
  question:      does the chunking change hurt page retrieval?
  harness:       filings
  command:       docker compose run --rm --entrypoint python3 eval eval/filings_eval.py
  duration:      ~4 min
  cost:          ~120 Claude calls
  touches:       live index (read), writes docs/reports/FILINGS_EVAL.md
  preconditions: orchestrator up PASS · index 6,020 chunks PASS · API key set PASS
  cheaper-first: make test (1s) covers the chunker logic itself
GATE: awaiting user confirmation
```

That last line is the handoff. Subagents cannot talk to you, so the main session asks — *"Ready
to run the harness now?"* — with the command and the cost visible. Only your yes produces the
token. **Each run is its own consent**: approving one earlier in the session does not carry over.

Four independent layers make this hold rather than being a polite suggestion. Each one alone has
a weakness; together they cover each other:

1. **Doctrine** — §A5 forbids every agent from self-starting a costly run, and every one of the
   agent files repeats the limit in its own words. *Weakness: depends on a model reading its
   instructions.*
2. **The token** — `harness-runner` executes only on the literal `RUN-HARNESS: CONFIRMED`, which
   it cannot write for itself. Its description says **prepare-only by default**, so even an agent
   that picks it without reading the body gets a readiness report, not a run. *Weakness: only
   covers that one agent.*
3. **`settings.json` `ask`** — your own permission list prompts on costly commands. *Weakness:
   prefix matching — `cd /repo && python3 eval/x.py` slips past.*
4. **`hooks/gate-costly-runs.py`** — a `PreToolUse` hook that regex-matches the **whole command
   string**, so `cd … &&` chains, `bash -c "…"`, env prefixes, `--entrypoint` forms and pipes are
   all caught wherever the call sits in the line. It returns **ask**, never **deny** — you are
   never blocked, only never surprised.

Layer 4 is the one that actually closes the hole. On a malformed or unparseable hook frame it
stays silent and lets normal permissions apply, so it can never wedge your shell.

See it for yourself:

```bash
printf '{"tool_name":"Bash","tool_input":{"command":"cd /x && terraform apply"}}' \
  | python3 hooks/gate-costly-runs.py     # → permissionDecision: ask
printf '{"tool_name":"Bash","tool_input":{"command":"make test"}}' \
  | python3 hooks/gate-costly-runs.py     # → nothing
```

Free checks are deliberately *not* gated: linters, type checks and fast unit suites run whenever
they are useful. The gate is about money, minutes, and live state — not caution theatre.

Going the other way, `/harness` is you opening the door: it skips the nagging, still shows the
cost, runs it, and then does the part the harness cannot — telling you what the numbers mean and,
more importantly, what they do **not** establish.

### Teaching the gate about your project

The built-in list covers what is costly in *any* repo — `git push`, `terraform apply`,
`kubectl delete`, `docker volume rm`, `make deploy`, `rm -rf`, publishing a package. For this
repo's own costly commands, drop a file at `.claude/gated-patterns.txt`:

```
\bmake\s+(site|scrape|load)\b     # mutates the search index
\bpython3?\s+eval/\w+\.py\b       # eval harness — live index, real API spend
```

One regex per line, matched anywhere in the command string, `# reason` optional. The file is
optional; project rules are checked before the built-in free-checks allow-list, so a rule here
can gate something the kit would otherwise wave through. Template in `templates/`.

---

## The publishing gate

The same shape as the testing gate, for the other thing you never want happening behind your
back: **nothing gets committed or pushed unless you said so in that exchange.**

`committer` is the only agent that writes to git, and it has three modes decided by tokens in
its prompt:

```
no token                              →  PREPARE   →  commit sequence, writes nothing
COMMIT: CONFIRMED                     →  COMMIT    →  runs the sequence, does not push
COMMIT: CONFIRMED + PUSH: CONFIRMED   →  COMMIT, then push once at the end
```

**A push is a separate consent from a commit.** A commit is local and reversible; a push is
neither. Approving one never implies the other, and a yes on one change never carries to the
next. `/commit` offers them as distinct options for exactly this reason.

It also stops on its own when something looks wrong: a remote with **more than one push URL**
(your change would reach two places, and you may only have one in mind), a push straight to the
default branch you did not name, anything that looks like a secret or a generated artifact in
the diff, or a change that is really two unrelated concerns and should be two commits.

Layer 4 backs it up — `git commit`, `git push`, `git rebase`, `git cherry-pick`,
`git reset --hard` and `git clean` all reach the hook and ask, wherever they sit in the command
line. Reading git is untouched: `status`, `diff`, `log`, `branch`, `remote -v` and
`diff --staged` never prompt.

### It commits in steps, not in one blob

**Thirty files in one commit is not a commit, it is a snapshot** — unreviewable, useless to
`git bisect`, and impossible to partially revert. So `committer` groups every changed file into
a sequence and shows you the plan before anything is staged:

```
3 commits from 33 files on `main`:
  [1/3] Add plugin manifests and marketplace catalog     4 files
  [2/3] Port agents, commands and workflows from vespa   21 files
  [3/3] Generalise the cost gate and add the doctrine    8 files
```

How it groups:

- **By concern, never by directory.** One commit touching three folders for one reason is right;
  one folder for three reasons is wrong.
- **Ordered so each commit stands on its own** — scaffolding (config, manifests, a new module
  nothing imports yet), then the core change, then its callers, then cleanup last. A commit whose
  dependency lands two steps later leaves the tree broken in between.
- **Tests ship with the code they cover.** Adding behaviour and proving it is one reason to
  change, not two.
- **Mechanical sweeps go alone.** A rename or reformat across twenty files gets its own commit,
  labelled behaviour-preserving. Mixed into real work it hides the real work — this is the single
  most useful split available.
- **Two to five commits suits most changes.** One commit per file is as unreviewable as one
  commit for everything; past about seven it is splitting on file boundaries, not concerns.
- **A single-concern change stays one commit.** No sequence is manufactured to look thorough.

During execution each step is staged **by explicit path** and checked with
`git diff --staged --stat` before committing. `git add -A` and `git add .` are forbidden while a
sequence is in progress — they sweep up later steps and collapse the sequence back into the blob
it was avoiding. The push happens once, after every commit has landed, never between steps.

**Your grouping wins.** Ask for one commit and you get one commit; ask for a different split and
it re-plans. `/commit` offers *Change the grouping* as a first-class option, and passing
`one commit` as an argument says it up front.

### Commit messages are capped at 130 words

Subject and body together, trailers excluded. The shape:

```
Fix retrieval timeout on cold index          ← imperative, ≤72 chars, no full stop

Cold-start queries hit the 5s ceiling before HNSW warmed, so the
first request after a deploy always fell back to BM25.

Warms the embedder at startup instead of on first use.
```

Each message, not the sequence as a whole. The diff already says *what* changed; the message
says *why*, and what a reader six months from now could not reconstruct from the code. No
narration of how the work went, no "This commit…", no essays. A one-line subject is a complete
message when the change is obvious — padding to reach a length is not a goal. A message that
needs more than 130 words is evidence the commit holds two concerns, and `committer` splits it
rather than writing the longer message.

---

## The workflows

For when ad-hoc fan-out is not enough. These are deterministic scripts — the control flow is
code, not a model's judgement — and they run in the background.

| Workflow | Shape |
|---|---|
| `recon` | 4 angles swept concurrently → skeptics on load-bearing claims → completeness critic → graded synthesis |
| `lanes` | ownership overlap **refused** up front → builders in parallel → per-lane skeptic → integrator |
| `deep-review` | 3 non-overlapping dimensions → 2 skeptics per finding, unanimity to survive |

They cost real tokens and spawn many agents, so they only run when you ask — say *"use a
workflow"*, or invoke one by name. Design notes worth knowing:

- **Pipelines, not barriers.** A finding gets attacked the moment its scout lands, instead of
  waiting for the slowest sibling. Barriers appear only where a stage genuinely needs everything
  at once (the critic, the integrator).
- **`lanes` refuses to start** when two lanes claim the same file. Overlapping lanes are one
  lane; better a hard error than two builders racing in one file.
- **Caps are logged.** `recon` refutes at most two findings per angle; when it skips one it says
  so. A silent cap reads as full coverage, which is a lie.
- **Refuted findings are returned, not hidden.** `deep-review` reports what a naive pass would
  have told you and been wrong about — usually the most useful section.

---

## What a project adds

Nothing is required. The kit works in a repo with no configuration at all.

To get more out of it, run `/port-setup` there once. It investigates the repo and writes a
`CLAUDE.md` describing it — what it is, where things live, the free checks, and **the gated
operations table**, which is the load-bearing part: `harness-runner` trusts it to decide what to
propose, so a command listed there that does not exist is worse than an empty table.

---

## Deliberately left out

- **A hard `deny` on costly commands.** The hook could refuse outright instead of asking. It asks
  on purpose: you should never be *blocked* from running your own eval, only never have one start
  without you. To get the stricter behaviour, change `"ask"` to `"deny"` in the hook.
- **`isolation: 'worktree'`** in `lanes.js` would give each builder its own git worktree. For
  most repos, disjoint file ownership in one tree is cheaper and turns integration into a seam
  problem rather than a merge problem. There is a comment in the script where to flip it.
