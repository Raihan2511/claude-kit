---
description: Review what changed, split it into a sequence of small coherent commits with messages of at most 130 words each, show you the plan, and commit step by step only after you say yes — pushing once at the end if you separately ask for it.
argument-hint: [what the change was about, or "one commit" to keep it together]
---

# /commit — propose a sequence, then wait

Context: **$ARGUMENTS** — optional. The diff is the source of truth; this is only a hint about
intent. If it says *one commit*, *squash*, or names a grouping, that is an instruction — pass it
straight to the committer.

Nothing is staged, committed or pushed until the user answers.

## 1 · Prepare

Invoke `committer` **with no confirmation token**. It reads the diff, learns the repo's commit
voice from `git log`, checks for secrets and generated files, groups every changed file into a
commit, and returns a `COMMIT SEQUENCE` ending in `GATE: awaiting user confirmation`. It writes
nothing.

Relay any exclusion or risk it flags **before** asking anything else. A secret in the diff is not
a footnote.

## 2 · ⛔ Ask

Show the sequence: the branch, the file count, and each step's subject with its file count. Keep
the full messages visible — the user is approving wording, not just a count.

```
3 commits from 33 files on `main`:
  [1/3] Add plugin manifests and marketplace catalog     4 files
  [2/3] Port agents, commands and workflows from vespa   21 files
  [3/3] Generalise the cost gate and add the doctrine    8 files
```

Then ask with `AskUserQuestion`:

> **Commit this sequence?** <k> commits · <n> files · branch `<branch>`

Offer four options:

- **Commit the sequence** — run all steps locally, do not push
- **Commit and push** — only when a remote exists; name remote and branch in the option text
- **Change the grouping** — they want different splits, a different order, or one commit instead
  of many. Take their grouping and re-plan; do not defend yours
- **Not yet** — stop cleanly, leave the tree untouched

A push is a separate decision from a commit. Never fold them into one "yes".

## 3 · Execute

Re-invoke `committer` with the tokens the answer earned:

| Answer | Tokens in the prompt |
|---|---|
| Commit the sequence | `COMMIT: CONFIRMED` |
| Commit and push | `COMMIT: CONFIRMED` and `PUSH: CONFIRMED` |
| Change the grouping | none — re-plan first, then ask again |
| Not yet | none — do not invoke it again |

Never write a token the user did not give you. "Looks good", "ship it", a thumbs-up, silence, or
the fact that they ran this command are **not** `PUSH: CONFIRMED`.

## 4 · Report

Relay the `SEQUENCE REPORT` — each sha and subject in order, whether it was pushed, and anything
left uncommitted. If the committer stopped partway, say which steps landed and which did not;
a half-run sequence is a fact the user needs, not something to smooth over.

If it stopped because the remote has more than one push URL, or because the branch is the default
branch, relay that and ask again. It is stopping for a reason.

---

**Two rules this command exists to enforce.** One commit is one reason to change — thirty files
in one commit cannot be reviewed, bisected, or partially reverted. And each message is capped at
**130 words**, subject and body together, trailers excluded: the diff says what changed, the
message says why. If a draft comes back longer, that is evidence the commit holds two concerns —
send it back to be split, do not pad the user's screen with it.
