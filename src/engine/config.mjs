import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const defaults = {
  policies: { require_evidence_for_confirmed: true, no_test_result_without_execution: true, require_regression_test_for_confirmed_bug: true, no_auto_delete_from_static_signal: true },
  budgets: { max_checks: 50, max_duration_ms: 15 * 60 * 1000 },
  requirements: []
};

function scalar(value) {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try { return JSON.parse(v); } catch { return v; }
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function listValue(lines, start) {
  const values = [];
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^\s{6}-\s*(.+)$/);
    if (m) { values.push(scalar(m[1])); continue; }
    if (lines[i].trim() && !/^\s{6}/.test(lines[i])) break;
  }
  return { values, end: start + values.length };
}

function parseRequirements(raw) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex(line => /^requirements:\s*$/.test(line.trim()));
  if (start < 0) return [];
  const out = []; let current = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim()) break;
    const item = line.match(/^\s{2}-\s*id:\s*(.+)$/);
    if (item) { current = { id: scalar(item[1]), acceptance_criteria: [], invariants: [], required_evidence: [] }; out.push(current); continue; }
    if (!current) continue;
    const field = line.match(/^\s{4}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!field) continue;
    const [, key, value] = field;
    if (value) current[key] = scalar(value);
    else if (['acceptance_criteria','invariants','required_evidence'].includes(key)) {
      const parsed = listValue(lines, i + 1); current[key] = parsed.values; i = parsed.end - 1;
    }
  }
  return out;
}

export function loadQualityConfig(cwd = process.cwd()) {
  const path = join(cwd, 'quality.yaml');
  if (!existsSync(path)) return structuredClone(defaults);
  const raw = readFileSync(path, 'utf8');
  const config = structuredClone(defaults);
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s{2,}([a-zA-Z0-9_]+):\s*(true|false|\d+)\s*$/);
    if (!m) continue;
    const value = scalar(m[2]);
    if (m[1] in config.policies) config.policies[m[1]] = value;
  }
  config.requirements = parseRequirements(raw);
  return config;
}
