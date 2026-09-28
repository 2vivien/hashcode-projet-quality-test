import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { detectStack } from '../index.mjs';
import { discoverProject, inferRisk } from './discovery.mjs';
import { loadQualityConfig } from './config.mjs';
import { buildPlan, selectChecks } from './planner.mjs';
import { runCheck } from './runner.mjs';
import { evaluateCheck, buildGate } from './evaluate.mjs';

export async function executeQuality({ cwd = process.cwd(), profile = 'standard', changedFiles = [], timeoutMs = 120000 } = {}) {
  const project = discoverProject(cwd);
  const stack = detectStack(cwd);
  const config = loadQualityConfig(cwd);
  const initialPlan = buildPlan(project, profile);
  const plan = selectChecks(initialPlan, { profile, changedFiles });
  const checks = [];
  const findings = [];

  for (const check of plan) {
    const started = Date.now();
    const result = await runCheck(check, { cwd, timeoutMs });
    const enriched = { ...check, result, durationMs: Date.now() - started };
    checks.push(enriched);
    findings.push(...evaluateCheck(check, result));
  }

  const gate = buildGate({ checks, findings, profile });
  return {
    engineVersion: '2.1.0-gold',
    startedAt: checks[0]?.result?.evidence?.timestamp || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    project: { ...project, stack, inferredRisk: inferRisk(project) },
    plan: { selected: plan.map(x => x.id), totalAvailable: initialPlan.length },
    checks,
    findings,
    gate,
    intelligence: {
      traceability: 'discovery -> risk -> plan -> execution -> evidence -> evaluation -> gate',
      regression: findings.filter(f => f.kind === 'CONFIRMED_DEFECT').map(f => ({ findingId: f.id, tests: f.regressionTests })),
      evidenceComplete: checks.every(c => Boolean(c.result?.evidence)),
      prompt: existsSync(join(cwd, 'prompts/14-test-intelligence.md')) ? 'prompts/14-test-intelligence.md' : null,
    },
  };
}

export function loadPrompt(cwd = process.cwd(), file = 'prompts/14-test-intelligence.md') {
  const path = join(cwd, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}
