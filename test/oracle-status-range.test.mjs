import test from 'node:test';
import assert from 'node:assert/strict';
import { createOracle, evaluateOracle } from '../src/engine/oracle.mjs';

test('exact oracle accepts status sets and ranges', () => {
  const deny = createOracle({ type: 'EXACT', criterion: 'deny', evidenceRequired: ['status'] });
  assert.equal(evaluateOracle(deny, { actual: 403, expected: [401, 403], status: 403 }).verdict, 'PASS');
  const allow = createOracle({ type: 'EXACT', criterion: 'allow', evidenceRequired: ['status'] });
  assert.equal(evaluateOracle(allow, { actual: 201, expected: { min: 200, max: 299 }, status: 201 }).verdict, 'PASS');
});
