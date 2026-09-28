import test from 'node:test';
import assert from 'node:assert/strict';
import { createOracle, evaluateOracle, generateProofPlan } from '../src/engine/oracle.mjs';
import { buildProofReceipt } from '../src/engine/proof-ledger.mjs';

test('deterministic exact oracle proves a matching execution', () => {
  const oracle = createOracle({ type: 'EXACT', criterion: 'exit code is zero', evidenceRequired: ['exitCode'] });
  const result = evaluateOracle(oracle, { actual: 0, expected: 0, exitCode: 0 });
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.confidence, 1);
});

test('metamorphic oracle never invents a verdict without evaluator evidence', () => {
  const oracle = createOracle({ type: 'METAMORPHIC', criterion: 'equivalent transformation preserves property', evidenceRequired: ['verdict', 'confidence', 'reason'] });
  const result = evaluateOracle(oracle, {});
  assert.equal(result.verdict, 'MISSING_EVIDENCE');
});

test('critical proof requires independent oracle types', () => {
  const oracle = createOracle({ type: 'EXACT', criterion: 'ok', evidenceRequired: ['exitCode'] });
  const receipt = buildProofReceipt({
    requirement: { id: 'critical', statement: 'critical behavior', requiredEvidence: ['exitCode'] },
    risk: 'CRITICAL',
    oraclePlan: [oracle],
    oracleResults: [{ verdict: 'PASS', confidence: 1 }],
    evidence: [{ id: 'ev1', exitCode: 0, timestamp: '2026-09-28T00:00:00Z' }],
    gitSha: 'abc',
    runId: 'run1'
  });
  assert.equal(receipt.status, 'INSUFFICIENT_PROOF');
});

test('proof planner selects invariant oracle for explicit invariant language', () => {
  const plan = generateProofPlan({
    requirement: { statement: 'The same idempotency key must never create a second charge', invariants: ['same key maps to one charge'] },
    risk: 'CRITICAL'
  });
  assert.ok(plan.oracles.some(o => o.type === 'INVARIANT'));
});
