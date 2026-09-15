export const meta = {
  name: 'deep-review',
  description: 'Review a diff across independent dimensions, then try to refute every finding before reporting',
  whenToUse:
    'A change worth reviewing harder than a single pass — several dimensions swept ' +
    'concurrently, each finding attacked by an independent skeptic so only survivors are ' +
    'reported. Pass {target} (a diff spec like "HEAD~1", a branch, or paths) or nothing for the ' +
    'working tree. Read-only: it reports, it does not fix.',
  phases: [
    { title: 'Find', detail: 'one reviewer per dimension' },
    { title: 'Refute', detail: 'independent skeptics attack each finding' },
  ],
}

// ---------------------------------------------------------------------------
// Precision over recall. A review that reports ten findings of which six are
// wrong is worse than one that reports four real ones: the reader stops
// trusting the list. So every finding must survive a skeptic whose job is to
// kill it, and unanimity is required — one credible refutation drops it.
// ---------------------------------------------------------------------------

const target = args?.target ?? 'the uncommitted working tree'
const REFUTERS_PER_FINDING = 2

const READONLY =
  'You are read-only: fix nothing, edit nothing. Do not start an eval harness, benchmark or ' +
  'live-service call — propose it instead. Report findings only.'

const FINDINGS = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'claim', 'failureScenario', 'severity'],
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          claim: { type: 'string', description: 'one sentence: the defect' },
          failureScenario: {
            type: 'string',
            description: 'concrete inputs/state → concrete wrong output or crash',
          },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT = {
  type: 'object',
  required: ['refuted', 'confidence', 'evidence', 'why'],
  properties: {
    refuted: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'string', description: 'the file:line you read, and what it actually says' },
    repro: { type: 'string', description: 'the concrete triggering case, or "none constructible"' },
    why: { type: 'string' },
  },
}

// Dimensions are chosen to not overlap: each asks a question the others cannot
// answer, so two reviewers never return the same finding.
const DIMENSIONS = [
  {
    key: 'correctness',
    brief:
      'Correctness only. Wrong logic, off-by-one, inverted condition, unhandled None/empty/zero, ' +
      'mutation of shared state, incorrect error propagation, a resource never released, an ' +
      'async call blocking the loop, a race between concurrent paths. For each, construct the ' +
      'concrete input that produces the wrong output — if you cannot, do not report it.',
  },
  {
    key: 'contract',
    brief:
      'Contracts and blast radius. Does the change alter a signature, a return shape, a default, ' +
      'a config key or an implicit invariant that a caller depends on? Grep for EVERY caller and ' +
      'check each one. Does it break a promise an existing test asserts? Does it change ' +
      'behaviour when an optional dependency or API key is absent? Missing test coverage for a ' +
      'newly reachable path counts here.',
  },
  {
    key: 'simplification',
    brief:
      'Reuse and simplification. Logic reimplemented where the repo already has a helper, a ' +
      'concept duplicated across two files, a branch that cannot be taken, indirection that ' +
      'earns nothing, a wrong altitude of abstraction. Also efficiency, but only where it is ' +
      'measurable on a real path — not notional. No style nits; the formatter owns those.',
  },
]

log(`reviewing ${target} across ${DIMENSIONS.length} dimensions · ${REFUTERS_PER_FINDING} skeptics per finding`)

// pipeline: a dimension's findings go to skeptics as soon as that dimension
// lands. No barrier — dimensions finish at very different speeds.
const perDimension = await pipeline(
  DIMENSIONS,
  (dim) =>
    agent(
      `${READONLY}\n\nREVIEW TARGET: ${target}\n\nRead the diff first (git diff / git status, or ` +
        `the named target), then read the full files around every changed hunk — a diff alone ` +
        `hides the guard three lines above it.\n\nYOUR DIMENSION — stay inside it, siblings ` +
        `cover the others:\n${dim.brief}\n\nPrecision over recall: report nothing you cannot ` +
        `anchor to a file:line and a concrete failure. Pre-existing behaviour that this change ` +
        `did not introduce is not a finding unless the change makes it reachable.`,
      { label: `find:${dim.key}`, phase: 'Find', schema: FINDINGS },
    ),

  (res, dim) => {
    if (!res?.findings?.length) return []
    return parallel(
      res.findings.map((f) => () =>
        parallel(
          Array.from({ length: REFUTERS_PER_FINDING }, (_unused, i) => () =>
            agent(
              `${READONLY}\n\nCLAIM TO DESTROY:\n  ${f.claim}\n  at ${f.file}:${f.line}\n  ` +
                `alleged failure: ${f.failureScenario}\n\n` +
                `LENS: ${i === 0
                  ? 'correctness — is it actually wrong, or merely unusual? Is the path reachable at all, or does an earlier guard make it impossible? Is there a comment showing it is deliberate?'
                  : 'reproduction — construct the exact input and state that triggers it. No constructible case means the finding is theoretical and must be labelled so.'}\n\n` +
                `Open ${f.file} and read it yourself. Do not trust the citation — the cited line ` +
                `often says something merely adjacent to the claim, and that is where most ` +
                `confident findings die. Look for the cheaper explanation: pre-existing ` +
                `behaviour, a deliberate choice with a comment, a test that already covers it, a ` +
                `default that makes it moot. Default to refuted when you cannot positively ` +
                `establish the defect.`,
              {
                label: `refute:${dim.key}:${f.file.split('/').pop()}#${i + 1}`,
                phase: 'Refute',
                schema: VERDICT,
                agentType: 'refuter',
              },
            ),
          ),
        ).then((votes) => {
          const cast = votes.filter(Boolean)
          // Unanimity required to survive: any credible refutation drops it.
          const killed = cast.filter((v) => v.refuted)
          return {
            ...f,
            dimension: dim.key,
            survives: cast.length > 0 && killed.length === 0,
            votes: cast,
            repro: cast.map((v) => v.repro).find((r) => r && r !== 'none constructible') ?? null,
          }
        }),
      ),
    )
  },
)

const all = perDimension.flat().filter(Boolean)
const confirmed = all.filter((f) => f.survives)
const dropped = all.filter((f) => !f.survives)

const rank = { high: 0, medium: 1, low: 2 }
confirmed.sort((a, b) => rank[a.severity] - rank[b.severity])

log(`${confirmed.length} findings survived · ${dropped.length} refuted and dropped`)

return {
  target,
  confirmed,
  // Kept deliberately: what a naive review would have reported and been wrong about.
  dropped: dropped.map((f) => ({
    file: f.file,
    line: f.line,
    claim: f.claim,
    why: f.votes.find((v) => v.refuted)?.why ?? 'no verdict returned',
  })),
  counts: { reported: all.length, confirmed: confirmed.length, dropped: dropped.length },
}
