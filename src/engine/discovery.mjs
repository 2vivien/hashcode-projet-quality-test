import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function discoverProject(cwd = process.cwd()) {
  const has = file => existsSync(join(cwd, file));
  let pkg = {};
  if (has('package.json')) try { pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')); } catch {}
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = pkg.scripts || {};
  const files = {
    packageJson: has('package.json'), tsconfig: has('tsconfig.json'), pnpmLock: has('pnpm-lock.yaml'),
    npmLock: has('package-lock.json'), yarnLock: has('yarn.lock'), pyproject: has('pyproject.toml'),
    requirements: has('requirements.txt'), dockerfile: has('Dockerfile'), compose: has('compose.yml') || has('docker-compose.yml'),
    openapi: has('openapi.yaml') || has('openapi.yml') || has('openapi.json'),
  };
  const stack = {
    node: files.packageJson, typescript: files.tsconfig || !!deps.typescript, react: !!deps.react, nextjs: !!deps.next,
    vitest: !!deps.vitest, playwright: !!deps['@playwright/test'], prisma: !!deps.prisma || !!deps['@prisma/client'],
    python: files.pyproject || files.requirements, docker: files.dockerfile || files.compose,
    ai: /openai|anthropic|ai-sdk|langchain|llamaindex|@google\\/generative-ai/i.test(Object.keys(deps).join(' ')),
  };
  const packageManager = files.pnpmLock ? 'pnpm' : files.yarnLock ? 'yarn' : files.npmLock ? 'npm' : 'npm';
  return { cwd, packageName: pkg.name || null, packageVersion: pkg.version || null, packageManager, scripts, dependencies: deps, files, stack };
}

export function inferRisk(project) {
  const critical = project.stack.ai || project.stack.prisma || project.files.openapi;
  const high = project.stack.nextjs || project.stack.react || project.stack.docker;
  return critical ? 'HIGH' : high ? 'MEDIUM' : 'LOW';
}
