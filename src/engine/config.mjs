import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const defaults = {
  policies: {
    require_evidence_for_confirmed: true,
    no_test_result_without_execution: true,
    require_regression_test_for_confirmed_bug: true,
    no_auto_delete_from_static_signal: true,
  },
  budgets: { max_checks: 50, max_duration_ms: 15 * 60 * 1000 },
};

export function loadQualityConfig(cwd = process.cwd()) {
  const path = join(cwd, 'quality.yaml');
  if (!existsSync(path)) return structuredClone(defaults);
  const raw = readFileSync(path, 'utf8');
  const config = structuredClone(defaults);
  // Intentionally conservative parser: this engine only consumes scalar policy/budget hints.
  for (const line of raw.split(/\\r?\\n/)) {
    const m = line.match(/^\\s{2,}([a-zA-Z0-9_]+):\\s*(true|false|\\d+)\\s*$/);
    if (!m) continue;
    const value = m[2] === 'true' ? true : m[2] === 'false' ? false : Number(m[2]);
    if (m[1] in config.policies) config.policies[m[1]] = value;
  }
  return config;
}
