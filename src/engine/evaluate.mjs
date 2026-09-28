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
    severity: check.risk === 'HIGH' ? 'HIGH' : 'MEDIUM',
    confidence: 1, title: `Échec du contrôle ${check.id}`,
    summary: result.stderr || `La commande ${result.evidence.command} a échoué.`,
    evidence: [result.evidence], location: check.id,
    rootCause: 'À déterminer par analyse du contexte et du diff.',
    consequence: 'Le comportement attendu n’est pas démontré.',
    regressionTests: [`Réexécuter le contrôle ${check.id} après correction.`],
  })];
}

export function buildGate({ checks, findings, profile }) {
  const requiredFailures = checks.filter((c, i) => c.required && ![RESULT_STATUS.PASS].includes(c.result?.status));
  const blockers = findings.filter(f => ['CONFIRMED_DEFECT', 'ENVIRONMENT_BLOCKER'].includes(f.kind) && ['HIGH','CRITICAL'].includes(f.severity));
  const status = requiredFailures.length || blockers.length ? 'FAIL' : findings.some(f => f.kind === 'LIKELY_DEFECT') ? 'PASS_WITH_RISK' : 'PASS';
  return { status, profile, checks: checks.map(c => ({ id: c.id, status: c.result?.status || RESULT_STATUS.NOT_RUN })), findings, generatedAt: new Date().toISOString() };
}
