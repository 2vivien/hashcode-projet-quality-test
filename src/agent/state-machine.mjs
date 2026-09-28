import { createHash } from 'node:crypto';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

function resolveTemplate(path, state = {}) {
  return path.replace(/\{([^}]+)\}|:([a-zA-Z_][a-zA-Z0-9_]*)/g, function (_, brace, colon) {
    const key = brace || colon;
    return encodeURIComponent(String(state[key] ?? state.id ?? 'missing-' + key));
  });
}

function extractIds(body) {
  const ids = [];
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    for (const [key, child] of Object.entries(value)) {
      if (/^(id|.*Id|.*_id)$/i.test(key) && (typeof child === 'string' || typeof child === 'number')) ids.push({ key, value: child });
      else walk(child);
    }
  };
  walk(body);
  return ids;
}

export function buildStateMachine({ endpoints = [], workflows = [], maxSteps = 6, allowMutations = false } = {}) {
  if (workflows.length) return workflows.map((workflow, index) => ({ id: workflow.id || 'workflow-' + index, steps: workflow.steps || [], maxSteps: workflow.maxSteps || maxSteps }));
  const safe = endpoints.filter(e => allowMutations || !/^(POST|PUT|PATCH|DELETE)$/.test(e.method));
  const chains = [];
  for (const start of safe) {
    const steps = [start];
    let current = start;
    for (let i = 1; i < maxSteps; i++) {
      const next = safe.find(candidate => candidate.path !== current.path && [...(candidate.path.matchAll(/\{([^}]+)\}/g))].some(m => current.path.includes('/' + m[1]) || candidate.path.includes(':' + m[1])));
      if (!next) break;
      steps.push(next);
      current = next;
    }
    if (steps.length > 1) chains.push({ id: 'auto-' + hash(steps), steps });
  }
  return chains;
}

export async function runStateMachine({ baseUrl, workflows = [], fixtures = {}, timeoutMs = 10000, allowMutations = false } = {}) {
  if (!baseUrl) return { status: 'BLOCKED', workflows: [], findings: [] };
  const results = [];
  const findings = [];
  for (const workflow of workflows) {
    const state = {};
    const steps = [];
    for (const definition of workflow.steps.slice(0, workflow.maxSteps || 6)) {
      const mutation = /^(POST|PUT|PATCH|DELETE)$/.test(definition.method);
      if (mutation && !allowMutations) { steps.push({ ...definition, status: 'SKIPPED_MUTATION' }); continue; }
      const path = resolveTemplate(definition.path, state);
      const url = new URL(path, baseUrl).href;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = Date.now();
      try {
        const response = await fetch(url, { method: definition.method, headers: { accept: 'application/json', ...(definition.headers || {}) }, signal: controller.signal });
        const text = await response.text();
        let body = null; try { body = JSON.parse(text); } catch {}
        for (const item of extractIds(body)) state[item.key] = item.value;
        const step = { method: definition.method, path: definition.path, url, status: response.status, durationMs: Date.now() - started, state: { ...state }, bodySample: text.slice(0, 2000) };
        steps.push(step);
        if (response.status >= 500) findings.push({ type: 'STATE_MACHINE_SERVER_ERROR', severity: 'HIGH', title: 'State-machine step returned 5xx: ' + definition.method + ' ' + definition.path, summary: 'A multi-step API workflow produced a server error.', evidence: step });
      } catch (error) {
        steps.push({ method: definition.method, path: definition.path, url, status: 'BLOCKED', error: error.message });
      } finally {
        clearTimeout(timer);
      }
    }
    results.push({ id: workflow.id, steps, finalState: state });
  }
  return { status: 'PASS', workflows: results, findings };
}
