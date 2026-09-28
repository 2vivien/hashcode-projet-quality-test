import { createHash } from 'node:crypto';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

export function generateScenarios({ surface, roles = [], max = 100, allowMutations = false } = {}) {
  const scenarios = [];
  const uncovered = new Set(surface && surface.uncoveredRoutes || []);
  for (const route of surface && surface.routes || []) {
    scenarios.push({ id: 'page-' + hash({ route: route.path, type: 'navigation' }), kind: uncovered.has(route.path) ? 'uncovered_navigation' : 'navigation', risk: uncovered.has(route.path) ? 'HIGH' : (route.path === '/' ? 'MEDIUM' : 'HIGH'), path: route.path, method: 'GET', role: 'anonymous' });
    scenarios.push({ id: 'page-' + hash({ route: route.path, type: 'browser_health' }), kind: 'browser_health', risk: 'HIGH', path: route.path, method: 'GET', role: 'anonymous' });
    if (route.dynamic) scenarios.push({ id: 'page-' + hash({ route: route.path, type: 'not-found' }), kind: 'negative_navigation', risk: 'MEDIUM', path: route.path.replace(/:[^/]+/g, 'nonexistent'), method: 'GET', role: 'anonymous' });
  }
  for (const endpoint of [...(surface && surface.openapi || []), ...(surface && surface.apiRoutes || [])]) {
    const mutation = /^(POST|PUT|PATCH|DELETE)$/.test(endpoint.method);
    if (mutation && !allowMutations) continue;
    scenarios.push({ id: 'api-' + hash({ endpoint, role: 'anonymous' }), kind: 'api_contract', risk: mutation ? 'HIGH' : 'MEDIUM', path: endpoint.path, method: endpoint.method, role: 'anonymous' });
    if (/\{[^}]+\}/.test(endpoint.path)) scenarios.push({ id: 'api-' + hash({ endpoint, type: 'object-access' }), kind: 'authorization_object', risk: 'CRITICAL', path: endpoint.path, method: endpoint.method, role: 'anonymous', security: 'BOLA' });
  }
  for (const roleItem of roles) {
    const role = roleItem.role || roleItem;
    for (const route of surface && surface.routes || []) scenarios.push({ id: 'role-' + hash({ role, path: route.path }), kind: 'role_navigation', risk: 'HIGH', path: route.path, method: 'GET', role });
  }
  return scenarios.slice(0, Math.max(1, max));
}

export function prioritizeScenarios(scenarios = []) {
  const weight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return [...scenarios].sort(function (a, b) { return (weight[b.risk] || 0) - (weight[a.risk] || 0); });
}