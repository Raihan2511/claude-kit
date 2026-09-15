export const meta = {
  name: 'lanes',
  description: 'Build approved lanes in parallel with disjoint file ownership, then integrate the seams',
  whenToUse:
    'An approved plan already cut into lanes that own disjoint file sets. Pass ' +
    '{lanes:[{id,title,goal,owns,mustNotTouch,contract,check}], task}. Builds code; runs only ' +
    'cheap local checks and never a gated harness.',
  phases: [
    { title: 'Build', detail: 'one builder per lane, inside its own files only' },
    { title: 'Integrate', detail: 'reconcile the seams the lanes could not see' },
  ],
}

// ---------------------------------------------------------------------------
// The one invariant: no two lanes own the same file. It is checked below rather
// than trusted, because a violation silently corrupts both lanes' work.
//
// Builders run in the SAME working tree. That is deliberate for a repo this
// size — worktree isolation costs setup and makes integration a merge problem
// instead of a seam problem. If lanes genuinely cannot be made disjoint, add
// {isolation: 'worktree'} to the build agent() call and merge afterwards.
// ---------------------------------------------------------------------------

const lanes = args?.lanes
const task = args?.task ?? 'the approved change'
if (!Array.isArray(lanes) || !lanes.length) {
  throw new Error('lanes needs {lanes:[{id,title,goal,owns,...}]} — pass an array, not a string')
}

const owners = new Map()
const clashes = []
for (const lane of lanes) {
  for (const file of lane.owns ?? []) {
    if (owners.has(file)) clashes.push(`${file} claimed by both ${owners.get(file)} and ${lane.id}`)
    else owners.set(file, lane.id)
  }
}
if (clashes.length) {
  // Refuse rather than race. Overlapping lanes are one lane; re-cut and re-run.
  throw new Error(`lane file ownership overlaps — merge these lanes:\n${clashes.join('\n')}`)
}

const NO_HARNESS =
  'Cheap local checks only: lint, format, type-check, and unit tests scoped to what you ' +
  'touched. You must NOT start an eval harness, a benchmark, a live-service call, or anything ' +
  'that costs money, takes minutes or mutates an index or deployment. Propose those in NOT-RUN ' +
  'and stop — that gate belongs to the user.'

const LANE_RESULT = {
  type: 'object',
  required: ['laneId', 'status', 'changes', 'checks'],
  properties: {
    laneId: { type: 'string' },
    status: { type: 'string', enum: ['complete', 'complete-with-caveats', 'blocked'] },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'what'],
        properties: {
          file: { type: 'string', description: 'file:line' },
          what: { type: 'string' },
        },
      },
    },
    contractNotes: { type: 'string', description: 'how the seam was honoured; any deviation' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['command', 'passed'],
        properties: {
          command: { type: 'string' },
          passed: { type: 'boolean' },
          output: { type: 'string', description: 'verbatim on failure' },
        },
      },
    },
    collision: { type: 'string', description: 'forbidden file you needed, and what for' },
    notRun: { type: 'string', description: 'the gated verification this warrants' },
    noticed: { type: 'array', items: { type: 'string' } },
  },
}

const SELF_REVIEW = {
  type: 'object',
  required: ['verdict', 'issues'],
  properties: {
    verdict: { type: 'string', enum: ['clean', 'needs-work'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'problem', 'severity'],
        properties: {
          file: { type: 'string' },
          problem: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const brief = (lane) =>
  `TASK CONTEXT: ${task}\n\n` +
  `LANE ${lane.id} — ${lane.title}\n` +
  `GOAL: ${lane.goal}\n` +
  `YOU OWN (edit only these): ${(lane.owns ?? []).join(', ') || '(none listed — ask before editing)'}\n` +
  `FORBIDDEN (a sibling builder is inside them right now): ${(lane.mustNotTouch ?? []).join(', ') || 'every file not listed as owned'}\n` +
  `CONTRACT TO HONOUR: ${lane.contract ?? 'match the existing interfaces exactly'}\n` +
  `PROVE IT WORKS WITH: ${lane.check ?? 'the repo cheap check set'}\n\n` +
  `Read every file you change in full, plus its tests, before editing. Match the surrounding ` +
  `code's naming, error handling and comment density — your diff should be unpickable by style ` +
  `alone. If you cannot finish without a forbidden file, STOP and report the collision; do not ` +
  `work around it with a hack. No scope creep: other problems go in 'noticed', unfixed.\n\n` +
  NO_HARNESS

log(`${lanes.length} lanes · ${owners.size} files owned · ownership verified disjoint`)

// pipeline: each lane self-reviews the moment it lands, rather than waiting on
// the slowest sibling. The integrate barrier comes after, where it is real.
const built = await pipeline(
  lanes,
  (lane) =>
    agent(brief(lane), {
      label: `build:${lane.id}`,
      phase: 'Build',
      schema: LANE_RESULT,
      agentType: 'builder',
    }),

  (res, lane) => {
    if (!res || res.status === 'blocked') return res
    return agent(
      `Review ONLY lane ${lane.id}'s diff, restricted to these files: ${(lane.owns ?? []).join(', ')}.\n\n` +
        `The builder reported:\n${JSON.stringify(res, null, 1)}\n\n` +
        `Check the things a builder cannot see about its own work: did it actually honour the ` +
        `contract "${lane.contract ?? 'existing interfaces'}"? Did it special-case a test instead ` +
        `of fixing the cause? Silence a type error with Any, or a failure with a bare except? ` +
        `Leave a claim in its report that the diff does not support? Read the files. Do not fix ` +
        `anything — report.\n\n${NO_HARNESS}`,
      { label: `check:${lane.id}`, phase: 'Build', schema: SELF_REVIEW, agentType: 'refuter' },
    ).then((review) => ({ ...res, review }))
  },
)

const landed = built.filter(Boolean)
const blocked = landed.filter((r) => r.status === 'blocked')
const collisions = landed.filter((r) => r.collision)
const redChecks = landed.flatMap((r) => (r.checks ?? []).filter((c) => !c.passed))

if (collisions.length) {
  log(`COLLISION in ${collisions.length} lane(s) — the lane cut is wrong, re-cut before integrating`)
}
if (blocked.length) log(`${blocked.length} lane(s) blocked`)
if (redChecks.length) log(`${redChecks.length} failing check(s) reported by builders`)

// One lane needs no integrator: there are no seams between a thing and itself.
let integration = null
if (landed.length > 1) {
  phase('Integrate')
  integration = await agent(
    `Integrate ${landed.length} parallel lanes into one coherent change for: ${task}\n\n` +
      `LANE REPORTS:\n${JSON.stringify(landed, null, 1)}\n\n` +
      `Read the whole diff first (git diff, git status) before touching anything. Each builder ` +
      `saw one lane; you are the first to see the whole change, so hunt the defects that exist ` +
      `only BETWEEN correct pieces: a contract implemented differently on each side, logic two ` +
      `lanes each added because neither could see the other, a config key declared twice or ` +
      `never read, a type correct alone and wrong in composition, a registration both lanes ` +
      `assumed the other would add, error handling that now double-wraps, a test one lane ` +
      `silently invalidated.\n\n` +
      `Prefer deleting to adding — integration is mostly subtraction. Then get the full cheap ` +
      `check set green WITHOUT weakening an assertion, loosening a type or skipping a test. If ` +
      `it cannot pass without a design change, stop and report it.\n\n` +
      `Be strict about the VERIFIED / UNVERIFIED split — it is the most important thing you ` +
      `produce.\n\n${NO_HARNESS}`,
    { label: 'integrate', phase: 'Integrate', agentType: 'integrator' },
  )
}

return {
  task,
  lanes: landed,
  integration,
  needsAttention: {
    collisions: collisions.map((r) => ({ lane: r.laneId, collision: r.collision })),
    blocked: blocked.map((r) => r.laneId),
    failingChecks: redChecks,
    reviewIssues: landed.flatMap((r) =>
      (r.review?.issues ?? []).filter((i) => i.severity !== 'low').map((i) => ({ lane: r.laneId, ...i })),
    ),
  },
  // Never started here by design — relay to the user and let them decide.
  gatedVerificationProposed: landed.map((r) => r.notRun).filter(Boolean),
}
