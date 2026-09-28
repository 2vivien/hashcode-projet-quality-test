export const ORACLE_TYPES = Object.freeze({
  EXACT: 'EXACT', STRUCTURAL: 'STRUCTURAL', SCHEMA: 'SCHEMA', INVARIANT: 'INVARIANT',
  PROPERTY: 'PROPERTY', RELATIONAL: 'RELATIONAL', METAMORPHIC: 'METAMORPHIC',
  DIFFERENTIAL: 'DIFFERENTIAL', SEMANTIC: 'SEMANTIC', BEHAVIORAL: 'BEHAVIORAL', HUMAN: 'HUMAN'
});

const WEIGHTS = { deterministic: 1, semantic: 0.8, human: 0.7, observational: 0.9 };

export function createOracle({ type, criterion, evidenceRequired = [], evaluator = 'deterministic', severity = 'HIGH' }) {
  if (!ORACLE_TYPES[type]) throw new Error(`Unknown oracle type: ${type}`);
  return { type, criterion, evidenceRequired, evaluator, severity };
}

function normalize(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value.trim().toLowerCase() : JSON.stringify(value);
}

export function evaluateOracle(oracle, observation = {}) {
  const missing = (oracle.evidenceRequired || []).filter(k => observation[k] == null || observation[k] === '');
  if (missing.length) return { verdict: 'MISSING_EVIDENCE', confidence: 1, missing, reason: `Missing required evidence: ${missing.join(', ')}` };

  if (oracle.type === ORACLE_TYPES.EXACT) {
    const pass = normalize(observation.actual) === normalize(observation.expected);
    return { verdict: pass ? 'PASS' : 'FAIL', confidence: 1, reason: pass ? 'Exact oracle matched.' : 'Actual value differs from expected value.' };
  }
  if (oracle.type === ORACLE_TYPES.SCHEMA) {
    const valid = observation.schemaValid === true;
    return { verdict: valid ? 'PASS' : 'FAIL', confidence: 1, reason: valid ? 'Schema validation passed.' : 'Schema validation failed.' };
  }
  if (oracle.type === ORACLE_TYPES.INVARIANT) {
    const valid = observation.invariantValid === true;
    return { verdict: valid ? 'PASS' : 'FAIL', confidence: 1, reason: valid ? 'Invariant held.' : 'Invariant was violated.' };
  }
  if (oracle.type === ORACLE_TYPES.BEHAVIORAL || oracle.type === ORACLE_TYPES.SEMANTIC) {
    if (!['PASS','FAIL','INCONCLUSIVE'].includes(observation.verdict)) return { verdict:'MISSING_EVIDENCE', confidence:0, reason:'Semantic oracle requires a validated evaluator verdict.' };
    return { verdict: observation.verdict, confidence: Math.max(0, Math.min(1, Number(observation.confidence ?? 0))), reason: observation.reason || 'Evaluator supplied no reason.' };
  }
  return { verdict: 'INCONCLUSIVE', confidence: 0, reason: `Oracle type ${oracle.type} needs a specialized adapter.` };
}

export function assessProof({ requirement, oracleResults = [], evidence = [] }) {
  const required = requirement?.requiredEvidence || [];
  const evidenceKeys = new Set(evidence.flatMap(e => [
    ...(Array.isArray(e?.keys) ? e.keys : []),
    ...Object.keys(e ?? {}).filter(k => !['stdout', 'stderr', 'meta'].includes(k))
  ]));
  const missingEvidence = required.filter(k => !evidenceKeys.has(k));
  if (missingEvidence.length) return { status:'INSUFFICIENT_PROOF', confidence:1, missingEvidence, rationale:'Required evidence is absent.' };

  const results = oracleResults.filter(Boolean);
  if (!results.length) return { status:'INSUFFICIENT_PROOF', confidence:1, missingEvidence:[], rationale:'No oracle actually evaluated the requirement.' };
  if (results.some(r => r.verdict === 'FAIL')) return { status:'NOT_PROVEN', confidence:1, missingEvidence:[], rationale:'At least one oracle failed.' };
  if (results.some(r => r.verdict === 'MISSING_EVIDENCE' || r.verdict === 'INCONCLUSIVE')) return { status:'INSUFFICIENT_PROOF', confidence:Math.min(...results.map(r=>r.confidence ?? 0)), missingEvidence:[], rationale:'An oracle could not establish the required property.' };

  const confidence = results.reduce((s,r)=>s+(r.confidence ?? 0),0)/results.length;
  return { status:'PROVEN', confidence, missingEvidence:[], rationale:'All required oracles passed with available evidence.' };
}

export function generateProofPlan({ requirement, risk = 'MEDIUM', capabilities = {} }) {
  const checks = [];
  const text = String(requirement?.statement || '');
  if (requirement?.expected !== undefined) checks.push(createOracle({type:'EXACT', criterion:'actual equals expected', evidenceRequired:['actual','expected']}));
  if (requirement?.schema) checks.push(createOracle({type:'SCHEMA', criterion:'output satisfies schema', evidenceRequired:['schemaValid']}));
  if (/must|always|never|cannot|invariant|idempotent/i.test(text)) checks.push(createOracle({type:'INVARIANT', criterion:text, evidenceRequired:['invariantValid']}));
  if (capabilities.semanticEvaluator) checks.push(createOracle({type:'SEMANTIC', criterion:text, evidenceRequired:['verdict','confidence','reason'], evaluator:'llm_judge'}));
  if (!checks.length) checks.push(createOracle({type:'BEHAVIORAL', criterion:text, evidenceRequired:['verdict','confidence','reason'], evaluator:'semantic_judge'}));
  return { requirement: text, risk, oracles: checks, proofPolicy: risk === 'CRITICAL' ? 'deterministic_plus_semantic_or_human' : 'deterministic_first' };
}
