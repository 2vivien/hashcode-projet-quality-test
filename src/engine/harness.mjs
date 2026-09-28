import { createHash } from 'node:crypto';

export const HARNESS_VERSION = '1.0';
function canonical(value) { return JSON.stringify(value ?? null); }
function sha256(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }

export function createFrozenHarness({ id = 'default', oraclePlans = [], dataset = null, evaluator = null, thresholds = {}, policy = {}, version = HARNESS_VERSION } = {}) {
  const harness = { version, id, frozen: true, oraclePlans, dataset, evaluator, thresholds, policy };
  return { ...harness, harnessHash: sha256(harness) };
}

export function verifyFrozenHarness(harness, expectedHash) {
  if (!harness || harness.frozen !== true) return { valid: false, reason: 'Evaluation harness is not frozen.' };
  const { harnessHash: ignored, ...body } = harness;
  const actualHash = sha256(body);
  const valid = actualHash === expectedHash && actualHash === harness.harnessHash;
  return { valid, expectedHash: expectedHash ?? null, actualHash, reason: valid ? 'Frozen harness identity matches.' : 'Frozen harness identity changed or is missing.' };
}

export function snapshotHarness(harness) {
  const { harnessHash, ...body } = harness ?? {};
  return { hash: harnessHash ?? sha256(body), body };
}

export function detectHarnessMutation(before, after) {
  const beforeHash = before?.harnessHash ?? sha256(before);
  const afterHash = after?.harnessHash ?? sha256(after);
  return { mutated: beforeHash !== afterHash, beforeHash, afterHash };
}
