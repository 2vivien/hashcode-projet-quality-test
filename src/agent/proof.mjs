import { createHash } from 'node:crypto';
import { createEvidence } from '../engine/model.mjs';
import { createOracle, evaluateOracle } from '../engine/oracle.mjs';
import { buildProofReceipt } from '../engine/proof-ledger.mjs';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function expectedStatus(testCase) {
  if (testCase.expected === 'deny') return testCase.expectedStatus || [401, 403];
  return testCase.expectedStatus || { min: 200, max: 299 };
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

  const statusOracle = createOracle({
    type: 'EXACT',
    criterion: 'HTTP status satisfies the authorization expectation',
    evidenceRequired: ['status'],
    parameters: { expected: expectedStatus(testCase) }
  });
  const invariantOracle = createOracle({
    type: 'INVARIANT',
    criterion: expected === 'deny' ? 'foreign object access is denied' : 'owned object access is allowed',
    evidenceRequired: ['invariantValid'],
    parameters: { expected }
  });

  const statusResult = evaluateOracle(statusOracle, {
    actual: observation.status,
    expected: expectedStatus(testCase),
    status: observation.status
  });
  const invariantResult = evaluateOracle(invariantOracle, {
    invariantValid: observation.passed === true
  });

  const evidenceItem = createEvidence({
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
      expectedStatus: expectedStatus(testCase),
      observedStatus: observation.status
    }
  });
  evidenceItem.status = observation.status;
  evidenceItem.passed = observation.passed;
  evidenceItem.role = observation.role;
  evidenceItem.objectId = observation.objectId;
  const evidence = [evidenceItem];

  const receipt = buildProofReceipt({
    requirement,
    risk: requirement.risk,
    oraclePlan: [statusOracle, invariantOracle],
    oracleResults: [statusResult, invariantResult],
    evidence,
    gitSha,
    runId,
    proofPolicy: 'multi_oracle_required'
  });

  return {
    requirement,
    oracle: [statusOracle, invariantOracle],
    result: [statusResult, invariantResult],
    evidence,
    receipt
  };
}

export function buildAuthorizationProofSet({ cases = [], gitSha = null, runId = null } = {}) {
  return cases
    .filter(item => Number.isInteger(item.status) && item.passed != null)
    .map(item => buildAuthorizationProof({ testCase: item, observation: item, gitSha, runId }));
}
