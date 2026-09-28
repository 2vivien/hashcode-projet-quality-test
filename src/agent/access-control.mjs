import { resolveRoleHeaders } from './fixtures.mjs';

function materialize(path, params = {}) {
  return path.replace(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, a, b) => encodeURIComponent(String(params[a || b] ?? 'test')));
}

function isAllowed(status) { return status >= 200 && status < 300; }
function isDenied(status) { return status === 401 || status === 403; }

export async function runFunctionAuthorization({ baseUrl, cases = [], fixtures = {}, timeoutMs = 10000, allowMutations = false } = {}) {
  const results = [];
  const findings = [];
  for (const testCase of cases) {
    if (/^(POST|PUT|PATCH|DELETE)$/.test(testCase.method) && !allowMutations) {
      results.push({ ...testCase, status: 'SKIPPED_MUTATION' });
      continue;
    }
    const headers = resolveRoleHeaders(testCase.role, fixtures);
    if (headers == null && testCase.role !== 'anonymous') {
      results.push({ ...testCase, status: 'MISSING_CREDENTIAL' });
      continue;
    }
    const url = new URL(materialize(testCase.path, testCase.params), baseUrl).href;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: testCase.method, headers: { accept: 'application/json', ...(headers || {}) }, signal: controller.signal });
      const passed = testCase.expected === 'deny' ? isDenied(response.status) : isAllowed(response.status);
      const result = { ...testCase, url, status: response.status, passed };
      results.push(result);
      if (!passed) findings.push({
        type: 'FUNCTION_AUTHORIZATION_BYPASS',
        severity: testCase.expected === 'deny' ? 'CRITICAL' : 'HIGH',
        title: 'Function-level authorization mismatch: ' + testCase.method + ' ' + testCase.path,
        summary: testCase.expected === 'deny'
          ? 'A role that should not access the function received an allowed response.'
          : 'A role expected to access the function was denied.',
        evidence: result,
        requirementId: 'function-authorization:' + (testCase.id || testCase.role + ':' + testCase.path)
      });
    } catch (error) {
      results.push({ ...testCase, url, status: 'BLOCKED', error: error.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return { results, findings };
}

function containsProperty(value, target) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => containsProperty(item, target));
  return Object.entries(value).some(([key, child]) => key === target || containsProperty(child, target));
}

export async function runPropertyAuthorization({ baseUrl, cases = [], fixtures = {}, timeoutMs = 10000, allowMutations = false } = {}) {
  const results = [];
  const findings = [];
  for (const testCase of cases) {
    if (/^(POST|PUT|PATCH|DELETE)$/.test(testCase.method) && !allowMutations) {
      results.push({ ...testCase, status: 'SKIPPED_MUTATION' });
      continue;
    }
    const headers = resolveRoleHeaders(testCase.role, fixtures);
    if (headers == null && testCase.role !== 'anonymous') {
      results.push({ ...testCase, status: 'MISSING_CREDENTIAL' });
      continue;
    }
    const url = new URL(materialize(testCase.path, testCase.params), baseUrl).href;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: testCase.method, headers: { accept: 'application/json', ...(headers || {}) }, signal: controller.signal });
      const text = await response.text();
      let body = null; try { body = JSON.parse(text); } catch {}
      const forbidden = (testCase.forbiddenProperties || []).filter(property => containsProperty(body, property));
      const passed = forbidden.length === 0;
      const result = { ...testCase, url, status: response.status, forbiddenObserved: forbidden, passed };
      results.push(result);
      if (!passed) findings.push({
        type: 'OBJECT_PROPERTY_AUTHORIZATION_BYPASS',
        severity: 'HIGH',
        title: 'Sensitive object property exposed: ' + testCase.method + ' ' + testCase.path,
        summary: 'The response exposed one or more properties explicitly marked as forbidden for this role.',
        evidence: { ...result, bodySample: undefined },
        requirementId: 'property-authorization:' + (testCase.id || testCase.role + ':' + testCase.path)
      });
    } catch (error) {
      results.push({ ...testCase, url, status: 'BLOCKED', error: error.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return { results, findings };
}
