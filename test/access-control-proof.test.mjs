import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccessControlProof } from '../src/agent/proof.mjs';

test('function authorization proof requires two oracle types', () => {
  const proof = buildAccessControlProof({
    kind: 'function',
    testCase: { id: 'admin-deny', method: 'GET', path: '/api/admin', role: 'user', expected: 'deny' },
    observation: { status: 403, passed: true, role: 'user', durationMs: 2 }
  });
  assert.equal(proof.receipt.status, 'PROVEN');
  assert.equal(new Set(proof.receipt.oracles.map(x => x.type)).size, 2);
});

test('property authorization proof detects exposed fields', () => {
  const proof = buildAccessControlProof({
    kind: 'property',
    testCase: { id: 'private', method: 'GET', path: '/api/users/{id}', role: 'user' },
    observation: { status: 200, passed: false, role: 'user', durationMs: 2 }
  });
  assert.equal(proof.receipt.status, 'NOT_PROVEN');
});
