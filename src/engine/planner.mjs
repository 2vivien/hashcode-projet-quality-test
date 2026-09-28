import { createCheck } from './model.mjs';

function scriptCheck(project, id, script, category, purpose, risk, required = false) {
  if (!project.scripts[script]) return null;
  return createCheck({ id, category, purpose, risk, command: project.packageManager, args: ['run', script], required });
}

export function buildPlan(project, profile = 'standard') {
  const checks = [];
  const add = x => x && checks.push(x);
  add(scriptCheck(project, 'lint', 'lint', 'code_quality', 'Validate lint rules', 'MEDIUM', true));
  add(scriptCheck(project, 'typecheck', 'typecheck', 'static_types', 'Validate static type contracts', 'HIGH', true));
  if (project.scripts.test) add(scriptCheck(project, 'test', 'test', 'unit_integration', 'Execute the project test suite', 'HIGH', true));
  if (project.scripts.build && ['production', 'ai'].includes(profile)) add(scriptCheck(project, 'build', 'build', 'build', 'Validate production build', 'HIGH', true));

  if (project.stack.vitest && project.scripts.test) {
    // The project script remains the source of truth; direct tool invocation is avoided.
  }
  if (project.stack.playwright && project.scripts['test:e2e'] && ['production', 'ai'].includes(profile))
    add(scriptCheck(project, 'e2e', 'test:e2e', 'e2e', 'Validate critical browser journeys', 'HIGH'));
  if (project.stack.prisma && project.scripts['prisma:validate'])
    add(scriptCheck(project, 'prisma_validate', 'prisma:validate', 'data_integrity', 'Validate ORM schema and generated contract', 'HIGH'));
  if (project.stack.docker && project.scripts['security'])
    add(scriptCheck(project, 'security', 'security', 'security', 'Run project security checks', 'HIGH'));

  return checks.slice(0, 50);
}

export function selectChecks(plan, { profile = 'standard', changedFiles = [] } = {}) {
  if (!changedFiles.length) return plan;
  const broad = changedFiles.some(f => /package.json|lock|config|schema|migration|Dockerfile|\.github/i.test(f));
  if (broad || ['production', 'ai'].includes(profile)) return plan;
  return plan.filter(c => !['build', 'e2e'].includes(c.id));
}
