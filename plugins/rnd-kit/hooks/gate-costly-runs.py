#!/usr/bin/env python3
"""PreToolUse gate: nothing costly, slow, live or destructive runs without the user saying so.

The doctrine in §A5 tells agents not to start eval harnesses on their own initiative, and
the `ask` list in settings.json puts the obvious commands behind a prompt. Both are real
layers, and both have the same weakness: the first depends on a model reading its
instructions, the second on a command matching a *prefix*. `cd /repo && python3
eval/full_harness.py` defeats a prefix pattern; a determined-but-helpful agent can talk
itself past a paragraph of prose.

This hook reads the actual command string and matches anywhere inside it, so wrappers,
`cd &&` chains, pipes, subshells and env prefixes are all caught. It returns "ask", never
"deny": the user stays able to run anything, they just cannot be surprised by it.

Because the kit is installed once and runs in every repo, the built-in list is deliberately
limited to what is costly or irreversible *everywhere*. A project adds its own — its ingest
targets, its deploy make rules, its harness entry points — in an optional file:

    <project>/.claude/gated-patterns.txt

one rule per line, `regex` optionally followed by `# reason`. Blank lines and full-line
comments are ignored. The file is optional; a project without one loses nothing.

Order of decision: project rules, then the free-checks fast path, then the built-in list.
Project rules go first on purpose — a repo that explicitly names a command knows more about
it than this script's generic allow-list does.

Contract (PreToolUse):
  stdin  {"tool_name": "Bash", "tool_input": {"command": "..."}}
  stdout {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                 "permissionDecision": "ask"|"allow",
                                 "permissionDecisionReason": "..."}}
Exit 0 always. Emitting nothing means "no opinion" — the normal permission rules apply.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# Each pattern is (regex, why-it-is-gated). Written against the whole command string,
# case-insensitive, so position in the line does not matter. Everything here is costly,
# slow, outward-facing or destructive in *any* repo — project-specific rules belong in
# .claude/gated-patterns.txt instead.
GATED: list[tuple[str, str]] = [
    # --- eval harnesses and benchmarks: real API spend, minutes -----------------------
    (r"\b(eval|evals|benchmark|benchmarks|bench)/[\w./-]+\.(py|js|ts|sh)\b",
     "runs an eval or benchmark harness — likely real API spend and minutes"),
    (r"docker\s+compose\s+run\b[^\n]*\b(eval|bench|benchmark|ingest\w*)\b",
     "runs a one-off container job — live services, real spend"),
    # --- anything that mutates an index, a database or a deployment --------------------
    (r"\bmake\s+(ingest|reingest|purge|deploy|migrate|seed|publish|release)\b",
     "mutates persistent state or redeploys"),
    (r'"?purge_first"?\s*:\s*true', "purges before writing"),
    (r"\balembic\s+(upgrade|downgrade)\b", "runs a database migration"),
    (r"\bterraform\s+(apply|destroy)\b", "changes real infrastructure"),
    (r"\bkubectl\s+(apply|delete|rollout|scale)\b", "changes a live cluster"),
    (r"\bhelm\s+(install|upgrade|uninstall|rollback)\b", "changes a live release"),
    # --- destructive / expensive infrastructure ---------------------------------------
    (r"\bmake\s+(reset|clean|nuke)\b", "destroys local state and build artifacts"),
    (r"docker\s+volume\s+rm\b", "deletes a Docker volume — its data is gone"),
    (r"docker\s+compose\s+down\b[^\n]*(-v|--volumes)\b", "tears down and deletes volumes"),
    (r"docker\s+(system|image|builder)\s+prune\b", "deletes cached images and layers"),
    (r"\bmake\s+(up|build)\b", "starts or rebuilds containers — slow, and takes ports"),
    (r"\brm\s+-[a-z]*[rR][a-z]*f\b", "recursive force delete"),
    # --- writing to git history: see doctrine A8, only `committer` may do this ---------
    (r"\bgit\s+commit\b", "records a commit — only with the user's go-ahead"),
    (r"\bgit\s+(rebase|filter-branch|cherry-pick)\b", "rewrites history"),
    (r"\bgit\s+reset\s+--hard\b", "discards uncommitted work irrecoverably"),
    (r"\bgit\s+clean\b", "deletes untracked files irrecoverably"),
    # --- outward-facing: leaves the machine, or is hard to walk back -------------------
    (r"\bgit\s+push\b", "publishes commits"),
    (r"\bgh\s+(pr\s+create|release\s+create|workflow\s+run)\b", "opens a PR, release or CI run"),
    (r"\b(npm|pnpm|yarn)\s+publish\b", "publishes a package"),
    (r"\bpip\s+install\b[^\n]*\bgit\+", "installs code straight from a remote repo"),
]

COMPILED = [(re.compile(p, re.I), why) for p, why in GATED]

# Cheap, local, read-only work must never be slowed down by this hook. These win over the
# built-in list: reading the repo, inspecting git, and the usual fast check targets.
#
# The fast path is anchored at the start of the line, so it only ever describes the FIRST
# command. It is therefore applied only to a single simple command — `make check && gh pr
# create --fill` must not be waved through because its first word is cheap. A chained
# command falls through to the gated scan, which matches anywhere in the string.
ALLOWED = re.compile(
    r"^\s*(make\s+(test|tests|lint|fmt|format|types|typecheck|check|cov|status|help|logs)\b"
    r"|git\s+(status|diff|log|show|branch|remote|stash\s+list)\b"
    r"|docker\s+compose\s+(ps|config|logs)\b"
    r"|(ls|cat|head|tail|wc|rg|grep|find|which|file|tree|pwd|env)\b"
    r"|gh\s+(pr\s+(view|diff|list)|issue\s+view|search|api)\b"
    r"|(ruff|black|isort|mypy|flake8|eslint|prettier|tsc|gofmt|cargo\s+(check|clippy|fmt))\b)",
    re.I,
)

COMMENT = re.compile(r"\s+#\s*(.*)$")

# Shell metacharacters that mean "and then something else": &&, ||, ;, |, a
# newline, a subshell or a backtick. Any of these and the command is not simple.
CHAINED = re.compile(r"(&&|\|\||[;|\n`]|\$\()")


def project_rules() -> list[tuple[re.Pattern[str], str]]:
    """Read <project>/.claude/gated-patterns.txt, if it exists. Never raises."""
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    try:
        lines = (Path(root) / ".claude" / "gated-patterns.txt").read_text(encoding="utf-8").splitlines()
    except OSError:
        return []

    rules: list[tuple[re.Pattern[str], str]] = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = COMMENT.search(line)
        reason = match.group(1).strip() if match else "listed in .claude/gated-patterns.txt"
        pattern = line[: match.start()] if match else line
        try:
            rules.append((re.compile(pattern.strip(), re.I), reason))
        except re.error:
            # A typo in one project's rule file must not disable the gate for the rest.
            continue
    return rules


def ask(why: str) -> None:
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": (
                    f"GATED: {why}.\n"
                    "The working agreement (§A5) requires your explicit go-ahead for anything "
                    "costly, slow, live or destructive. Approve only if you meant to start "
                    "this now."
                ),
            }
        },
        sys.stdout,
    )


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:  # noqa: BLE001 — unparseable input is not this hook's problem to solve
        # Say nothing and let the normal permission rules apply. Failing loud here
        # would block every Bash call in the session over a malformed frame.
        return 0

    if payload.get("tool_name") != "Bash":
        return 0

    command = (payload.get("tool_input") or {}).get("command") or ""
    if not command:
        return 0

    for pattern, why in project_rules():
        if pattern.search(command):
            ask(why)
            return 0

    if not CHAINED.search(command) and ALLOWED.match(command):
        return 0

    for pattern, why in COMPILED:
        if pattern.search(command):
            ask(why)
            return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
