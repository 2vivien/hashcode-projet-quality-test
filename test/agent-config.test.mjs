import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentConfig } from '../src/agent/config.mjs';

test('agent configuration has safe defaults', () => {
  const config = loadAgentConfig(process.cwd());
  assert.equal(typeof config.max_pages, 'number');
  assert.equal(config.allow_mutations, false);
  assert.equal(config.open_issues, false);
});
