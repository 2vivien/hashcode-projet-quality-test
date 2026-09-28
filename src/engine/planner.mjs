import { createCheck } from './model.mjs';

function scriptCheck(project, id, script, category, purpose, risk, required = false) {
  if (!project.scripts[script]) return null;
  return createCheck({ id, category, purpose, risk, command: project.packageManager, args: ['run', script], required });
}

export function buildPlan(project, profile = 'standard') {
  const checks = [];
  const gaps = [];
  const add = x => x && checks.push(x);
  const requireScript = (id, script, category, purpose, risk, required = false) => {
    const check = scriptCheck(project, id, script, category, purpose, risk, required);
    if (check) add(check);
    else gaps.push({ id, category, expected: script, reason: 'no_project_script' });
  };

  requireScript('lint', 'lint', 'code_quality', 'Validate lint rules', 'MEDIUM', true);
  requireScript('typecheck', 'typecheck', 'static_types', 'Validate static type contracts', 'HIGH', true);
  if (project.scripts.test) add(scriptCheck(project, 'test', 'test', 'unit_integration', 'Execute the project test suite', 'HIGH', true));
  else gaps.push({ id: 'test', category: 'unit_integration', expected: 'test', reason: 'no_project_script' });

  if (['production', 'ai'].includes(profile)) {
    requireScript('build', 'build', 'build', 'Validate production build', 'HIGH', true);
    if (project.stack.playwright) requireScript('e2e', 'test:e2e', 'e2e', 'Validate critical browser journeys', 'HIGH');
    if (project.stack.prisma) requireScript('prisma_validate', 'prisma:validate', 'data_integrity', 'Validate ORM schema and generated contract', 'HIGH');
  }

  if (project.stack.docker && project.scripts.security) add(scriptCheck(project, 'security', 'security', 'security', 'Run project security checks', 'HIGH'));
  return { checks: checks.slice(0, 50), gaps };
}

export function selectChecks(plan, { profile = 'standard', changedFiles = [] } = {}) {
  const broad = changedFiles.some(f => /package.json|lock|config|schema|migration|Dockerfile|\\.github/i.test(f));
  if (!changedFiles.length || broad || ['production', 'ai'].includes(profile)) return plan;
  return { ...plan, checks: plan.checks.filter(c => !['build', 'e2e'].includes(c.id)) };
}
