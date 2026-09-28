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


export function buildAccessControlProof({ kind, testCase, observation, gitSha = null, runId = null } = {}) {
  const propertyCase = kind === 'property';
  const expected = testCase.expected === 'deny' ? 'deny' : 'allow';
  const requirement = {
    id: (propertyCase ? 'property-authorization:' : 'function-authorization:') + testCase.id,
    statement: propertyCase
      ? 'A role must not receive properties explicitly forbidden by its authorization policy.'
      : expected === 'deny'
        ? 'A role without function permission must be denied.'
        : 'A role with function permission must be allowed.',
    risk: propertyCase || expected === 'deny' ? 'CRITICAL' : 'HIGH',
    requiredEvidence: ['status', 'passed', 'role'],
    acceptanceCriteria: [],
    invariants: [propertyCase ? 'forbidden properties are absent' : 'role/function access policy matches response']
  };
  const statusOracle = createOracle({
    type: 'EXACT',
    criterion: 'HTTP status is compatible with the access policy',
    evidenceRequired: ['status'],
    parameters: { expected: expected === 'deny' ? [401, 403] : { min: 200, max: 299 } }
  });
  const invariantOracle = createOracle({
    type: 'INVARIANT',
    criterion: propertyCase ? 'forbidden properties are absent' : 'function authorization policy holds',
    evidenceRequired: ['invariantValid']
  });
  const statusResult = evaluateOracle(statusOracle, { actual: observation.status, expected: expected === 'deny' ? [401, 403] : { min: 200, max: 299 } });
  const invariantResult = evaluateOracle(invariantOracle, { invariantValid: observation.passed === true });
  const evidenceItem = createEvidence({
    command: testCase.method + ' ' + testCase.path,
    cwd: process.cwd(),
    exitCode: observation.passed ? 0 : 1,
    stdout: JSON.stringify(observation),
    stderr: '',
    durationMs: observation.durationMs || 0,
    tool: 'hashcode-access-control-agent',
    meta: { inputHash: hash({ kind, role: testCase.role, method: testCase.method, path: testCase.path }), role: testCase.role }
  });
  evidenceItem.status = observation.status;
  evidenceItem.passed = observation.passed;
  evidenceItem.role = observation.role;
  const receipt = buildProofReceipt({
    requirement,
    risk: requirement.risk,
    oraclePlan: [statusOracle, invariantOracle],
    oracleResults: [statusResult, invariantResult],
    evidence: [evidenceItem],
    gitSha,
    runId,
    proofPolicy: 'multi_oracle_required'
  });
  return { requirement, receipt };
}

export function buildAccessControlProofSet({ kind, cases = [], gitSha = null, runId = null } = {}) {
  return cases
    .filter(item => Number.isInteger(item.status) && item.passed != null)
    .map(item => buildAccessControlProof({ kind, testCase: item, observation: item, gitSha, runId }));
}
