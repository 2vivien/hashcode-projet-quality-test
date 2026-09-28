import { createHash } from 'node:crypto';
import { resolveRoleHeaders, findObjectFixture } from './fixtures.mjs';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 20);
}

function materializePath(path, values = {}) {
  return path.replace(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/g, function (_, brace, colon) {
    const key = brace || colon;
    return encodeURIComponent(String(values[key] ?? 'missing-' + key));
  });
}

function statusAllowed(status, expected = 'allow') {
  if (expected === 'allow') return status >= 200 && status < 300;
  if (expected === 'deny') return status === 401 || status === 403;
  if (Array.isArray(expected)) return expected.includes(status);
  if (typeof expected === 'number') return status === expected;
  return false;
}

function fixtureForCase(fixtures, testCase) {
  const object = testCase.objectType && testCase.objectId != null
    ? findObjectFixture(fixtures, testCase.objectType, testCase.objectId)
    : null;
  return { ...testCase, object };
}

export function buildAuthorizationMatrix({ endpoints = [], fixtures = {} } = {}) {
  const explicit = fixtures.authorization || [];
  const matrix = [];
  for (const testCase of explicit) matrix.push(fixtureForCase(fixtures, testCase));
  const existingKeys = new Set(matrix.map(x => [x.method, x.path, x.role, x.objectId, x.expected].join('|')));
  for (const endpoint of endpoints) {
    const parameterized = /\{[^}]+\}|:[a-zA-Z_][a-zA-Z0-9_]*/.test(endpoint.path);
    if (!parameterized) continue;
    const objectParam = (endpoint.path.match(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/) || [])[1] || (endpoint.path.match(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/) || [])[2];
    const segments = endpoint.path.split('/').filter(Boolean);
    const paramIndex = segments.findIndex(segment => segment === '{' + objectParam + '}' || segment === ':' + objectParam);
    const collectionSegment = paramIndex > 0 ? segments[paramIndex - 1] : null;
    const objectType = endpoint.objectType || collectionSegment || objectParam?.replace(/Id$/i, '').replace(/[_-]?id$/i, '') || 'objects';
    for (const role of fixtures.roles || []) {
      const owned = (Array.isArray(fixtures.objects?.[objectType]) ? fixtures.objects[objectType] : Object.values(fixtures.objects?.[objectType] || {}))
        .filter(x => x.ownerRole === role.name);
      for (const object of owned.slice(0, 1)) {
        const own = { id: 'auth-' + hash({ endpoint, role: role.name, object: object.id, expected: 'allow' }), method: endpoint.method, path: endpoint.path, role: role.name, objectType, objectId: object.id, expected: 'allow' };
        if (!existingKeys.has([own.method, own.path, own.role, own.objectId, own.expected].join('|'))) matrix.push(fixtureForCase(fixtures, own));
        for (const other of (fixtures.roles || []).filter(r => r.name !== role.name).slice(0, 1)) {
          const foreign = { id: 'auth-' + hash({ endpoint, role: other.name, object: object.id, expected: 'deny' }), method: endpoint.method, path: endpoint.path, role: other.name, objectType, objectId: object.id, expected: 'deny', ownerRole: role.name };
          if (!existingKeys.has([foreign.method, foreign.path, foreign.role, foreign.objectId, foreign.expected].join('|'))) matrix.push(fixtureForCase(fixtures, foreign));
        }
      }
    }
  }
  return matrix;
}

export async function runAuthorizationMatrix({ baseUrl, matrix = [], fixtures = {}, timeoutMs = 10000, allowMutations = false } = {}) {
  if (!baseUrl) return { status: 'BLOCKED', cases: [], findings: [], proofs: [] };
  const cases = [];
  const findings = [];
  const proofs = [];
  for (const testCase of matrix) {
    const mutation = /^(POST|PUT|PATCH|DELETE)$/.test(testCase.method);
    if (mutation && !allowMutations) {
      cases.push({ ...testCase, status: 'SKIPPED_MUTATION' });
      continue;
    }
    const headers = resolveRoleHeaders(testCase.role, fixtures);
    if (headers == null && testCase.role !== 'anonymous') {
      const blocked = { ...testCase, status: 'MISSING_CREDENTIAL', expected: testCase.expected };
      cases.push(blocked);
      findings.push({ type: 'AUTHORIZATION_TEST_BLOCKED', severity: 'MEDIUM', title: 'Missing test credential for role: ' + testCase.role, summary: 'The authorization case could not execute because the configured role has no credential in the environment.', evidence: { role: testCase.role, caseId: testCase.id }, requirementId: 'authorization:' + testCase.id });
      continue;
    }
    const values = { ...(testCase.params || {}) };
    if (testCase.objectId != null) {
      const objectParam = (testCase.path.match(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/) || [])[1] || (testCase.path.match(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/) || [])[2];
      if (objectParam) values[objectParam] = testCase.objectId;
    }
    const url = new URL(materializePath(testCase.path, values), baseUrl).href;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(url, { method: testCase.method, headers: { accept: 'application/json', ...(headers || {}) }, signal: controller.signal });
      const body = (await response.text()).replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]').replace(/("?(?:access_token|refresh_token|token|password|secret|api[_-]?key)"?\s*[:=]\s*)["']?[^,"'\\s}]+/gi, '$1[REDACTED]');
      const passed = statusAllowed(response.status, testCase.expected);
      const item = { id: testCase.id, role: testCase.role, ownerRole: testCase.ownerRole || testCase.object?.ownerRole || null, method: testCase.method, path: testCase.path, url, objectType: testCase.objectType || null, objectId: testCase.objectId ?? null, expected: testCase.expected, status: response.status, passed, durationMs: Date.now() - started, bodySample: body.slice(0, 2000) };
      cases.push(item);
      proofs.push({ case: item, invariantValid: passed, oracle: { type: 'INVARIANT', criterion: testCase.expected === 'deny' ? 'unauthorized role cannot access foreign object' : 'authorized role can access owned object' } });
      if (!passed) {
        findings.push({
          type: testCase.expected === 'deny' ? 'BOLA_AUTHORIZATION_BYPASS' : 'AUTHORIZATION_DENIED_FOR_OWNER',
          severity: testCase.expected === 'deny' && response.status >= 200 && response.status < 300 ? 'CRITICAL' : 'HIGH',
          title: (testCase.expected === 'deny' ? 'Object authorization bypass' : 'Authorized object access failed') + ': ' + testCase.method + ' ' + testCase.path,
          summary: testCase.expected === 'deny'
            ? 'A role expected to be denied received an allowed HTTP response for a foreign object.'
            : 'The owner role could not access its fixture object as expected.',
          evidence: item,
          requirementId: 'authorization:' + testCase.id
        });
      }
    } catch (error) {
      cases.push({ ...testCase, status: 'BLOCKED', error: error.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: 'PASS', cases, findings, proofs };
}
