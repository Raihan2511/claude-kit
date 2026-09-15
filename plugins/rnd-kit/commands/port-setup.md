---
description: Set up the current (or a named) repo to work with the rnd-kit plugin — investigate it, then write its CLAUDE.md, its gate patterns, and its settings permissions from real evidence.
argument-hint: [path to the repo — defaults to here]
---

# /port-setup — teach the kit what this project is

Target: **$ARGUMENTS** — if empty, the current repo.

The kit itself is already installed as a plugin: the agents, commands, workflows, doctrine and
gate are present in every project with no setup at all. **Nothing needs copying.** What is
missing is the only thing a plugin cannot know — what *this* repo is.

So this command produces at most three small files in the target:

| File | Purpose | Required? |
|---|---|---|
| `CLAUDE.md` | the project facts agents read | yes — this is the whole job |
| `.claude/gated-patterns.txt` | extra gate rules for this repo's costly commands | only if it has any |
| `.claude/settings.json` | `allow` / `ask` / `deny` for this repo's commands | recommended |

**Never overwrite an existing `CLAUDE.md`.** If one is there, read it, show the user what you
would add or change, and ask before writing.

## 1 · Investigate, do not guess

Read the repo before writing a word: README, the build file (Makefile / `package.json` /
`pyproject.toml` / `Taskfile`), CI config, the test setup, the dependency manifest, the compose
file if there is one. Launch `scout-repo` if the repo is large enough that reading it serially
would be slow.

Every command you are about to write down, **verify it exists**. Run the free ones. For the
costly ones check only that the entry point is there — the file exists, or `--help` responds.
A gated-operations table naming a command that does not run is worse than an empty one:
`harness-runner` trusts that table.

## 2 · Write `CLAUDE.md`

Start from `${CLAUDE_PLUGIN_ROOT}/templates/PROJECT-CLAUDE.md` and fill every section:

| Section | What to establish |
|---|---|
| 1 What this is | one paragraph, plus the component table |
| 2 Where things live | the directory map, annotated with what each part does |
| 3 Environment facts that bite | toolchain, what is generated and must not be hand-edited, where secrets live **by variable name only** |
| 4 Free checks | the exact lint / format / typecheck / unit-test commands, plus the house style a reviewer would enforce |
| 5 Gated operations | **the important one** — everything that costs money, takes minutes, hits a live service or mutates state, with cost and preconditions; then the destructive list |
| 6 Documentation style | the voice of the existing docs, read from two or three of them |
| 7 Current work | branch, what is in flight, the known diagnosis |

Do **not** copy the doctrine into this file. It arrives from the plugin on every session start;
duplicating it creates a second copy that will drift.

Anything you could not establish stays in the file as an explicit gap for the user to fill —
never as a plausible-looking guess.

## 3 · Write the gate patterns, if this repo needs them

The plugin's hook already gates what is costly everywhere — `git push`, `terraform apply`,
`docker volume rm`, `make deploy`, and so on. Add a rule only for something specific to this
repo: its ingest targets, its eval entry points, its long e2e suite.

Copy `${CLAUDE_PLUGIN_ROOT}/templates/gated-patterns.txt` to `.claude/gated-patterns.txt` and
replace the examples. If the repo has nothing beyond the universal list, **do not create the
file** — an empty rule file is noise.

## 4 · Write `settings.json` permissions

Re-derive from the repo's actual commands, never from another project's file:

- **allow** — read-only inspection and the free checks from section 4. Cheap and safe, so they
  never prompt.
- **ask** — anything that costs money, mutates state, or leaves the machine. Belt and braces
  behind the doctrine's gate.
- **deny** — the genuinely unrecoverable: wiping volumes or state, force-pushing, hard resets,
  and reading the file that holds live secrets.

Use relative paths where the setting allows it, so the file survives being cloned elsewhere.

## 5 · Verify

- the commands in section 4 run, and the entry points in section 5 exist
- `grep` the new files for absolute paths and for anything that looks like a secret value
- the gate behaves: a costly command from section 5 produces `permissionDecision: ask`, and a
  free check from section 4 produces nothing —
  ```bash
  printf '{"tool_name":"Bash","tool_input":{"command":"<a gated command>"}}' \
    | python3 "${CLAUDE_PLUGIN_ROOT}/hooks/gate-costly-runs.py"
  ```

Report: what you established and from which evidence, what you wrote, and every gap you left
marked in the file for the user to fill.
