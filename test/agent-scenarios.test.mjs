import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScenarios, prioritizeScenarios } from '../src/agent/scenarios.mjs';

test('agent generates and prioritizes risk scenarios', () => {
  const scenarios = generateScenarios({
    surface: {
      routes: [{ path: '/', dynamic: false }],
      apiRoutes: [{ path: '/api/users/:id', method: 'GET' }],
      openapi: []
    },
    roles: [{ role: 'admin' }],
    max: 50
  });
  assert.ok(scenarios.some(x => x.kind === 'authorization_object'));
  const ordered = prioritizeScenarios(scenarios);
  assert.equal(ordered[0].risk, 'CRITICAL');
});
