import { createHash } from 'node:crypto';
import { createEvidence } from '../engine/model.mjs';
import { createOracle, evaluateOracle } from '../engine/oracle.mjs';
import { buildProofReceipt } from '../engine/proof-ledger.mjs';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

export function buildAuthorizationProof({ testCase, observation, gitSha = null, runId = null } = {}) {
  const expected = testCase.expected === 'deny' ? 'deny' : 'allow';
  const requirement = {
    id: 'authorization:' + testCase.id,
    statement: expected === 'deny'
      ? 'A non-authorized role must be denied access to a foreign object.'
      : 'An authorized owner role must be able to access its own object.',
    risk: expected === 'deny' ? 'CRITICAL' : 'HIGH',
    requiredEvidence: ['status', 'passed', 'role', 'objectId'],
    acceptanceCriteria: [],
    invariants: ['authorization policy matches observed HTTP response'],
    scope: { method: testCase.method, path: testCase.path, role: testCase.role, objectId: testCase.objectId }
  };
  const oracle = createOracle({
    type: 'INVARIANT',
    criterion: expected === 'deny' ? 'foreign object access is denied' : 'owned object access is allowed',
    evidenceRequired: ['invariantValid'],
    parameters: { expected }
  });
  const result = evaluateOracle(oracle, { invariantValid: observation.passed === true });
  const evidence = [createEvidence({
    command: testCase.method + ' ' + testCase.path,
    cwd: process.cwd(),
    exitCode: observation.passed ? 0 : 1,
    stdout: JSON.stringify(observation),
    stderr: '',
    durationMs: observation.durationMs || 0,
    tool: 'hashcode-authorization-agent',
    meta: {
      inputHash: hash({ role: testCase.role, objectId: testCase.objectId, method: testCase.method, path: testCase.path }),
      authorizationRole: testCase.role,
      objectId: testCase.objectId,
      expected,
      observedStatus: observation.status
    }
  })];
  const receipt = buildProofReceipt({
    requirement,
    risk: requirement.risk,
    oraclePlan: [oracle],
    oracleResults: [result],
    evidence,
    gitSha,
    runId,
    proofPolicy: requirement.risk === 'CRITICAL' ? 'multi_oracle_required' : 'deterministic_first'
  });
  return { requirement, oracle, result, evidence, receipt };
}

export function buildAuthorizationProofSet({ cases = [], gitSha = null, runId = null } = {}) {
  return cases
    .filter(item => item.status >= 100 && item.status <= 599 && item.passed != null)
    .map(item => buildAuthorizationProof({ testCase: item, observation: item, gitSha, runId }));
}
