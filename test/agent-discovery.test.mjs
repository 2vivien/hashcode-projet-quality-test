import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverApplicationSurface } from '../src/agent/route-discovery.mjs';

test('agent discovers the repository application surface without crashing', () => {
  const surface = discoverApplicationSurface(process.cwd());
  assert.ok(Array.isArray(surface.routes));
  assert.ok(Array.isArray(surface.apiRoutes));
  assert.ok(Array.isArray(surface.openapi));
  assert.ok(surface.filesScanned > 0);
});
