import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizationMatrix } from '../src/agent/authorization.mjs';

test('authorization matrix creates owner and cross-owner cases', () => {
  const matrix = buildAuthorizationMatrix({
    endpoints: [{ method: 'GET', path: '/api/users/{id}' }],
    fixtures: {
      roles: [{ name: 'owner' }, { name: 'other' }],
      objects: { users: [{ id: '1', ownerRole: 'owner' }] },
      authorization: []
    }
  });
  assert.ok(matrix.some(x => x.expected === 'allow' && x.role === 'owner'));
  assert.ok(matrix.some(x => x.expected === 'deny' && x.role === 'other'));
});
