export const RESULT_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_RUN: 'NOT_RUN',
  BLOCKED: 'ENVIRONMENT_BLOCKER',
  FLAKY: 'FLAKY_RESULT',
  INCONCLUSIVE: 'UNKNOWN_INCONCLUSIVE',
});

export const FINDING_KIND = Object.freeze({
  CONFIRMED_DEFECT: 'CONFIRMED_DEFECT',
  LIKELY_DEFECT: 'LIKELY_DEFECT',
  RISK: 'RISK',
  MISSING_EVIDENCE: 'MISSING_EVIDENCE',
  ENVIRONMENT_BLOCKER: 'ENVIRONMENT_BLOCKER',
  FLAKY_RESULT: 'FLAKY_RESULT',
  UNKNOWN: 'UNKNOWN_INCONCLUSIVE',
});

export function nowIso() { return new Date().toISOString(); }

export function createEvidence({ command, cwd, exitCode, stdout = '', stderr = '', durationMs = 0, tool = 'shell', meta = {} }) {
  return { id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, tool, command, cwd, exitCode, stdout, stderr, durationMs, timestamp: nowIso(), ...meta };
}

export function createCheck({ id, category, purpose, risk = 'MEDIUM', command, args = [], required = false, destructive = false }) {
  return { id, category, purpose, risk, command, args, required, destructive };
}

export function createRequirement({ id, statement, risk = 'MEDIUM', acceptanceCriteria = [], invariants = [], requiredEvidence = [], scope = {}, expected, schema }) {
  return { id, statement, risk, acceptanceCriteria, invariants, requiredEvidence, scope, expected, schema };
}

export function createFinding({ kind, severity = 'MEDIUM', confidence = 1, title, summary, evidence = [], rootCause = null, consequence = null, location = null, regressionTests = [] }) {
  return { id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, kind, severity, confidence, title, summary, evidence, rootCause, consequence, location, regressionTests, createdAt: nowIso() };
}
