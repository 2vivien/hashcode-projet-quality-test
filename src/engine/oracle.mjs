export const ORACLE_TYPES = Object.freeze({
  EXACT: 'EXACT', STRUCTURAL: 'STRUCTURAL', SCHEMA: 'SCHEMA', INVARIANT: 'INVARIANT',
  PROPERTY: 'PROPERTY', RELATIONAL: 'RELATIONAL', METAMORPHIC: 'METAMORPHIC',
  DIFFERENTIAL: 'DIFFERENTIAL', STATE_MACHINE: 'STATE_MACHINE', CONCURRENCY: 'CONCURRENCY',
  SEMANTIC: 'SEMANTIC', BEHAVIORAL: 'BEHAVIORAL', HUMAN: 'HUMAN'
});

const EVALUATOR_ORACLES = new Set([
  ORACLE_TYPES.PROPERTY, ORACLE_TYPES.RELATIONAL, ORACLE_TYPES.METAMORPHIC,
  ORACLE_TYPES.DIFFERENTIAL, ORACLE_TYPES.STATE_MACHINE, ORACLE_TYPES.CONCURRENCY,
  ORACLE_TYPES.SEMANTIC, ORACLE_TYPES.BEHAVIORAL, ORACLE_TYPES.HUMAN
]);

function clamp(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function normalize(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  return JSON.stringify(value);
}

export function createOracle({ type, criterion, evidenceRequired = [], evaluator = 'deterministic', severity = 'HIGH', parameters = {} }) {
  if (!ORACLE_TYPES[type]) throw new Error(`Unknown oracle type: ${type}`);
  return { type, criterion, evidenceRequired, evaluator, severity, parameters };
}

export function evaluateOracle(oracle, observation = {}) {
  const missing = (oracle.evidenceRequired || []).filter(k => observation[k] == null || observation[k] === '');
  if (missing.length) {
    return { verdict: 'MISSING_EVIDENCE', confidence: 1, missing, reason: `Missing required evidence: ${missing.join(', ')}` };
  }

  switch (oracle.type) {
    case ORACLE_TYPES.EXACT: {
      const pass = normalize(observation.actual) === normalize(observation.expected);
      return { verdict: pass ? 'PASS' : 'FAIL', confidence: 1, reason: pass ? 'Exact oracle matched.' : 'Actual value differs from expected value.' };
    }
    case ORACLE_TYPES.STRUCTURAL: {
      const pass = observation.structuralValid === true;
      return { verdict: pass ? 'PASS' : 'FAIL', confidence: 1, reason: pass ? 'Required structure is valid.' : 'Required structure is invalid.' };
    }
    case ORACLE_TYPES.SCHEMA: {
      const pass = observation.schemaValid === true;
      return { verdict: pass ? 'PASS' : 'FAIL', confidence: 1, reason: pass ? 'Schema validation passed.' : 'Schema validation failed.' };
    }
    case ORACLE_TYPES.INVARIANT: {
      const pass = observation.invariantValid === true;
      return { verdict: pass ? 'PASS' : 'FAIL', confidence: 1, reason: pass ? 'Invariant held.' : 'Invariant was violated.' };
    }
    default:
      if (EVALUATOR_ORACLES.has(oracle.type)) {
        if (!['PASS', 'FAIL', 'INCONCLUSIVE'].includes(observation.verdict)) {
          return { verdict: 'MISSING_EVIDENCE', confidence: 0, reason: 'This oracle requires a validated evaluator verdict.' };
        }
        return { verdict: observation.verdict, confidence: clamp(observation.confidence), reason: observation.reason || 'Evaluator supplied no reason.' };
      }
      return { verdict: 'INCONCLUSIVE', confidence: 0, reason: `Oracle type ${oracle.type} needs a specialized adapter.` };
  }
}

export function assessProof({ requirement, oracleResults = [], evidence = [] }) {
  const required = requirement?.requiredEvidence || [];
  const evidenceKeys = new Set(evidence.flatMap(e => [
    ...(Array.isArray(e?.keys) ? e.keys : []),
    ...Object.keys(e ?? {}).filter(k => !['stdout', 'stderr', 'meta'].includes(k))
  ]));
  const missingEvidence = required.filter(k => !evidenceKeys.has(k));
  if (missingEvidence.length) return { status: 'INSUFFICIENT_PROOF', confidence: 1, missingEvidence, rationale: 'Required evidence is absent.' };

  const results = oracleResults.filter(Boolean);
  if (!results.length) return { status: 'INSUFFICIENT_PROOF', confidence: 1, missingEvidence: [], rationale: 'No oracle actually evaluated the requirement.' };
  if (results.some(r => r.verdict === 'FAIL')) return { status: 'NOT_PROVEN', confidence: 1, missingEvidence: [], rationale: 'At least one oracle failed.' };
  if (results.some(r => r.verdict === 'MISSING_EVIDENCE')) return { status: 'INSUFFICIENT_PROOF', confidence: Math.min(...results.map(r => r.confidence ?? 0)), missingEvidence: [], rationale: 'An oracle is missing required evidence.' };
  if (results.some(r => r.verdict === 'INCONCLUSIVE')) return { status: 'INCONCLUSIVE', confidence: Math.min(...results.map(r => r.confidence ?? 0)), missingEvidence: [], rationale: 'An oracle could not establish the required property.' };

  const confidence = Math.min(...results.map(r => clamp(r.confidence)));
  return { status: 'PROVEN', confidence, missingEvidence: [], rationale: 'All required oracles passed with available evidence.' };
}

export function generateProofPlan({ requirement, risk = 'MEDIUM', capabilities = {} }) {
  const plans = [];
  const statement = String(requirement?.statement || '');
  const normalizedRisk = String(risk).toUpperCase();
  const highRisk = ['HIGH', 'CRITICAL'].includes(normalizedRisk);
  const strictHighRisk = capabilities.strictHighRisk === true;
  const strict = normalizedRisk === 'CRITICAL' || strictHighRisk;

  if (requirement?.expected !== undefined) {
    plans.push(createOracle({ type: ORACLE_TYPES.EXACT, criterion: 'actual equals expected', evidenceRequired: ['exitCode'] }));
  }
  if (requirement?.schema) {
    plans.push(createOracle({ type: ORACLE_TYPES.SCHEMA, criterion: 'output satisfies schema', evidenceRequired: ['schemaValid'] }));
  }
  if (requirement?.acceptanceCriteria?.length) {
    plans.push(createOracle({ type: ORACLE_TYPES.STRUCTURAL, criterion: 'all acceptance criteria are evidenced', evidenceRequired: ['structuralValid'] }));
  }
  if (requirement?.invariants?.length || /\b(must|always|never|cannot|invariant|idempotent|unique|authorized|isolated)\b/i.test(statement)) {
    plans.push(createOracle({ type: ORACLE_TYPES.INVARIANT, criterion: requirement?.invariants?.join('; ') || statement, evidenceRequired: ['invariantValid'] }));
  }

  if (capabilities.differentialReference) {
    plans.push(createOracle({ type: ORACLE_TYPES.DIFFERENTIAL, criterion: 'candidate agrees with independent reference', evidenceRequired: ['baseline', 'candidate', 'verdict', 'confidence', 'reason'], evaluator: 'reference_comparator' }));
  }
  if (capabilities.semanticEvaluator) {
    plans.push(createOracle({ type: ORACLE_TYPES.SEMANTIC, criterion: statement, evidenceRequired: ['verdict', 'confidence', 'reason'], evaluator: 'llm_judge' }));
  }

  if (!plans.length) {
    plans.push(createOracle({
      type: highRisk ? ORACLE_TYPES.BEHAVIORAL : ORACLE_TYPES.EXACT,
      criterion: highRisk ? statement : 'command exits successfully',
      evidenceRequired: highRisk ? ['verdict', 'confidence', 'reason'] : ['actual', 'expected']
    }));
  }

  if (highRisk && capabilities.semanticEvaluator && !plans.some(p => p.type === ORACLE_TYPES.SEMANTIC)) {
    plans.push(createOracle({ type: ORACLE_TYPES.SEMANTIC, criterion: statement, evidenceRequired: ['verdict', 'confidence', 'reason'], evaluator: 'llm_judge' }));
  }

  return {
    requirement: statement,
    risk,
    oracles: plans,
    proofPolicy: strict ? 'multi_oracle_required' : 'deterministic_first'
  };
}
