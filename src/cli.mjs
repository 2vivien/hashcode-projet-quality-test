#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { detectStack, PROFILES } from './index.mjs';
import { executeQuality, loadPrompt, explainRunProof } from './engine/index.mjs';

const cwd = process.cwd();
const args = process.argv.slice(2);
const command = args[0] || 'check';
const profileArg = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : 'standard';
const json = args.includes('--json');
const root = dirname(dirname(fileURLToPath(import.meta.url)));

function say(data) { console.log(json ? JSON.stringify(data, null, 2) : data); }
function toolExists(name) { return spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' }).status === 0; }

function init() {
  const config = `version: 2
name: hashcode-universal-quality
profile: standard

policies:
  evidence_required: true
  no_auto_delete: true
  require_regression_test_for_confirmed_bug: true
`;
  const path = join(cwd, 'quality.yaml');
  if (!existsSync(path)) writeFileSync(path, config);
  say(json ? { initialized: true, file: 'quality.yaml' } : 'HashCode Quality initialisé dans ce projet.');
}

function doctor() {
  const stack = detectStack(cwd);
  const tools = ['node', 'pnpm', 'npm', 'git', 'knip', 'eslint', 'tsc', 'vitest', 'playwright', 'gitleaks', 'semgrep', 'trivy', 'syft', 'k6'];
  const result = Object.fromEntries(tools.map((tool) => [tool, toolExists(tool)]));
  say(json ? { stack, tools: result } : `${JSON.stringify(stack, null, 2)}

Outils disponibles:
${Object.entries(result).map(([k,v]) => `- ${k}: ${v ? 'OK' : 'absent'}`).join('\n')}`);
}

function audit() {
  const stack = detectStack(cwd);
  const recommendations = [];
  if (stack.nextjs || stack.react || stack.typescript) recommendations.push('Knip', 'ESLint', 'TypeScript', 'Vitest', 'Playwright');
  if (stack.prisma) recommendations.push('Prisma validate + migrations + PostgreSQL integration tests');
  if (stack.python) recommendations.push('Ruff', 'Pyright/mypy', 'pytest', 'Semgrep');
  if (stack.docker) recommendations.push('Trivy', 'Syft');
  if (stack.ai) recommendations.push('LLM evaluation, prompt injection, tool authorization, data leakage, cost/latency');
  recommendations.push('Gitleaks', 'Semgrep');
  const unique = [...new Set(recommendations)];
  say(json ? { stack, recommendations: unique } : `HASHCODE QUALITY AUDIT

Stack détectée:
${JSON.stringify(stack, null, 2)}

Contrôles recommandés:
${unique.map(x => `- ${x}`).join('\n')}`);
}

async function check() {
  const profile = PROFILES[profileArg] ? profileArg : 'standard';
  const changedFiles = args.filter((x) => x.startsWith('--changed-file=')).map((x) => x.slice(15));
  const result = await executeQuality({ cwd, profile, changedFiles });
  if (json) {
    say(result);
  } else {
    console.log(`HASHCODE QUALITY ENGINE ${result.engineVersion}
Profile: ${profile}
Risk: ${result.project.inferredRisk}
Checks: ${result.checks.length}
Findings: ${result.findings.length}
Gate: ${result.gate.status}
Evidence: ${result.intelligence.evidenceComplete ? 'complete' : 'incomplete'}`);
    for (const c of result.checks) console.log(`- ${c.id}: ${c.result.status} (${c.durationMs}ms)`);
    for (const f of result.findings) console.log(`- [${f.kind}] ${f.title}`);
  }
  process.exitCode = result.gate.status === 'FAIL' ? 1 : 0;
}


function latestRun() {
  const dir = join(cwd, '.hashcode-quality', 'runs');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  if (!files.length) return null;
  return JSON.parse(readFileSync(join(dir, files.at(-1)), 'utf8'));
}

function prove() {
  const run = latestRun();
  if (!run) { console.error('Aucun run disponible. Lancez d’abord: hashcode-quality check'); process.exitCode = 2; return; }
  const data = { runId: run.runId, gitSha: run.gitSha, proofGraphHash: run.proofGraph?.graphHash ?? null, harnessHash: run.harness?.harnessHash ?? null, summary: run.intelligence?.proofSummary ?? null, proofs: explainRunProof(run) };
  say(json ? data : `HASHCODE PROOF\nRun: ${data.runId}\nGit SHA: ${data.gitSha ?? 'unknown'}\nProof graph: ${data.proofGraphHash ?? 'none'}\nHarness: ${data.harnessHash ?? 'none'}\n\n${data.proofs.map(p => `- ${p.checkId}: ${p.status} — ${p.why}`).join('\n')}`);
  process.exitCode = data.proofs.some(p => ['NOT_PROVEN','INSUFFICIENT_PROOF'].includes(p.status)) ? 1 : 0;
}

function evidence() {
  const run = latestRun();
  if (!run) { console.error('Aucun run disponible.'); process.exitCode = 2; return; }
  const data = (run.checks ?? []).map(c => ({ checkId: c.id, status: c.result?.status ?? null, evidence: c.result?.evidence ?? null }));
  say(json ? { runId: run.runId, evidence: data } : data.map(x => `- ${x.checkId}: ${x.status} | evidence=${x.evidence?.id ?? 'missing'}`).join('\n'));
}

function regressions() {
  const run = latestRun();
  if (!run) { console.error('Aucun run disponible.'); process.exitCode = 2; return; }
  const data = (run.findings ?? []).filter(f => f.regressionTests?.length).map(f => ({ id: f.id, kind: f.kind, title: f.title, tests: f.regressionTests }));
  say(json ? { runId: run.runId, regressions: data } : (data.length ? data.map(x => `- ${x.title}\n  ${x.tests.join('\n  ')}`).join('\n') : 'Aucune régression enregistrée.'));
}
function prompt() {
  const requested = args.find((arg) => arg.endsWith('.md')) || 'prompts/00-master-orchestrator.md';
  const content = loadPrompt(root, requested);
  if (!content) { console.error(`Prompt introuvable: ${requested}`); process.exitCode = 2; return; }
  console.log(content);
}

switch (command) {
  case 'init': init(); break;
  case 'doctor': doctor(); break;
  case 'audit': audit(); break;
  case 'check': await check(); break;
  case 'prove': prove(); break;
  case 'eval': prove(); break;
  case 'evidence': evidence(); break;
  case 'regressions': regressions(); break;
  case 'explain-proof': prove(); break;
  case 'prompt': prompt(); break;
  case '--help':
  case 'help':
    console.log(`HashCode Quality CLI

Usage:
  npx hashcode-quality init
  npx hashcode-quality doctor [--json]
  npx hashcode-quality audit [--json]
  npx hashcode-quality check --profile minimal|standard|production|ai [--json]
  npx hashcode-quality check --changed-file=src/foo.ts
  npx hashcode-quality prompt [prompt-file.md]
  npx hashcode-quality prove [--json]
  npx hashcode-quality eval [--json]
  npx hashcode-quality evidence [--json]
  npx hashcode-quality regressions [--json]
  npx hashcode-quality explain-proof [--json]`);
    break;
  default:
    console.error(`Commande inconnue: ${command}`);
    process.exitCode = 2;
}
