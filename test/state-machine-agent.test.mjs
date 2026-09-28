import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStateMachine } from '../src/agent/state-machine.mjs';

test('state machine respects mutation safety', () => {
  const workflows = buildStateMachine({
    workflows: [{ id: 'w', steps: [{ method: 'POST', path: '/api/users' }, { method: 'GET', path: '/api/users/{id}' }] }],
    allowMutations: false
  });
  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].steps[0].method, 'POST');
});
