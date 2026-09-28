import { createHash } from 'node:crypto';

export const EVIDENCE_VERSION = '1.0';

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value ?? null)).digest('hex');
}

export function normalizeEvidence(evidence = []) {
  return evidence.filter(Boolean).map((item, index) => ({
    id: item.id ?? `evidence_${index + 1}`,
    tool: item.tool ?? 'unknown',
    command: item.command ?? null,
    exitCode: item.exitCode ?? null,
    timestamp: item.timestamp ?? null,
    durationMs: item.durationMs ?? null,
    meta: item.meta ?? {},
    stdoutHash: hash(item.stdout ?? ''),
    stderrHash: hash(item.stderr ?? '')
  }));
}

export function evidenceIdentity(evidence = []) {
  return hash(normalizeEvidence(evidence));
}

export function verifyEvidence(evidence, expectedIdentity) {
  const actualIdentity = evidenceIdentity(evidence);
  return {
    valid: Boolean(expectedIdentity) && actualIdentity === expectedIdentity,
    expectedIdentity: expectedIdentity ?? null,
    actualIdentity
  };
}
