import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { discoverApplicationSurface, inferRoles } from './route-discovery.mjs';
import { generateScenarios, prioritizeScenarios } from './scenarios.mjs';
import { exploreBrowser } from './browser-agent.mjs';
import { probeApi } from './api-agent.mjs';
import { loadAuthorizationFixtures, listFixtureRoles, resolveRoleHeaders } from './fixtures.mjs';
import { buildAuthorizationMatrix, runAuthorizationMatrix } from './authorization.mjs';
import { buildStateMachine, runStateMachine } from './state-machine.mjs';
import { buildAuthorizationProofSet } from './proof.mjs';
import { reportFindings } from './github-reporter.mjs';

function gitSha(cwd) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function startServer(command, cwd) {
  if (!command) return null;
  return spawn(command, { cwd, shell: true, stdio: 'ignore' });
}

function roleHeadersFromFixtures(fixtures) {
  const result = {};
  for (const role of fixtures.roles || []) {
    const headers = resolveRoleHeaders(role.name, fixtures);
    if (headers) result[role.name] = headers;
  }
  return result;
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const response = await fetch(url); if (response.ok || response.status < 500) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
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
  githubBranch = 'main',
  authorizationFixtures = '.hashcode-quality/authorization-fixtures.json',
  maxStateSteps = 6
} = {}) {
  const startedAt = new Date().toISOString();
  const runId = 'qa_' + startedAt.replace(/[^0-9]/g, '');
  const outDir = join(cwd, '.hashcode-quality', 'agent-runs', runId);
  mkdirSync(outDir, { recursive: true });

  const surface = discoverApplicationSurface(cwd);
  const fixtures = loadAuthorizationFixtures(cwd, authorizationFixtures);
  const inferredRoles = inferRoles(cwd);
  const fixtureRoles = listFixtureRoles(fixtures);
  const executableRoles = fixtureRoles.filter(role => role === 'anonymous' || resolveRoleHeaders(role, fixtures));
  const roles = inferredRoles.map(x => x.role).filter(role => fixtureRoles.includes(role));
  const scenarioRoles = roles.length ? roles : fixtureRoles.filter(role => role !== 'anonymous');

  const scenarios = prioritizeScenarios(generateScenarios({
    surface,
    roles: scenarioRoles,
    max: maxScenarios,
    allowMutations
  }));

  let server = null;
  try {
    if (startCommand) {
      server = startServer(startCommand, cwd);
      if (baseUrl && !(await waitForUrl(baseUrl, 30000))) throw new Error('Application did not become reachable at ' + baseUrl);
    }

    const browser = await exploreBrowser({
      baseUrl,
      routes: surface.routes,
      roles: executableRoles,
      roleHeaders: roleHeadersFromFixtures(fixtures),
      outDir: join(outDir, 'browser'),
      maxPages,
      maxDepth,
      timeoutMs
    });

    const api = await probeApi({
      baseUrl,
      endpoints: [...surface.openapi, ...surface.apiRoutes],
      timeoutMs,
      allowMutations
    });

    const authorizationMatrix = buildAuthorizationMatrix({
      endpoints: [...surface.openapi, ...surface.apiRoutes],
      fixtures
    });

    const authorization = await runAuthorizationMatrix({
      baseUrl,
      matrix: authorizationMatrix,
      fixtures,
      timeoutMs,
      allowMutations
    });

    const statePlan = buildStateMachine({
      endpoints: [...surface.openapi, ...surface.apiRoutes],
      workflows: fixtures.workflows,
      maxSteps: maxStateSteps,
      allowMutations
    });

    const stateMachine = await runStateMachine({
      baseUrl,
      workflows: statePlan,
      fixtures,
      timeoutMs,
      allowMutations
    });

    const git = gitSha(cwd);
    const authorizationProofs = buildAuthorizationProofSet({
      cases: authorization.cases,
      gitSha: git,
      runId
    });

    const findings = [
      ...browser.findings,
      ...api.findings,
      ...authorization.findings,
      ...stateMachine.findings
    ].map(f => ({ ...f, confidence: f.confidence == null ? 1 : f.confidence }));

    const report = {
      version: '1.1',
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      gitSha: git,
      baseUrl,
      surface,
      roles: { inferred: inferredRoles, configured: fixtures.roles || [], executable: executableRoles },
      scenarios,
      authorization: {
        fixtureFile: fixtures.path,
        matrixSize: authorizationMatrix.length,
        cases: authorization.cases,
        proofs: authorizationProofs.map(p => p.receipt)
      },
      stateMachine,
      browser,
      api,
      findings
    };

    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

    let issues = null;
    if (openIssues) {
      issues = await reportFindings({
        findings,
        repo: githubRepo,
        token: githubToken,
        branch: githubBranch,
        runId,
        gitSha: report.gitSha,
        publishArtifacts
      });
    }

    return { ...report, issues, artifactDir: outDir };
  } finally {
    if (server) server.kill('SIGTERM');
  }
}
