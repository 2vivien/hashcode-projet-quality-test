import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizationProof } from '../src/agent/proof.mjs';

test('critical authorization proof uses two oracle types', () => {
  const proof = buildAuthorizationProof({
    testCase: { id: 'cross', method: 'GET', path: '/api/users/{id}', role: 'other', objectId: '1', expected: 'deny' },
    observation: { status: 403, passed: true, role: 'other', objectId: '1', durationMs: 3 }
  });
  assert.equal(proof.receipt.status, 'PROVEN');
  assert.equal(new Set(proof.receipt.oracles.map(x => x.type)).size, 2);
});
