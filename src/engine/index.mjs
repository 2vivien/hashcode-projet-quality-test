import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectStack } from '../index.mjs';
import { discoverProject, inferRisk } from './discovery.mjs';
import { loadQualityConfig } from './config.mjs';
import { buildPlan, selectChecks } from './planner.mjs';
import { runCheck } from './runner.mjs';
import { evaluateCheck, buildGate } from './evaluate.mjs';

function gitSha(cwd) {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function gitChangedFiles(cwd) {
  const r = spawnSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\\r?\\n/).filter(Boolean) : [];
}

function persistRun(cwd, result) {
  const dir = join(cwd, '.hashcode-quality', 'runs');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${result.finishedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  return file;
}

export async function executeQuality({ cwd = process.cwd(), profile = 'standard', changedFiles = [], timeoutMs = 120000, persist = true } = {}) {
  const startedAt = new Date().toISOString();
  const project = discoverProject(cwd);
  const stack = detectStack(cwd);
  const config = loadQualityConfig(cwd);
  const detectedChanges = changedFiles.length ? changedFiles : gitChangedFiles(cwd);
  const initialPlan = buildPlan(project, profile);
  const plan = selectChecks(initialPlan, { profile, changedFiles: detectedChanges });
  const checks = [];
  const findings = [...plan.gaps.map(g => ({
    id: `gap_${g.id}`, kind: 'MISSING_EVIDENCE', severity: 'MEDIUM', confidence: 1,
    title: `Preuve manquante: ${g.id}`,
    summary: `Aucun script projet '${g.expected}' n'est disponible pour exécuter ce contrôle.`,
    location: 'package.json', evidence: [], regressionTests: []
  }))];

  for (const check of plan.checks) {
    const result = await runCheck(check, { cwd, timeoutMs });
    const enriched = { ...check, result };
    checks.push(enriched);
    findings.push(...evaluateCheck(check, result));
  }

  const gate = buildGate({ checks, findings, profile });
  const finishedAt = new Date().toISOString();
  const result = {
    engineVersion: '2.2.0-gold',
    startedAt, finishedAt, gitSha: gitSha(cwd),
    project: { ...project, stack, inferredRisk: inferRisk(project) },
    plan: { selected: plan.checks.map(x => x.id), totalAvailable: initialPlan.checks.length, gaps: plan.gaps },
    checks, findings, gate,
    intelligence: {
      traceability: 'discovery -> risk -> plan -> execution -> evidence -> evaluation -> gate',
      regression: findings.filter(f => f.kind === 'CONFIRMED_DEFECT').map(f => ({ findingId: f.id, tests: f.regressionTests })),
      evidenceComplete: checks.every(c => Boolean(c.result?.evidence)),
      changedFiles: detectedChanges,
      prompt: existsSync(join(cwd, 'prompts/14-test-intelligence.md')) ? 'prompts/14-test-intelligence.md' : null,
      configLoaded: Boolean(config)
    }
  };
  if (persist) result.reportFile = persistRun(cwd, result);
  return result;
}

export function loadPrompt(cwd = process.cwd(), file = 'prompts/14-test-intelligence.md') {
  const path = join(cwd, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}
