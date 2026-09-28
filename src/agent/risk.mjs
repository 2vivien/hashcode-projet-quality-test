const WEIGHTS = Object.freeze({
  criticalObject: 40,
  mutation: 25,
  protected: 20,
  admin: 20,
  sensitive: 15,
  uncovered: 10,
  publicRead: 5
});

export function scoreScenario(scenario = {}) {
  let score = 0;
  const path = String(scenario.path || '').toLowerCase();
  if (/\{[^}]+\}|:[a-z_][a-z0-9_]*/i.test(path)) score += WEIGHTS.criticalObject;
  if (/^(POST|PUT|PATCH|DELETE)$/i.test(scenario.method)) score += WEIGHTS.mutation;
  if (scenario.security || scenario.role && scenario.role !== 'anonymous') score += WEIGHTS.protected;
  if (/admin|manage|billing|payment|payout|permission|role|credential|secret/i.test(path)) score += WEIGHTS.admin;
  if (/password|token|secret|invoice|money|payment|email|phone|location/i.test(path)) score += WEIGHTS.sensitive;
  if (scenario.kind === 'uncovered_navigation') score += WEIGHTS.uncovered;
  if (scenario.role === 'anonymous' && /^GET$/i.test(scenario.method)) score += WEIGHTS.publicRead;
  score = Math.min(100, score);
  const risk = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
  return { score, risk };
}

export function prioritizeByRisk(scenarios = []) {
  return scenarios
    .map(scenario => ({ ...scenario, ...scoreScenario(scenario) }))
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}
