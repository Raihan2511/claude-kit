# claude-kit

A Claude Code plugin marketplace. One package, one version, one source of truth — installed
once, available in every project on the machine, and in every project on anyone else's machine.

```
        github.com/Raihan2511/claude-kit
                      │
                 rnd-kit plugin
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
     project A    project B    project C
```

No `.claude/` folder to copy. No per-project setup. No ten drifting copies to maintain.

## Install — once per machine

**You do not clone this repo.** Claude Code fetches it for you. Run these inside any Claude Code
session, from any directory:

```
/plugin marketplace add Raihan2511/claude-kit
/plugin install rnd-kit@raihan-kit
```

Or from a terminal, without opening a session:

```bash
claude plugin marketplace add Raihan2511/claude-kit
claude plugin install rnd-kit@raihan-kit
```

`Raihan2511/claude-kit` is a GitHub `owner/repo` — the CLI clones it into `~/.claude/plugins/`
and keeps it there. It installs at **user scope**, meaning every project on this machine, not
just the one you happened to be in.

**Check it worked:**

```bash
claude plugin list          # → rnd-kit@raihan-kit · Scope: user · ✔ enabled
claude plugin details rnd-kit   # → 13 agents, 9 commands, 2 hooks
```

Inside a session, `/help` lists every command with the plugin it came from, so you can see
which ones are the kit's.

To update later: `claude plugin marketplace update raihan-kit`. To remove it:
`claude plugin uninstall rnd-kit`.

---

## Using it in a project

Once installed, **it is already on in every project** — including repos that do not exist yet,
and repos you clone from GitHub tomorrow. There is nothing to add to them, no `.claude/` folder
to create, and nothing to keep in sync.

```
   install once ─────────────────────────────────────────┐
                                                         │
   ~/work/api        ~/work/web      ~/dev/someones-repo │
        │                 │                   │          │
        └─────────────────┴───────────────────┴──────────┘
              all get 13 agents, 9 commands, the
              working agreement, and the safety gates
```

### You just cloned someone's repo from GitHub

The kit is already active there. The first thing you usually want is to get the thing running:

```bash
git clone https://github.com/someone/their-project
cd their-project
claude
```

```
/setup
```

`/setup` reads their CI config first (the setup that provably works on a clean machine), checks
what is actually installed on yours, and comes back with **every way the project can come up** —
containers, local toolchain, devcontainer — with one recommendation and the reason for it. It
runs nothing until you pick. It never repairs anything on its own: a failed step comes back with
the cause, the fix, and whether it even needs fixing.

Then just work — `/rnd`, `/recon`, `/diagnose` all work immediately.

### You just created a new local repo

Nothing to do.

```bash
mkdir my-thing && cd my-thing && git init
claude
```

`/rnd` works in the first session. A project needs **zero** configuration to use the kit.

### A repo you are going to live in

When you want the agents to know the project rather than rediscover it every session, run this
once:

```
/port-setup
```

It investigates the repo and writes a `CLAUDE.md` describing it — what it is, where things live,
its free checks, and the **gated-operations table** that `harness-runner` trusts to decide what
to propose. That file is the only thing a project ever contributes.

**`/setup` and `/port-setup` are not the same thing**, despite the names:

| | Gets *the project* running for a human | Tells *the kit* what the project is |
|---|---|---|
| **`/setup`** | ✔ toolchain, containers, env, frontend | |
| **`/port-setup`** | | ✔ writes that repo's `CLAUDE.md` |

### Two things worth knowing

**A project's own `.claude/` can collide with the plugin.** If a repo already has
`.claude/commands/rnd.md`, that is a second `/rnd` competing with the plugin's. `/help` shows
which plugin each command came from, so you can tell them apart. Rather than depending on which
one wins, delete the project's duplicate and let the plugin provide it — keep only `CLAUDE.md`,
which describes the project and never collides.

**Config is read at session start.** Installing, updating, or editing the kit does not affect a
session that is already open — restart it.

### Another machine, or a teammate

The same two install lines. Nothing is copied by hand, and there is no second version to drift.

---

## What you get

**[`rnd-kit`](plugins/rnd-kit/)** — a divide-and-conquer working kit:

- **13 agents** — clarifier, diagnostician, scout-repo, scout-web, architect, builder,
  integrator, refuter, setup-runner, harness-runner, review-gate, committer, scribe
- **9 commands** — `/rnd` `/recon` `/lanes` `/clarify` `/diagnose` `/setup` `/harness`
  `/commit` `/port-setup`
- **3 workflows** — deterministic multi-agent orchestration for recon, parallel build lanes,
  and deep review
- **A working agreement** loaded into every session — evidence over recall, refute before you
  report, measured not estimated, scope discipline
- **A four-layer gate** so no eval, benchmark, deploy, commit or push ever happens on its own
  initiative — and changes are committed as a sequence of small, grouped commits, each message
  capped at 130 words

Full documentation: **[plugins/rnd-kit/README.md](plugins/rnd-kit/README.md)**.
How the pieces fit together, with diagrams: **[docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)**.

## The model

| Layer | Holds | Scope |
|---|---|---|
| **This plugin** | agents · commands · workflows · hooks · doctrine | every project, every machine |
| **Project `CLAUDE.md`** | what *this* repo is: its build commands, its costly operations | one project |
| **`~/.claude/settings.json`** | your permissions, your machine | you |

The split is the point. No installed plugin can know that one repo runs `make check` and the
next runs `pnpm test` — so agents never hardcode a project fact, they read it from the project.
That one property is what lets a single installed copy work everywhere.

A project needs **no** configuration to use the kit — see [Using it in a project](#using-it-in-a-project).

## Developing on it

**Only if you are changing the kit itself** — you do not need this to use it.

Clone the repo, then point the marketplace at your working copy instead of GitHub, and edits take
effect on the next session start:

```bash
git clone git@github.com:Raihan2511/claude-kit.git ~/workspace/claude-kit
claude plugin marketplace add ~/workspace/claude-kit
claude plugin install rnd-kit@raihan-kit
```

Config is read at session start — a session already running will not see a change until it is
restarted.

The hooks are runnable by hand, which is how their behaviour gets checked:

```bash
cd plugins/rnd-kit
printf '{"tool_name":"Bash","tool_input":{"command":"cd /x && terraform apply"}}' \
  | python3 hooks/gate-costly-runs.py     # → permissionDecision: ask
printf '{"tool_name":"Bash","tool_input":{"command":"make test"}}' \
  | python3 hooks/gate-costly-runs.py     # → nothing
printf '{"hook_event_name":"SessionStart","source":"startup"}' \
  | python3 hooks/inject-doctrine.py      # → the doctrine as additionalContext
```

## Background

[`docs/PORTABLE-KIT.md`](docs/PORTABLE-KIT.md) is the original migration analysis — how Claude
Code actually resolves configuration, why a `.claude/` in a parent directory does nothing, and
the design decisions behind the kit that must not be quietly undone.

## License

MIT.
