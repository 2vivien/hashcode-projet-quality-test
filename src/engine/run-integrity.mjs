import { buildProofGraph } from './proof-graph.mjs';
import { verifyFrozenHarness } from './harness.mjs';
import { evidenceIdentity } from './evidence.mjs';

export function verifyPersistedRun(run = {}) {
  const graph = buildProofGraph({
    checks: run.checks ?? [],
    proofAssessments: run.proofAssessments ?? [],
    requirements: run.requirements ?? [],
    findings: run.findings ?? [],
    gate: run.gate ?? null,
    harness: run.harness ?? null,
    gitSha: run.gitSha ?? null
  });
  const graphValid = Boolean(run.proofGraph?.graphHash) && graph.graphHash === run.proofGraph.graphHash;
  const harnessCheck = verifyFrozenHarness(run.harness, run.harness?.harnessHash);
  const actualEvidenceIdentity = evidenceIdentity((run.checks ?? []).map(c => c.result?.evidence).filter(Boolean));
  const expectedEvidenceIdentity = run.intelligence?.evidenceIdentity ?? null;
  const evidenceValid = Boolean(expectedEvidenceIdentity) && actualEvidenceIdentity === expectedEvidenceIdentity;
  return {
    valid: graphValid && harnessCheck.valid && evidenceValid,
    graph: { valid: graphValid, expected: run.proofGraph?.graphHash ?? null, actual: graph.graphHash },
    harness: harnessCheck,
    evidence: { valid: evidenceValid, expected: expectedEvidenceIdentity, actual: actualEvidenceIdentity }
  };
}
