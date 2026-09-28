import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrozenHarness, verifyFrozenHarness, detectHarnessMutation } from '../src/engine/harness.mjs';
import { createDataset, verifyDataset } from '../src/engine/dataset.mjs';
import { loadRequirements } from '../src/engine/requirements.mjs';
import { buildProofGraph } from '../src/engine/proof-graph.mjs';
import { buildProofReceipt } from '../src/engine/proof-ledger.mjs';

test('frozen harness has stable identity and detects mutation', () => {
  const harness = createFrozenHarness({ id: 'h1', oraclePlans: [{ type: 'EXACT', criterion: 'x' }] });
  assert.equal(harness.frozen, true);
  assert.equal(verifyFrozenHarness(harness, harness.harnessHash).valid, true);
  const mutated = { ...harness, thresholds: { min: 0.99 } };
  assert.equal(detectHarnessMutation(harness, mutated).mutated, true);
});

test('dataset identity is content-addressed', () => {
  const dataset = createDataset({ id: 'golden', version: '1', cases: [{ id: 'a', input: 'x', expected: 'y' }] });
  assert.equal(verifyDataset(dataset, dataset.hash).valid, true);
  assert.equal(verifyDataset({ ...dataset, cases: [{ id: 'a', input: 'tampered', expected: 'y' }] }).valid, false);
});

test('proof graph contains requirement, criteria, invariant, oracle, execution, evidence and proof', () => {
  const requirements = [{ id: 'login', statement: 'User can log in', risk: 'HIGH', acceptanceCriteria: ['returns session'], invariants: ['session belongs to user'] }];
  const assessment = { checkId: 'login', plan: { oracles: [{ type: 'INVARIANT', criterion: 'session belongs to user', evaluator: 'deterministic', evidenceRequired: ['databaseState'] }] }, receipt: { status: 'PROVEN', confidence: 1, proofHash: 'abc', oracles: [{ verdict: 'PASS', confidence: 1 }] } };
  const checks = [{ id: 'login', purpose: 'User can log in', risk: 'HIGH', category: 'auth', result: { status: 'PASS', exitCode: 0, evidence: { id: 'ev1', tool: 'shell', command: 'test', timestamp: '2026-09-28T00:00:00Z' } } }];
  const graph = buildProofGraph({ requirements, proofAssessments: [assessment], checks, gate: { status: 'PASS', reasons: [] }, gitSha: 'abc' });
  for (const type of ['requirement','acceptance_criterion','invariant','risk','oracle','execution','evidence','evaluation','proof','gate']) assert.ok(graph.nodes.some(n => n.type === type), `missing ${type}`);
  assert.match(graph.graphHash, /^[a-f0-9]{64}$/);
});

test('proof receipt recognizes real evidence object keys without synthetic keys metadata', () => {
  const receipt = buildProofReceipt({ requirement: { id: 'r', statement: 'command succeeds', requiredEvidence: ['exitCode'] }, oraclePlan: [{ type: 'EXACT', criterion: 'exit code is zero', evidenceRequired: ['exitCode'] }], oracleResults: [{ verdict: 'PASS', confidence: 1 }], evidence: [{ id: 'ev1', exitCode: 0, timestamp: '2026-09-28T00:00:00Z' }], gitSha: 'abc', runId: 'run1' });
  assert.equal(receipt.status, 'PROVEN');
});

test('requirements parser preserves acceptance criteria and invariants', () => {
  const config = { requirements: [{ id: 'payment', statement: 'Payment is idempotent', risk: 'CRITICAL', acceptance_criteria: ['one charge'], invariants: ['same key never charges twice'], required_evidence: ['databaseState'] }] };
  const [r] = loadRequirements(config);
  assert.equal(r.id, 'payment');
  assert.deepEqual(r.acceptanceCriteria, ['one charge']);
  assert.deepEqual(r.invariants, ['same key never charges twice']);
  assert.equal(r.risk, 'CRITICAL');
});
