import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function scalar(value) {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

export function loadAgentConfig(cwd = process.cwd()) {
  const file = join(cwd, 'quality.yaml');
  const defaults = { base_url: null, start_command: null, max_pages: 30, max_depth: 2, max_scenarios: 100, timeout_ms: 15000, allow_mutations: false, open_issues: false, publish_artifacts: true };
  if (!existsSync(file)) return defaults;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex(function (line) { return /^agent:\s*$/.test(line.trim()); });
  if (start < 0) return defaults;
  const result = { ...defaults };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim()) break;
    const match = line.match(/^\s{2}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (match && match[2]) result[match[1]] = scalar(match[2]);
  }
  return result;
}
