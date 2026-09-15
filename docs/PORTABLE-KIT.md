> **Historical.** This is the analysis that led to the current design, kept for its reasoning
> and its list of decisions that must not be undone. It weighs two routes — symlinking into
> `~/.claude/` (Route A) against publishing a plugin (Route B) — and treats the plugin as the
> later step. **The kit went with the plugin as its primary and only architecture**; see the
> [repo README](../README.md). Route A still works and is described accurately, but you do not
> need it. §2.5 (design decisions that must survive) is the part still worth reading.

# One `.claude` for every project — how to stop recreating it

Written 2026-09-15. Nothing here changes code. Every mechanism below was verified against
the files actually on this machine, not recalled from memory.

**The short answer:** the folder you want already exists and it is **`~/.claude/`**, not
`~/workspace/.claude/`. Put the portable half of the kit there once and all ten of your
projects get it — no per-project setup, ever. Then each project keeps one small file
describing itself, and nothing else.

---

## 1 · Why `~/workspace/.claude/` does nothing

Claude Code reads configuration from exactly **two** locations, plus a memory file that walks
up the tree. A `.claude/` folder in a *parent* directory is not one of them.

| Level | Path | Applies to | Holds |
|---|---|---|---|
| **User** | `~/.claude/` | **every project on this machine** | `agents/` `commands/` `skills/` `hooks/` `settings.json` `CLAUDE.md` |
| **Project** | `<project>/.claude/` | that project only | same shapes; **wins** over user level on a name clash |
| Memory | `CLAUDE.md` | cwd **and parent folders** | instructions only — not agents or commands |

So when you `cd ~/workspace/vespa` and start a session:

- `~/.claude/` → **loaded**
- `~/workspace/vespa/.claude/` → **loaded**
- `~/workspace/.claude/` → **ignored** ← this is the one you made

Measured on this machine right now:

```
~/workspace/.claude/      settings.local.json only — and not read by vespa sessions
~/.claude/agents/         EMPTY
~/.claude/commands/       EMPTY
~/.claude/hooks/          EMPTY
~/.claude/skills/         EMPTY
~/workspace/              10 project folders; only vespa has a .claude/
```

That is the whole problem: the kit is 100% project-level, so nine projects have nothing.

The one thing that *does* cascade is `CLAUDE.md`. A `~/workspace/CLAUDE.md` would load for every
project underneath it. Useful for house rules — useless for agents and commands, which is what
you actually want to share.

---

## 2 · Split the kit in two — this is the key move

The kit already has this seam built in, which makes the migration easy:

| Half | What | Where it belongs | How often it changes |
|---|---|---|---|
| **Portable** | Part A doctrine · 10 agents · 7 commands · the gate hook · 3 workflows | **once, in `~/.claude/`** | rarely |
| **Project** | Part B — what this repo is, its build commands, its gated operations | per project, ~60 lines | per project |

You stop copying agents. Each new project needs **one file**: a `.claude/CLAUDE.md` holding only
Part B. That is the irreducible minimum, because no global config can know that *this* repo runs
`make check` and *that* one runs `pnpm test`.

---

## 3 · Route A — symlink from a git repo (do this first)

Best for: working now, on this machine, with everything version-controlled in GitHub.

### Layout

```
~/workspace/claude-kit/          ← a normal git repo, push it to GitHub
├── agents/          10 agents, project-agnostic
├── commands/        7 commands
├── hooks/           gate-costly-runs.py
├── workflows/       recon.js · lanes.js · review.js
├── CLAUDE.md        Part A doctrine ONLY (no Part B)
├── templates/
│   └── PROJECT.md   the Part B skeleton you fill in per repo
└── README.md
```

### Install

```bash
# 1 · create the repo from what vespa already has
mkdir -p ~/workspace/claude-kit && cd ~/workspace/claude-kit
cp -R ~/workspace/vespa/.claude/{agents,commands,hooks,workflows} .
git init && git add -A && git commit -m "portable Claude Code kit"

# 2 · symlink it into the user level — one command per folder, once, forever
ln -sfn ~/workspace/claude-kit/agents    ~/.claude/agents
ln -sfn ~/workspace/claude-kit/commands  ~/.claude/commands
ln -sfn ~/workspace/claude-kit/hooks     ~/.claude/hooks

# 3 · verify
ls -l ~/.claude/agents && ls ~/.claude/agents/
```

Symlinks, not copies, so `git pull` in the kit instantly updates every project. Edit in one
place; there is no second copy to drift.

### Wire the hook globally

`~/.claude/settings.json` already exists and holds your allow-list and `autoMode` — **merge**,
never overwrite. Add only this key:

```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash",
      "hooks": [{ "type": "command",
                  "command": "python3 \"$HOME/.claude/hooks/gate-costly-runs.py\"",
                  "timeout": 5 }] }
  ]
}
```

Note `$HOME`, not `$CLAUDE_PROJECT_DIR` — at user level the hook is not inside any project.

---

## 4 · Route B — publish it as a plugin (the real "package")

Best for: a second machine, a teammate, versioning, clean install/uninstall. A Claude Code
**plugin** is exactly the package you described. Schemas below were read off the official
marketplace already on this disk, so they are accurate.

### Layout

```
claude-kit/                              ← one GitHub repo
├── .claude-plugin/
│   └── marketplace.json                 ← the catalog
└── plugins/
    └── rnd-kit/
        ├── .claude-plugin/plugin.json   ← the manifest
        ├── agents/                      ← auto-discovered, no registration needed
        ├── commands/                    ← auto-discovered
        ├── skills/                      ← auto-discovered
        └── hooks/hooks.json             ← must be declared
```

`.claude-plugin/marketplace.json`:

```json
{
  "name": "raihan-kit",
  "description": "Divide-and-conquer agents, commands and a cost gate for Claude Code",
  "owner": { "name": "Raihan Uddin" },
  "plugins": [
    { "name": "rnd-kit",
      "description": "10 agents, 7 commands, and a PreToolUse gate on costly runs",
      "source": "./plugins/rnd-kit",
      "category": "development" }
  ]
}
```

`plugins/rnd-kit/.claude-plugin/plugin.json`:

```json
{
  "name": "rnd-kit",
  "version": "1.0.0",
  "description": "Divide-and-conquer agents, commands and a cost gate",
  "author": { "name": "Raihan Uddin" }
}
```

`plugins/rnd-kit/hooks/hooks.json` — use `${CLAUDE_PLUGIN_ROOT}`, which resolves wherever the
plugin is installed:

```json
{
  "description": "Ask before anything costly, slow, live or destructive runs",
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [{ "type": "command",
                    "command": "python3 \"${CLAUDE_PLUGIN_ROOT}/hooks/gate-costly-runs.py\"" }] }
    ]
  }
}
```

### Install anywhere

```bash
/plugin marketplace add Raihan2511/claude-kit
/plugin install rnd-kit@raihan-kit
```

Two lines on any machine, any project. `/plugin update` to pull changes.

**Route A and Route B are not exclusive** — keep one repo, symlink it locally for fast iteration,
and tag releases for the plugin path once it settles.

---

## 5 · What each project keeps

One file: `<project>/.claude/CLAUDE.md`, holding Part B only. Copy
`~/workspace/claude-kit/templates/PROJECT.md` and fill in:

```markdown
# <project> — project facts

## What this is
<one paragraph + the component table>

## Where things live
<the directory map>

## Environment facts that bite
<what is installed, what is generated and must not be hand-edited, where secrets live>

## Free checks (run without asking)
| `make test` | pytest, ~1s, no network |   ← the real commands for THIS repo

## Gated operations (ask first, always)
| harness | command | what it measures | preconditions |
<anything costing money, minutes, live state — the harness agent trusts this table>

## Current work
<branch, what is in flight>
```

The gated-operations table is the load-bearing part. `harness-runner` reads it to decide what to
propose, so a command listed there that does not exist is worse than an empty table.

---

## 6 · Gotchas, in the order they will bite you

1. **Project beats user on name clashes.** After going global, **delete** `agents/` and
   `commands/` from `vespa/.claude/` or you will maintain two copies and edit the wrong one.
2. **The hook fires in every repo.** Its `git push`, `make reset` and `docker volume rm` patterns
   are generic and fine everywhere; `eval/*.py` and `make ingest` will simply never match outside
   vespa. If prompts get noisy elsewhere, scope those patterns by checking `$PWD` in the script.
3. **Config loads at session start.** A session already running does not see a kit change until
   it is restarted. You have had two sessions open in vespa at once — expect exactly this.
4. **Never commit secrets to the kit repo.** It holds no `.env`, and Part B must reference
   variable *names* only. The kit repo is the one thing you may push publicly; be sure it stays
   that way.
5. **`vespa/.claude/` is gitignored** (`.gitignore:26`) and `origin` has **two push URLs**
   (`Raihan2511/vespa` and `rezolved/rzlv-website-pipeline`). Keep the kit in its **own** repo so
   a push never sends your config to the company pipeline repo.
6. **Part B goes stale.** vespa's still names branch `feat/ingestion-endpoint` and misses
   `catalog.py`, `confluence.py`, `route.py`, `smalltalk.py`, `people.py`.

---

## 7 · The order to do it

1. Create `~/workspace/claude-kit/`, move the portable half in, `git init`, push to GitHub.
2. Symlink `agents/ commands/ hooks/` into `~/.claude/`.
3. Merge the `hooks` key into `~/.claude/settings.json` (merge — it has your allow-list).
4. Delete `agents/ commands/ hooks/ workflows/` from `vespa/.claude/`, keep `CLAUDE.md` (Part B)
   and `settings.json`.
5. Trim vespa's `CLAUDE.md` to Part B only and refresh it to the current branch.
6. Open any other project, run `/rnd` — it works with zero setup. Add its Part B when you start
   real work there.
7. Later, when it has settled: add the plugin manifests and publish.

Step 6 is the whole point: **a new project needs no `.claude/` at all to get the agents.** It
only needs one if you want project-specific facts.

---
---

# PART 2 · HANDOFF BRIEF — read this if you are the session running in `claude-kit`

Added 2026-09-15. **If you are a Claude session with `~/workspace/claude-kit` as your working
directory, this section is addressed to you.** Everything above describes the reasoning; this
part tells you what exists, what to build, and which design decisions you must not quietly undo.

## 2.1 · The situation

Raihan built a Claude Code configuration inside one project (`vespa`) and it works well. The
problem is it only works *there* — nine other projects under `~/workspace/` have nothing, and
copying `.claude/` into each one means maintaining ten drifting copies.

**The goal: one kit, installed once, available in every project on the machine and on any future
machine — with each project contributing only a small file describing itself.**

`claude-kit` (this repo, `git@github.com:Raihan2511/claude-kit.git`) is where the portable half
now lives. At the time of writing it contains only `.gitignore` and `README.md` on one commit.

## 2.2 · Where the source kit is, and how to read it

**Source of truth: `/Users/raihan/workspace/vespa/.claude/` — 26 files.** That path is outside
this repo, so you probably cannot read it by default. Ask Raihan to restart with:

```bash
claude --add-dir /Users/raihan/workspace/vespa/.claude
```

or have him copy the tree in first. **Do not rewrite these files from scratch from this
description** — they are the product of several careful iterations, and a regeneration will be a
worse copy that merely looks similar. Copy the real files, then adapt.

## 2.3 · Complete manifest — what to take, split, or leave

| File | Lines | Verdict |
|---|---|---|
| `CLAUDE.md` | 273 | **SPLIT** — see §2.4. Lines 1–146 portable, 147–273 vespa-only |
| `agents/*.md` (10) | 32–86 | **TAKE AS-IS** — deliberately project-agnostic |
| `commands/*.md` (7) | 53–116 | **TAKE AS-IS** |
| `workflows/*.js` (3) | 175–210 | **TAKE AS-IS** |
| `hooks/gate-costly-runs.py` | 102 | **TAKE, then generalise** — see §2.6 |
| `README.md` | 184 | **TAKE** — becomes this repo's README (it documents the kit itself) |
| `PORTABLE-KIT.md` | this file | **TAKE** — the migration plan |
| `settings.json` | 73 | **PARTIAL** — see §2.7 |
| `settings.local.json` | 35 | **LEAVE** — machine- and project-specific |

The ten agents: `clarifier` `diagnostician` `scout-repo` `scout-web` `architect` `builder`
`integrator` `refuter` `harness-runner` `scribe`.
The seven commands: `/rnd` `/recon` `/lanes` `/clarify` `/diagnose` `/harness` `/port-setup`.

## 2.4 · The CLAUDE.md split — exact line numbers

| Lines | Section | Goes to |
|---|---|---|
| 1–11 | header explaining the two-part structure | keep, reword for the kit |
| **12–146** | **PART A · DOCTRINE** — A0 understand · A1 divide · A2 evidence · A3 refute · A4 measured · A5 **the testing gate** · A6 scope · A7 delegation | **`claude-kit/CLAUDE.md`** — verbatim |
| **147–273** | **PART B · THIS PROJECT** — B1 what it is · B2 layout · B3 environment · B4 free checks · B5 **gated operations** · B6 doc style · B7 current work | **stays in vespa**; becomes `templates/PROJECT.md` here with the vespa content replaced by placeholders |

Part A must transfer **byte-identical**. Every agent was written against its wording — several
reference "§A5" by name.

## 2.5 · Design decisions that must survive the port

A porting session that tidies these away will produce something that looks the same and behaves
worse. Each exists for a reason:

1. **Agents never hardcode project facts.** They read them from Part B. This is the single
   property that makes them portable — if you ever feel the urge to edit an agent for a specific
   project, the fact belongs in that project's Part B instead.
2. **The harness gate is four independent layers**, not a polite request: (a) doctrine §A5,
   (b) the literal token `RUN-HARNESS: CONFIRMED` that `harness-runner` cannot write for itself,
   (c) `ask` entries in settings, (d) the `PreToolUse` hook. Each covers a weakness in the others.
   Keep all four.
3. **`harness-runner` defaults to PREPARE-ONLY.** Its *description* says so, so even an agent
   that picks it without reading the body gets a readiness report, never a run.
4. **The hook returns `ask`, never `deny`.** Raihan must never be *blocked* from running his own
   eval — only never surprised by one starting itself.
5. **The hook fails silent.** Malformed input → print nothing, exit 0, let normal permissions
   apply. A safety hook that wedges every Bash call is worse than no hook. Tested against five
   bad-input cases.
6. **Subagents cannot talk to the user.** This shapes two designs: `harness-runner` returns
   `GATE: awaiting user confirmation` for the main session to act on, and `clarifier` emits
   questions pre-shaped for `AskUserQuestion` (≤4 questions, 2–4 concrete options, recommended
   first, each with a default so nothing blocks).
7. **`lanes.js` refuses to start when two lanes claim the same file** — it throws rather than
   racing two builders in one file. That check is the whole point of the workflow.
8. **Workflows use `pipeline()`, not `parallel()` + barrier**, so a finding is verified the
   moment its scout lands. Barriers appear only where a stage genuinely needs everything at once.
9. **Refuted findings are returned, not hidden**, and **caps are logged** — a silent cap reads as
   full coverage, which is a lie.
10. **`refuter` defaults to `refuted: true`** when it cannot positively establish a claim.
    Absence of evidence is refutation, not a stalemate.

## 2.6 · Generalising the hook

`hooks/gate-costly-runs.py` matches the whole Bash command string with regexes, so `cd … &&`,
`bash -c "…"`, env prefixes and pipes cannot slip past a prefix pattern. Verified 16/16 against
nine evasion forms and seven free checks.

Its patterns are currently a mix:

- **Universal — keep**: `git push`, `gh pr create`, `docker volume rm`, `docker compose run`
- **Vespa-specific — harmless elsewhere** (they simply never match): `eval/*.py`,
  `make ingest|reingest|purge|site|scrape|load|deploy`, `make reset|clean`, `purge_first: true`
- **Universal additions worth having** once it is global: `pytest` with no path filter,
  `npm|pnpm|yarn test`, `terraform apply`, `kubectl apply|delete`, `helm upgrade|install`

Best shape for a shared kit: keep the universal list in the script, and let each project extend
it via an optional `.claude/gated-patterns.txt` the script reads if present. Do not make the
script fail when that file is absent.

## 2.7 · `settings.json` — what survives

Drop every absolute vespa path (`Read(//Users/raihan/workspace/vespa/**)`) and the
vespa-only `make` targets. Keep the **shape**: `allow` for cheap read-only inspection, `ask` for
anything costly or outward-facing, `deny` for the unrecoverable (`git push --force`,
`git reset --hard`, reading `.env`).

At user level the hook path changes — use `$HOME/.claude/hooks/…`, not `$CLAUDE_PROJECT_DIR`.
As a plugin, use `${CLAUDE_PLUGIN_ROOT}/hooks/…`.

**Raihan's `~/.claude/settings.json` already exists** with a large allow-list and his `autoMode`
config. **Merge into it — never overwrite it.**

## 2.8 · Target layout for this repo

```
claude-kit/
├── CLAUDE.md                     Part A doctrine only (vespa CLAUDE.md lines 1–146)
├── README.md                     from vespa/.claude/README.md
├── PORTABLE-KIT.md               this document
├── agents/                       10 files, verbatim
├── commands/                     7 files, verbatim
├── workflows/                    3 files, verbatim
├── hooks/gate-costly-runs.py     generalised per §2.6
├── templates/PROJECT.md          Part B skeleton with placeholders
└── .claude-plugin/               optional, for the plugin route (§4)
```

Install locally by symlinking `agents/ commands/ hooks/` into `~/.claude/` — symlinks, not
copies, so `git pull` updates every project with no second copy to drift.

## 2.9 · When you are done, verify — do not assume

- `ls -l ~/.claude/agents` resolves to this repo, and lists 10 agents
- a session opened in a *different* project (`~/workspace/leon`, say) offers `/rnd` with no
  `.claude/` of its own — **this is the whole point of the exercise**
- the hook still asks on `cd /x && python3 eval/smoke.py` and stays silent on `make test`:
  ```bash
  printf '{"tool_name":"Bash","tool_input":{"command":"cd /x && python3 eval/smoke.py"}}' \
    | python3 hooks/gate-costly-runs.py     # expect permissionDecision: ask
  printf '{"tool_name":"Bash","tool_input":{"command":"make test"}}' \
    | python3 hooks/gate-costly-runs.py     # expect no output
  ```
- `grep -r "workspace/vespa" .` returns nothing — no absolute path leaked into the portable kit
- Part A in `CLAUDE.md` is byte-identical to vespa's lines 12–146
- **no secrets**: this repo may become public; it must contain no `.env`, no keys, and reference
  environment variables by name only

## 2.10 · Two constraints from Raihan, standing

- **Do not commit or open PRs unless asked.** He has said this explicitly and more than once.
- **Keep the kit in its own repo.** `vespa`'s `origin` has *two* push URLs — `Raihan2511/vespa`
  **and** `rezolved/rzlv-website-pipeline` — so config pushed from there reaches a company repo.
  `claude-kit` has a single clean remote. Keep it that way.
