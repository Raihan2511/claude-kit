# <PROJECT NAME>

Project facts for Claude Code. The portable doctrine — how work is done — arrives from the
`rnd-kit` plugin and is not repeated here. This file holds only what is true of *this repo*,
because no installed plugin can know that this one runs `make check` and the next one runs
`pnpm test`.

Agents read these facts instead of hardcoding them. If you ever want to edit an agent for this
project, the fact belongs here instead.

## 1. What this is

<One paragraph: what the system does, for whom, and the shape of it.>

| Component | What it does | Where |
|---|---|---|
| <name> | <one line> | `<path>` |

## 2. Where things live

```
<annotated directory map — what each part is for, not just its name>
```

## 3. Environment facts that bite

- **Toolchain:** <what must be installed; what version; what is commonly missing>
- **Generated files:** <what is generated and must never be hand-edited>
- **Secrets:** <where they live, by variable NAME only — never paste a value into this file>
- **Gotchas:** <the thing that wastes an hour if you do not know it>

## 4. Free checks — run these without asking

Cheap, local, read-only, no network and no state. Doctrine §A5 lets these run freely.

| Command | What it does | Typical time |
|---|---|---|
| `<make test>` | <unit suite, fakes external services> | <~1s> |
| `<make lint>` | <linter> | <~2s> |

House style a reviewer would enforce: <line length, typing, import order, test layout>.

## 5. Gated operations — ask first, always

**This is the load-bearing table.** `harness-runner` trusts it to decide what to propose, so a
command listed here that does not exist is worse than an empty table. Verify each one before
writing it down.

| Harness | Command | What it measures | Cost / duration | Preconditions |
|---|---|---|---|---|
| <name> | `<exact command>` | <what it tells you> | <$ and minutes> | <what must be up first> |

Destructive — never run unprompted, not even to unblock yourself:

- `<command>` — <what is lost>

Project-specific patterns for the gate hook go in `.claude/gated-patterns.txt`; see the
template in the plugin.

## 6. Documentation style

<The voice of the existing docs, read from two or three of them — not invented.>

## 7. Current work

- **Branch:** <branch>
- **In flight:** <what is half-done>
- **Known diagnosis:** <the bug currently being chased, and the evidence so far>
