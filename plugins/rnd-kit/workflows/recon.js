export const meta = {
  name: 'recon',
  description: 'Multi-angle research sweep with adversarial verification and a completeness critic',
  whenToUse:
    'A question with real unknowns spanning our code AND the outside world, where you want ' +
    'independent angles swept concurrently and every load-bearing claim attacked before you ' +
    'act on it. Pass the question as args (a string, or {question, angles}). Read-only.',
  phases: [
    { title: 'Sweep', detail: 'one scout per independent angle — repo, docs, source, prior art' },
    { title: 'Refute', detail: 'attack each load-bearing finding as it lands' },
    { title: 'Critic', detail: 'what modality was not run, what claim went unverified' },
    { title: 'Synthesise', detail: 'one answer, graded by confidence' },
  ],
}

// ---------------------------------------------------------------------------
// Read-only by contract. No agent here edits a file, and none may start a test
// suite, eval harness or benchmark — that gate belongs to the user (see the
// working agreement, Part A section A5). The most a run may do is *propose* one.
// ---------------------------------------------------------------------------

const question = typeof args === 'string' ? args : args?.question
if (!question) throw new Error('recon needs a question: pass it as args')

const READONLY =
  'You are read-only: edit no files, and do not start any test suite, eval harness, ' +
  'benchmark or live-service call. If verification is needed, describe the command; never run it.'

const FINDINGS = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'confidence', 'source', 'bearing', 'loadBearing'],
        properties: {
          claim: { type: 'string', description: 'one falsifiable sentence' },
          confidence: { type: 'string', enum: ['confirmed', 'likely', 'speculative'] },
          source: { type: 'string', description: 'URL fetched, or file:line read' },
          version: { type: 'string' },
          bearing: { type: 'string', description: 'what it means for the decision' },
          loadBearing: {
            type: 'boolean',
            description: 'true if the answer changes when this claim is false',
          },
        },
      },
    },
    deadEnds: { type: 'array', items: { type: 'string' } },
  },
}

const VERDICT = {
  type: 'object',
  required: ['verdict', 'confidence', 'evidence', 'why'],
  properties: {
    verdict: { type: 'string', enum: ['refuted', 'survives', 'survives-narrowed'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'string', description: 'what you personally read, and what it actually says' },
    narrowed: { type: 'string', description: 'the smaller claim that does survive' },
    why: { type: 'string' },
  },
}

// Angles are *sources*, not phrasings — two agents that would read the same
// material are one agent. Override per-question by passing {question, angles}.
const DEFAULT_ANGLES = [
  {
    key: 'repo',
    agentType: 'scout-repo',
    brief:
      'How does OUR code handle this today? Trace the real call path with file:line at every ' +
      'hop. Find the seams, the config that changes behaviour, what the tests pin down, and ' +
      'every caller a change would touch. Read the project docs too, and report anywhere they ' +
      'disagree with the code.',
  },
  {
    key: 'spec',
    agentType: 'scout-web',
    brief:
      'What does the upstream project/protocol/library actually SPECIFY? Official docs and the ' +
      'spec only. Pin every behaviour to a version, and check it against the version this repo ' +
      'pins. Do not read blogs for this angle.',
  },
  {
    key: 'source',
    agentType: 'scout-web',
    brief:
      'How is it REALLY implemented, and what goes wrong in practice? Read the actual source on ' +
      'GitHub, the changelog, and open/closed issues — `gh search code`, `gh api` and ' +
      '`gh issue view` are available and beat a web search here. Prefer maintainer answers.',
  },
  {
    key: 'priorart',
    agentType: 'scout-web',
    brief:
      'How do other people solve this SHAPE of problem? Prior art, published benchmarks with ' +
      'numbers, trade-off write-ups, approaches that were tried and abandoned and why. Report ' +
      'the abandoned ones — they are the cheapest lesson available.',
  },
]

const angles = Array.isArray(args?.angles) && args.angles.length ? args.angles : DEFAULT_ANGLES

// Cap on how many findings per angle get an adversarial pass. Refuting is the
// expensive half, so it is spent only on claims the answer actually rests on.
const REFUTE_PER_ANGLE = 2
const LENSES = ['correctness — is it true as stated, on a path that can actually be reached?',
                'reproduction — construct the concrete case, or declare it theoretical']

log(`sweeping ${angles.length} angles · refuting up to ${REFUTE_PER_ANGLE} load-bearing findings each`)

// pipeline, not parallel: each angle's findings go to refuters the moment that
// angle lands, instead of waiting for the slowest scout.
const perAngle = await pipeline(
  angles,
  (angle) =>
    agent(
      `${READONLY}\n\nRESEARCH QUESTION: ${question}\n\nYOUR ANGLE — stay inside it, siblings ` +
        `cover the others:\n${angle.brief}\n\nEvery claim carries the URL you fetched or the ` +
        `file:line you read. Anything without one is 'speculative' and must be labelled so. ` +
        `Mark loadBearing=true only where the answer changes if the claim is false. Report dead ` +
        `ends — a silent gap reads as 'nothing to find', which is a different claim.`,
      { label: `sweep:${angle.key}`, phase: 'Sweep', schema: FINDINGS, agentType: angle.agentType },
    ),

  (res, angle) => {
    if (!res?.findings?.length) return { angle: angle.key, findings: [], deadEnds: res?.deadEnds ?? [] }

    // Load-bearing first; unverified claims ahead of already-confirmed ones,
    // because that is where refutation buys the most.
    const ranked = res.findings
      .filter((f) => f.loadBearing)
      .sort((a, b) => (a.confidence === 'confirmed' ? 1 : 0) - (b.confidence === 'confirmed' ? 1 : 0))
    const targets = ranked.slice(0, REFUTE_PER_ANGLE)
    const skipped = ranked.length - targets.length
    if (skipped > 0) log(`${angle.key}: ${skipped} load-bearing finding(s) NOT refuted (cap ${REFUTE_PER_ANGLE})`)

    return parallel(
      targets.map((f, i) => () =>
        agent(
          `${READONLY}\n\nCLAIM TO DESTROY: ${f.claim}\n\nOffered source: ${f.source}\n` +
            `LENS: ${LENSES[i % LENSES.length]}\n\nDo not trust the reasoning you were handed, ` +
            `or the citation — open the source yourself and read what it ACTUALLY says. Half of ` +
            `confident claims die here because the cited line says something merely adjacent. ` +
            `Default to refuted when you cannot positively establish it.`,
          { label: `refute:${angle.key}#${i + 1}`, phase: 'Refute', agentType: 'refuter', schema: VERDICT },
        ).then((v) => ({ ...f, verdict: v })),
      ),
    ).then((judged) => ({
      angle: angle.key,
      findings: judged.filter(Boolean),
      unrefuted: res.findings.filter((f) => !targets.includes(f)),
      deadEnds: res.deadEnds ?? [],
    }))
  },
)

const landed = perAngle.filter(Boolean)
const judged = landed.flatMap((a) => a.findings)
const survived = judged.filter((f) => f.verdict?.verdict !== 'refuted')
const refuted = judged.filter((f) => f.verdict?.verdict === 'refuted')
const unrefuted = landed.flatMap((a) => a.unrefuted ?? [])

log(`${survived.length} survived · ${refuted.length} refuted · ${unrefuted.length} unrefuted`)

phase('Critic')
const gaps = await agent(
  `${READONLY}\n\nQUESTION: ${question}\n\nAngles swept: ${landed.map((a) => a.angle).join(', ')}\n` +
    `Surviving claims:\n${survived.map((f) => `- [${f.confidence}] ${f.claim} (${f.source})`).join('\n')}\n` +
    `Refuted:\n${refuted.map((f) => `- ${f.claim} — ${f.verdict?.why}`).join('\n')}\n` +
    `Dead ends: ${landed.flatMap((a) => a.deadEnds).join('; ')}\n\n` +
    `You are the completeness critic. What is MISSING? A source category nobody read, a claim ` +
    `carrying the answer that nobody attacked, a sub-question the decomposition dropped, an ` +
    `assumption everyone shared and nobody stated. Be specific enough that each gap names the ` +
    `next action. Do not re-summarise what was found.`,
  { label: 'critic', phase: 'Critic' },
)

phase('Synthesise')
const answer = await agent(
  `${READONLY}\n\nQUESTION: ${question}\n\n` +
    `SURVIVED (verdict + evidence):\n${JSON.stringify(survived, null, 1)}\n\n` +
    `REFUTED:\n${JSON.stringify(refuted, null, 1)}\n\n` +
    `NOT ADVERSARIALLY CHECKED — must be labelled as such in your answer:\n${JSON.stringify(unrefuted, null, 1)}\n\n` +
    `GAPS FROM THE CRITIC:\n${gaps}\n\n` +
    `Write the synthesis. Answer the question in the first three lines. Then: Confirmed / ` +
    `Likely / Refuted (keep this — a corrected belief is the most valuable part) / ` +
    `Contradictions with your call on each / Dead ends / Bearing on what we should do / ` +
    `Next cheapest thing that settles what is open. Every claim keeps its source. No ` +
    `recommendation may rest on a speculative claim without saying so in the same sentence. ` +
    `If any verification is warranted, propose the command — you must not run it.`,
  { label: 'synthesis', phase: 'Synthesise' },
)

return {
  question,
  answer,
  gaps,
  counts: {
    angles: landed.length,
    survived: survived.length,
    refuted: refuted.length,
    unrefutedCap: unrefuted.length,
  },
  survived,
  refuted,
}
