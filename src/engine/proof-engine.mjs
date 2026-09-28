import { createHash } from 'node:crypto';
import { evaluateOracle } from './oracle.mjs';
import { buildProofReceipt } from './proof-ledger.mjs';
import { createFrozenHarness } from './harness.mjs';
import { normalizeEvidence } from './evidence.mjs';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

export function buildProofEngine({ requirements = [], checks = [], semanticEvaluator = null, datasets = {} } = {}) {
  return {
    version: '3.0',
    requirements,
    checks,
    semanticEvaluator,
    datasets,
    engineHash: hash({ requirements, checks, datasets, semanticEvaluator: semanticEvaluator?.version ?? null })
  };
}

export async function proveRequirement({ requirement, plan, check, evidence = [], context = {} } = {}) {
  const normalizedEvidence = normalizeEvidence(evidence);
  const observation = {
    actual: check?.result?.exitCode,
    expected: requirement?.expected ?? 0,
    schemaValid: context.schemaValid,
    invariantValid: context.invariantValid,
    verdict: context.verdict,
    confidence: context.confidence,
    reason: context.reason,
    reference: context.reference,
    candidate: context.candidate,
    baseline: context.baseline,
    transformed: context.transformed,
    original: context.original,
    stateBefore: context.stateBefore,
    stateAfter: context.stateAfter
  };

  const oracleResults = [];
  for (const oracle of plan?.oracles ?? []) {
    let result = evaluateOracle(oracle, observation);
    if (['SEMANTIC', 'BEHAVIORAL', 'HUMAN', 'DIFFERENTIAL', 'METAMORPHIC', 'PROPERTY', 'RELATIONAL', 'STATE_MACHINE', 'CONCURRENCY'].includes(oracle.type) && semanticEvaluator) {
      result = await semanticEvaluator({ oracle, observation, requirement, evidence: normalizedEvidence });
    }
    oracleResults.push(result);
  }

  const receipt = buildProofReceipt({
    requirement,
    risk: requirement?.risk ?? 'MEDIUM',
    oraclePlan: plan?.oracles ?? [],
    oracleResults,
    evidence: normalizedEvidence,
    gitSha: context.gitSha ?? null,
    runId: context.runId ?? null
  });

  return {
    requirementId: requirement?.id ?? null,
    plan,
    oracleResults,
    receipt,
    proofHash: hash(receipt)
  };
}

export function buildHarness({ plans = [], datasets = {}, evaluator = null, policy = {} } = {}) {
  return createFrozenHarness({ id: 'hashcode-proof-engine-v3', oraclePlans: plans, dataset: datasets, evaluator, policy });
}
