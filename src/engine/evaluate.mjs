import { FINDING_KIND, createFinding, RESULT_STATUS } from './model.mjs';

export function evaluateCheck(check, result) {
  if (result.status === RESULT_STATUS.PASS) return [];
  if (result.status === RESULT_STATUS.BLOCKED) return [createFinding({
    kind: FINDING_KIND.ENVIRONMENT_BLOCKER, severity: 'HIGH', confidence: 1,
    title: `Impossible d'exécuter: ${check.id}`,
    summary: result.stderr || 'Le processus n’a pas pu être lancé ou a dépassé le délai.',
    evidence: [result.evidence], location: check.id,
  })];
  return [createFinding({
    kind: check.required ? FINDING_KIND.CONFIRMED_DEFECT : FINDING_KIND.LIKELY_DEFECT,
    severity: check.risk === 'CRITICAL' ? 'CRITICAL' : check.risk === 'HIGH' ? 'HIGH' : 'MEDIUM',
    confidence: 1, title: `Échec du contrôle ${check.id}`,
    summary: result.stderr || `La commande ${result.evidence.command} a échoué.`,
    evidence: [result.evidence], location: check.id, checkId: check.id, requirementId: check.id,
    rootCause: 'À déterminer par analyse du contexte et du diff.',
    consequence: 'Le comportement attendu n’est pas démontré.',
    regressionTests: [`Réexécuter le contrôle ${check.id} après correction.`],
  })];
}

export function buildGate({ checks = [], findings = [], proofAssessments = [], profile }) {
  const requiredFailures = checks.filter(c => c.required && c.result?.status !== RESULT_STATUS.PASS);
  const blockers = findings.filter(f => ['CONFIRMED_DEFECT', 'ENVIRONMENT_BLOCKER'].includes(f.kind) && ['HIGH','CRITICAL'].includes(f.severity));
  const requiredProofFailures = proofAssessments.filter((p, i) => {
    const check = checks.find(c => c.id === p.checkId) ?? checks[i];
    const risk = p.receipt?.requirement?.risk ?? check?.risk ?? 'MEDIUM';
    const mandatory = Boolean(check?.required) || ['CRITICAL'].includes(String(risk).toUpperCase());
    return mandatory && p.receipt?.status !== 'PROVEN';
  });
  const status = requiredFailures.length || blockers.length || requiredProofFailures.length
    ? 'FAIL'
    : findings.some(f => f.kind === 'LIKELY_DEFECT') ? 'PASS_WITH_RISK' : 'PASS';
  const reasons = [
    ...requiredFailures.map(c => `required check failed: ${c.id}`),
    ...blockers.map(f => f.title),
    ...requiredProofFailures.map(p => `required proof not established: ${p.requirementId ?? p.checkId ?? 'unknown'} (${p.receipt?.status ?? 'UNKNOWN'})`)
  ];
  return {
    status, profile,
    checks: checks.map(c => ({ id: c.id, status: c.result?.status || RESULT_STATUS.NOT_RUN })),
    proof: { required: requiredProofFailures.length === 0, failures: requiredProofFailures.map(p => ({ checkId: p.checkId, requirementId: p.requirementId ?? p.receipt?.requirement?.id ?? null, status: p.receipt?.status })) },
    findings, reasons, generatedAt: new Date().toISOString()
  };
}
