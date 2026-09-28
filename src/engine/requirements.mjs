import { createRequirement } from './model.mjs';

export function loadRequirements(config = {}) {
  const requirements = Array.isArray(config.requirements) ? config.requirements : [];
  return requirements.map((requirement, index) => createRequirement({
    id: requirement.id ?? `requirement_${index + 1}`,
    statement: requirement.statement ?? requirement.description ?? '',
    risk: requirement.risk ?? 'MEDIUM',
    acceptanceCriteria: requirement.acceptance_criteria ?? requirement.acceptanceCriteria ?? [],
    invariants: requirement.invariants ?? [],
    requiredEvidence: requirement.required_evidence ?? requirement.requiredEvidence ?? [],
    scope: requirement.scope ?? {},
    expected: requirement.expected,
    schema: requirement.schema
  }));
}

export function findRequirement(requirements, id) {
  return requirements.find(requirement => requirement.id === id) ?? null;
}
