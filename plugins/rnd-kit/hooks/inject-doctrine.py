#!/usr/bin/env python3
"""SessionStart hook: load the portable working agreement into every session.

A plugin can ship agents, commands, skills and hooks — it cannot ship a CLAUDE.md,
because memory files are read from the project tree and the user directory, not from
an installed plugin. So the doctrine travels as a SessionStart hook instead: it prints
`additionalContext`, which the session reads exactly as it would a memory file.

That is what makes this kit work with *no* `.claude/` in the project at all. The
project's own CLAUDE.md, when it has one, still loads normally and still wins — this
adds the portable half underneath it, never replacing it.

Contract (SessionStart):
  stdin  {"hook_event_name": "SessionStart", "source": "startup"|"resume"|"clear", ...}
  stdout {"hookSpecificOutput": {"hookEventName": "SessionStart",
                                 "additionalContext": "..."}}
Exit 0 always. Printing nothing means "no opinion" — the session proceeds unchanged.
A missing or unreadable doctrine file is silent: a kit that wedges every session start
is worse than a kit with no doctrine.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# ${CLAUDE_PLUGIN_ROOT} is set by Claude Code wherever the plugin happens to be
# installed. Falling back to this file's own parent keeps the hook runnable by hand,
# which is how its output gets checked.
PLUGIN_ROOT = Path(os.environ.get("CLAUDE_PLUGIN_ROOT") or Path(__file__).resolve().parent.parent)
DOCTRINE = PLUGIN_ROOT / "doctrine" / "DOCTRINE.md"


def main() -> int:
    try:
        json.load(sys.stdin)
    except Exception:  # noqa: BLE001 — an unparseable frame is not ours to repair
        return 0

    try:
        text = DOCTRINE.read_text(encoding="utf-8").strip()
    except OSError:
        return 0

    if not text:
        return 0

    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": (
                    "The following working agreement is supplied by the rnd-kit plugin and "
                    "applies to this session. Where this project has its own CLAUDE.md, that "
                    "file describes *this repo* and takes precedence on any conflict.\n\n"
                    + text
                ),
            }
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
