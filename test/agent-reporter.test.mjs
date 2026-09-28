import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint } from '../src/agent/github-reporter.mjs';

test('agent finding fingerprint is deterministic', () => {
  const finding = { type: 'BROWSER_FAILURE', title: 'broken page', summary: 'error', evidence: { url: 'http://localhost:3000/x', method: 'GET' } };
  assert.equal(fingerprint(finding), fingerprint(JSON.parse(JSON.stringify(finding))));
});
