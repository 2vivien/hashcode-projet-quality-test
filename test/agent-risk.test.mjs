import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreScenario, prioritizeByRisk } from '../src/agent/risk.mjs';

test('risk scorer raises object authorization scenarios', () => {
  const scored = scoreScenario({ path: '/api/users/{id}', method: 'GET', role: 'owner', security: true });
  assert.equal(scored.risk, 'CRITICAL');
  assert.ok(scored.score >= 75);
});

test('risk prioritization is deterministic', () => {
  const result = prioritizeByRisk([
    { id: 'low', path: '/', method: 'GET' },
    { id: 'high', path: '/api/users/{id}', method: 'GET', role: 'user', security: true }
  ]);
  assert.equal(result[0].id, 'high');
});
