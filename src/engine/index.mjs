import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectStack } from '../index.mjs';
import { discoverProject, inferRisk } from './discovery.mjs';
import { loadQualityConfig } from './config.mjs';
import { buildPlan, selectChecks } from './planner.mjs';
import { runCheck } from './runner.mjs';
import { evaluateCheck, buildGate } from './evaluate.mjs';
import { planProof } from './proof.mjs';
import { evaluateOracle } from './oracle.mjs';
import { buildProofReceipt } from './proof-ledger.mjs';
import { buildProofGraph } from './proof-graph.mjs';
import { explainProof } from './proof-ledger.mjs';
import { loadRequirements } from './requirements.mjs';
import { createFrozenHarness } from './harness.mjs';
import { buildRegressionPlan } from './regression.mjs';

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
  const configuredRequirements = loadRequirements(config);
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

  const requirements = checks.map(check => configuredRequirements.find(r => r.id === check.id) ?? {
    id: check.id,
    statement: check.purpose,
    risk: check.risk,
    acceptanceCriteria: [],
    invariants: [],
    requiredEvidence: ['exitCode'],
    scope: { category: check.category },
    expected: 0
  });
  const proofPlans = requirements.map(requirement => planProof(requirement, {
    risk: check.risk,
    capabilities: { semanticEvaluator: false, differentialReference: false }
  }));
  const harness = createFrozenHarness({
    id: `run-${startedAt}`,
    oraclePlans: proofPlans,
    thresholds: { highRiskMinimumConfidence: 0.9 },
    policy: { noSelfModification: true, evaluatorIsOutOfBand: true }
  });
  const runId = `run_${startedAt.replace(/[^0-9]/g, '')}_${gitSha(cwd)?.slice(0, 12) ?? 'nogit'}`;
  const proofAssessments = checks.map((check, i) => {
    const evidence = check.result?.evidence ? [check.result.evidence] : [];
    const plan = proofPlans[i];
    const oracleResults = plan.oracles.map(oracle => evaluateOracle(oracle, {
      actual: check.result?.exitCode,
      expected: 0,
      ...check.result?.evidence
    }));
    return {
      checkId: check.id,
      plan,
      receipt: buildProofReceipt({
        requirement: requirements[i],
        risk: check.risk,
        oraclePlan: plan.oracles,
        oracleResults,
        evidence,
        runId,
        gitSha: gitSha(cwd),
        proofPolicy: plan.proofPolicy
      })
    };
  });
  const regressionPlan = buildRegressionPlan({ findings, requirements });
  const gate = buildGate({ checks, findings, proofAssessments, profile });
  const proofGraph = buildProofGraph({ checks, proofAssessments, requirements, findings, gate, gitSha: gitSha(cwd) });
  const finishedAt = new Date().toISOString();
  const result = {
    engineVersion: '3.0.0-gold',
    startedAt, finishedAt, runId, gitSha: gitSha(cwd),
    project: { ...project, stack, inferredRisk: inferRisk(project) },
    plan: { selected: plan.checks.map(x => x.id), totalAvailable: initialPlan.checks.length, gaps: plan.gaps },
    checks, findings, requirements, proofAssessments, proofGraph, harness, regressionPlan, gate,
    intelligence: {
      traceability: 'requirement -> risk -> oracle -> execution -> evidence -> evaluation -> proof -> regression -> gate',
      proofGraphHash: proofGraph.graphHash ?? null,
      regression: findings.filter(f => f.kind === 'CONFIRMED_DEFECT').map(f => ({ findingId: f.id, tests: f.regressionTests })),
      evidenceComplete: checks.every(c => Boolean(c.result?.evidence)),
      proofSummary: {
        proven: proofAssessments.filter(p => p.receipt.status === 'PROVEN').length,
        notProven: proofAssessments.filter(p => p.receipt.status === 'NOT_PROVEN').length,
        inconclusive: proofAssessments.filter(p => p.receipt.status === 'INCONCLUSIVE').length,
        insufficient: proofAssessments.filter(p => p.receipt.status === 'INSUFFICIENT_PROOF').length
      },
      changedFiles: detectedChanges,
      prompt: existsSync(join(cwd, 'prompts/14-test-intelligence.md')) ? 'prompts/14-test-intelligence.md' : null,
      configLoaded: Boolean(config)
    }
  };
  if (persist) result.reportFile = persistRun(cwd, result);
  return result;
}

export function explainRunProof(run) {
  return (run?.proofAssessments ?? []).map(p => ({ checkId: p.checkId, ...explainProof(p.receipt) }));
}

export function loadPrompt(cwd = process.cwd(), file = 'prompts/14-test-intelligence.md') {
  const path = join(cwd, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}
