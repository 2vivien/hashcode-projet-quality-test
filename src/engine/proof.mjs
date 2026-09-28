import { assessProof, generateProofPlan } from './oracle.mjs';

export function evaluateProof({ requirement, oracleResults, evidence }) {
  const assessment = assessProof({ requirement, oracleResults, evidence });
  return {
    ...assessment,
    requirement: requirement.statement,
    oracleResults,
    evidenceCount: evidence.length,
    proofStrength: assessment.status === 'PROVEN' ? (assessment.confidence >= 0.9 ? 'STRONG' : 'MODERATE') : 'NONE'
  };
}

export function planProof(requirement, context = {}) {
  return generateProofPlan({ requirement, risk: context.risk || 'MEDIUM', capabilities: context.capabilities || {} });
}
