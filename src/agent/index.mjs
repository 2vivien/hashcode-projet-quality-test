import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { discoverApplicationSurface, inferRoles } from './route-discovery.mjs';
import { generateScenarios, prioritizeScenarios } from './scenarios.mjs';
import { exploreBrowser } from './browser-agent.mjs';
import { probeApi } from './api-agent.mjs';
import { reportFindings } from './github-reporter.mjs';

function gitSha(cwd) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}
function startServer(command, cwd) {
  if (!command) return null;
  return spawn(command, { cwd, shell: true, stdio: 'ignore' });
}
async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const response = await fetch(url); if (response.ok || response.status < 500) return true; } catch {}
    await new Promise(function (resolve) { setTimeout(resolve, 500); });
  }
  return false;
}

export async function runAutonomousQA({
  cwd = process.cwd(),
  baseUrl = process.env.HASHCODE_QA_BASE_URL,
  startCommand = null,
  maxPages = 30,
  maxDepth = 2,
  timeoutMs = 15000,
  maxScenarios = 100,
  allowMutations = false,
  openIssues = false,
  publishArtifacts = true,
  githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  githubRepo = null,
  githubBranch = 'main'
} = {}) {
  const startedAt = new Date().toISOString();
  const runId = 'qa_' + startedAt.replace(/[^0-9]/g, '');
  const outDir = join(cwd, '.hashcode-quality', 'agent-runs', runId);
  mkdirSync(outDir, { recursive: true });
  const surface = discoverApplicationSurface(cwd);
  const roles = inferRoles(cwd);
  const scenarios = prioritizeScenarios(generateScenarios({ surface, roles, max: maxScenarios, allowMutations }));
  let server = null;
  try {
    if (startCommand) {
      server = startServer(startCommand, cwd);
      if (baseUrl && !(await waitForUrl(baseUrl, 30000))) throw new Error('Application did not become reachable at ' + baseUrl);
    }
    const browser = await exploreBrowser({ baseUrl, routes: surface.routes, outDir: join(outDir, 'browser'), maxPages, maxDepth, timeoutMs });
    const api = await probeApi({ baseUrl, endpoints: [...surface.openapi, ...surface.apiRoutes], timeoutMs, allowMutations });
    const findings = [...browser.findings, ...api.findings].map(function (f) { return { ...f, confidence: f.confidence == null ? 1 : f.confidence }; });
    const report = { version: '1.0', runId, startedAt, finishedAt: new Date().toISOString(), gitSha: gitSha(cwd), baseUrl, surface, roles, scenarios, browser, api, findings };
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    let issues = null;
    if (openIssues) issues = await reportFindings({ findings, repo: githubRepo, token: githubToken, branch: githubBranch, runId, gitSha: report.gitSha, publishArtifacts });
    return { ...report, issues, artifactDir: outDir };
  } finally {
    if (server) server.kill('SIGTERM');
  }
}