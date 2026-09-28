import { createHash } from 'node:crypto';

export const PROOF_STATUS = Object.freeze({
  PROVEN: 'PROVEN',
  NOT_PROVEN: 'NOT_PROVEN',
  INSUFFICIENT_PROOF: 'INSUFFICIENT_PROOF',
  INCONCLUSIVE: 'INCONCLUSIVE'
});

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function evidenceDescriptor(evidence = []) {
  return evidence.map(e => ({
    id: e.id ?? null,
    tool: e.tool ?? null,
    command: e.command ?? null,
    exitCode: e.exitCode ?? null,
    timestamp: e.timestamp ?? null,
    durationMs: e.durationMs ?? null,
    stdoutHash: hash(e.stdout ?? ''),
    stderrHash: hash(e.stderr ?? ''),
    meta: e.meta ?? {}
  }));
}

function oracleExplanation(result) {
  if (!result) return { demonstrated: false, statement: 'No oracle result was produced.' };
  if (result.verdict === 'PASS') return { demonstrated: true, statement: result.reason || 'Oracle passed.' };
  if (result.verdict === 'FAIL') return { demonstrated: false, statement: result.reason || 'Oracle failed.' };
  return { demonstrated: false, statement: result.reason || 'Oracle could not establish the property.' };
}

/**
 * Build an auditable explanation of why a requirement is or is not proven.
 *
 * Important: a PASS is never enough by itself. The receipt records:
 * requirement -> oracle -> evidence -> verdict -> confidence -> remaining gaps.
 */
export function buildProofReceipt({ requirement, risk = 'MEDIUM', oraclePlan = [], oracleResults = [], evidence = [], gitSha = null, runId = null }) {
  const requiredEvidence = requirement?.requiredEvidence ?? [];
  const availableEvidence = new Set(
    evidence.flatMap(e => e.keys ?? Object.keys(e).filter(k => e !== 'stdout' && e !== 'stderr'))
  );
  const missingEvidence = requiredEvidence.filter(key => !availableEvidence.has(key));

  const oracleReceipts = oraclePlan.map((oracle, index) => {
    const result = oracleResults[index] ?? null;
    return {
      type: oracle.type,
      criterion: oracle.criterion,
      evaluator: oracle.evaluator,
      requiredEvidence: oracle.evidenceRequired ?? [],
      ...oracleExplanation(result),
      verdict: result?.verdict ?? 'NOT_EVALUATED',
      confidence: Number.isFinite(result?.confidence) ? result.confidence : 0,
      missing: result?.missing ?? []
    };
  });

  const failed = oracleReceipts.filter(o => o.verdict === 'FAIL');
  const unresolved = oracleReceipts.filter(o => !['PASS'].includes(o.verdict));
  let status = PROOF_STATUS.PROVEN;
  let rationale = 'Every planned oracle passed and the required evidence is present.';

  if (missingEvidence.length) {
    status = PROOF_STATUS.INSUFFICIENT_PROOF;
    rationale = 'The requirement cannot be proven because required evidence is missing.';
  } else if (!oracleReceipts.length) {
    status = PROOF_STATUS.INSUFFICIENT_PROOF;
    rationale = 'No oracle was executed against the requirement.';
  } else if (failed.length) {
    status = PROOF_STATUS.NOT_PROVEN;
    rationale = 'At least one oracle found that the requirement was not satisfied.';
  } else if (unresolved.length) {
    status = PROOF_STATUS.INCONCLUSIVE;
    rationale = 'At least one oracle did not produce a passing verdict.';
  }

  const confidence = oracleReceipts.length
    ? Math.min(...oracleReceipts.map(o => o.confidence))
    : 0;

  const receipt = {
    version: '1.0',
    runId,
    gitSha,
    requirement: {
      id: requirement?.id ?? null,
      statement: requirement?.statement ?? '',
      risk,
      requiredEvidence
    },
    status,
    rationale,
    confidence,
    verified: oracleReceipts.filter(o => o.verdict === 'PASS').map(o => ({
      oracle: o.type,
      criterion: o.criterion,
      confidence: o.confidence
    })),
    data: {
      evidenceCount: evidence.length,
      evidence: evidenceDescriptor(evidence),
      evidenceIds: evidence.map(e => e.id).filter(Boolean)
    },
    oracles: oracleReceipts,
    remaining: {
      missingEvidence,
      unevaluatedOracles: oracleReceipts.filter(o => o.verdict === 'NOT_EVALUATED').map(o => o.type),
      unresolvedOracles: oracleReceipts.filter(o => !['PASS', 'FAIL'].includes(o.verdict)).map(o => o.type),
      note: status === PROOF_STATUS.PROVEN
        ? 'This receipt proves only the stated requirement under the stated oracle and evidence. It does not prove unrelated behavior.'
        : 'The requirement remains unproven until the listed gaps are resolved.'
    }
  };

  receipt.proofHash = hash({
    requirement: receipt.requirement,
    status: receipt.status,
    verified: receipt.verified,
    evidence: receipt.data.evidence,
    oracles: receipt.oracles,
    remaining: receipt.remaining
  });

  return receipt;
}

export function explainProof(receipt) {
  return {
    status: receipt.status,
    why: receipt.rationale,
    whatWasVerified: receipt.verified,
    dataUsed: receipt.data,
    oracles: receipt.oracles,
    whatRemainsUnproven: receipt.remaining,
    proofHash: receipt.proofHash
  };
}
