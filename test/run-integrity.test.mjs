import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProofGraph } from '../src/engine/proof-graph.mjs';
import { createFrozenHarness } from '../src/engine/harness.mjs';
import { evidenceIdentity } from '../src/engine/evidence.mjs';
import { verifyPersistedRun } from '../src/engine/run-integrity.mjs';

test('persisted run integrity accepts unchanged graph, harness and evidence', () => {
  const harness = createFrozenHarness({ id: 'h', oraclePlans: [] });
  const checks = [{ id: 'x', purpose: 'x', risk: 'MEDIUM', result: { status: 'PASS', exitCode: 0, evidence: { id: 'e1', tool: 'test', timestamp: '2026-09-28T00:00:00Z', exitCode: 0 } } }];
  const requirements = [{ id: 'x', statement: 'x', risk: 'MEDIUM', acceptanceCriteria: [], invariants: [] }];
  const proofAssessments = [{ checkId: 'x', plan: { oracles: [] }, receipt: { status: 'INSUFFICIENT_PROOF', confidence: 0, proofHash: 'p', oracles: [] } }];
  const gate = { status: 'PASS', reasons: [] };
  const proofGraph = buildProofGraph({ checks, requirements, proofAssessments, gate, harness, gitSha: 'abc' });
  const run = { checks, requirements, proofAssessments, findings: [], gate, harness, gitSha: 'abc', proofGraph, intelligence: { evidenceIdentity: evidenceIdentity([checks[0].result.evidence]) } };
  assert.equal(verifyPersistedRun(run).valid, true);
  run.checks[0].result.evidence.exitCode = 1;
  assert.equal(verifyPersistedRun(run).valid, false);
});
