import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DATASET_VERSION = '1.0';
function hash(value) { return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value ?? null)).digest('hex'); }

export function createDataset({ id, version = DATASET_VERSION, cases = [], source = 'inline', metadata = {} } = {}) {
  const normalized = cases.map((item, index) => ({ id: item?.id ?? `case_${index + 1}`, input: item?.input, expected: item?.expected, reference: item?.reference, tags: item?.tags ?? [] }));
  const dataset = { id: id ?? 'dataset', version, source, metadata, cases: normalized };
  return { ...dataset, hash: hash(dataset) };
}

export function loadDataset(cwd, file) {
  if (!file) return null;
  const path = join(cwd, file);
  if (!existsSync(path)) return null;
  return createDataset({ ...JSON.parse(readFileSync(path, 'utf8')), source: file });
}

export function verifyDataset(dataset, expectedHash) {
  const { hash: ignored, ...body } = dataset ?? {};
  const actualHash = hash(body);
  return { valid: Boolean(dataset?.hash) && dataset.hash === actualHash && (!expectedHash || expectedHash === actualHash), actualHash, expectedHash: expectedHash ?? null };
}
