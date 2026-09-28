import { createHash } from 'node:crypto';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

export function createRegressionCase({ finding, requirement = null, minimalReproduction = null, property = null } = {}) {
  const test = minimalReproduction ?? finding?.regressionTests?.[0] ?? null;
  return {
    id: `reg_${finding?.id ?? hash({ finding, requirement }).slice(0, 12)}`,
    findingId: finding?.id ?? null,
    requirementId: requirement?.id ?? finding?.requirementId ?? null,
    severity: finding?.severity ?? 'MEDIUM',
    reproduction: test,
    generalizedProperty: property,
    acceptanceCriteria: requirement?.acceptanceCriteria ?? [],
    status: test ? 'ACTIONABLE' : 'MISSING_REPRODUCTION'
  };
}

export function buildRegressionPlan({ findings = [], requirements = [] } = {}) {
  return findings
    .filter(f => ['CONFIRMED_DEFECT', 'LIKELY_DEFECT'].includes(f.kind))
    .map(f => createRegressionCase({
      finding: f,
      requirement: requirements.find(r => r.id === f.requirementId || r.id === f.location) ?? null,
      minimalReproduction: f.regressionTests?.[0] ?? null
    }));
}
