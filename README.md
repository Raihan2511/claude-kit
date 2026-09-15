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

## Install

```bash
/plugin marketplace add Raihan2511/claude-kit
/plugin install rnd-kit@raihan-kit
```

Then open any project and run `/rnd`. That is the whole setup.

To update later: `/plugin marketplace update raihan-kit`. To remove it:
`/plugin uninstall rnd-kit`.

## What you get

**[`rnd-kit`](plugins/rnd-kit/)** — a divide-and-conquer working kit:

- **11 agents** — clarifier, diagnostician, scout-repo, scout-web, architect, builder,
  integrator, refuter, harness-runner, committer, scribe
- **8 commands** — `/rnd` `/recon` `/lanes` `/clarify` `/diagnose` `/harness` `/commit`
  `/port-setup`
- **3 workflows** — deterministic multi-agent orchestration for recon, parallel build lanes,
  and deep review
- **A working agreement** loaded into every session — evidence over recall, refute before you
  report, measured not estimated, scope discipline
- **A four-layer gate** so no eval, benchmark, deploy, commit or push ever happens on its own
  initiative — and changes are committed as a sequence of small, grouped commits, each message
  capped at 130 words

Full documentation: **[plugins/rnd-kit/README.md](plugins/rnd-kit/README.md)**.

## The model

| Layer | Holds | Scope |
|---|---|---|
| **This plugin** | agents · commands · workflows · hooks · doctrine | every project, every machine |
| **Project `CLAUDE.md`** | what *this* repo is: its build commands, its costly operations | one project |
| **`~/.claude/settings.json`** | your permissions, your machine | you |

The split is the point. No installed plugin can know that one repo runs `make check` and the
next runs `pnpm test` — so agents never hardcode a project fact, they read it from the project.
That one property is what lets a single installed copy work everywhere.

A project needs **no** configuration to use the kit. When you want it to know more, run
`/port-setup` there once and it writes that repo's `CLAUDE.md` from the repo's own evidence.

## Developing on it

Point the marketplace at your working copy instead of GitHub, and edits take effect on the next
session start:

```bash
/plugin marketplace add ~/workspace/claude-kit
/plugin install rnd-kit@raihan-kit
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
