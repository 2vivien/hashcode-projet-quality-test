import { createHash } from 'node:crypto';

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function normalizeVerdict(result) {
  return {
    verdict: result?.verdict ?? 'INCONCLUSIVE',
    confidence: Number.isFinite(Number(result?.confidence)) ? Math.max(0, Math.min(1, Number(result.confidence))) : 0,
    reason: String(result?.reason ?? '')
  };
}

export async function evaluateRepeated({ evaluate, attempts = 3 } = {}) {
  if (typeof evaluate !== 'function') return { verdict: 'INCONCLUSIVE', confidence: 0, attempts: [], agreement: 0, reason: 'No evaluator configured.' };
  const count = Math.max(1, Math.min(9, Number(attempts) || 3));
  const results = [];
  for (let i = 0; i < count; i++) {
    try { results.push(normalizeVerdict(await evaluate(i))); }
    catch (error) { results.push({ verdict: 'INCONCLUSIVE', confidence: 0, reason: error.message }); }
  }
  const passCount = results.filter(r => r.verdict === 'PASS').length;
  const failCount = results.filter(r => r.verdict === 'FAIL').length;
  const agreement = Math.max(passCount, failCount, results.length - passCount - failCount) / results.length;
  const unanimous = new Set(results.map(r => r.verdict)).size === 1;
  const verdict = unanimous ? results[0].verdict : 'INCONCLUSIVE';
  return {
    verdict,
    confidence: unanimous ? Math.min(...results.map(r => r.confidence)) : 0,
    attempts: results,
    agreement,
    evaluatorHash: hash(results.map(r => ({ verdict: r.verdict, confidence: r.confidence, reason: r.reason }))),
    reason: unanimous ? 'Repeated evaluations agree.' : 'Repeated evaluations disagree; proof is inconclusive.'
  };
}

export function compareDifferential({ baseline, candidate, equal = Object.is } = {}) {
  const same = typeof equal === 'function' ? equal(candidate, baseline) : Object.is(candidate, baseline);
  return {
    verdict: same ? 'PASS' : 'FAIL',
    confidence: 1,
    reason: same ? 'Candidate matches the independent baseline.' : 'Candidate differs from the independent baseline.',
    baseline,
    candidate,
    independent: true
  };
}

export function evaluateMetamorphic({ original, transformed, relation } = {}) {
  if (typeof relation !== 'function') return { verdict: 'INCONCLUSIVE', confidence: 0, reason: 'No metamorphic relation configured.' };
  try {
    const valid = Boolean(relation(original, transformed));
    return { verdict: valid ? 'PASS' : 'FAIL', confidence: 1, reason: valid ? 'Metamorphic relation holds.' : 'Metamorphic relation was violated.' };
  } catch (error) {
    return { verdict: 'INCONCLUSIVE', confidence: 0, reason: `Metamorphic relation error: ${error.message}` };
  }
}

export function evaluateProperty({ cases = [], property } = {}) {
  if (typeof property !== 'function' || !cases.length) return { verdict: 'INCONCLUSIVE', confidence: 0, reason: 'Property oracle needs a property function and at least one case.' };
  for (const [index, value] of cases.entries()) {
    try {
      if (!property(value)) return { verdict: 'FAIL', confidence: 1, failingCase: index, reason: `Property failed for case ${index}.` };
    } catch (error) {
      return { verdict: 'INCONCLUSIVE', confidence: 0, failingCase: index, reason: `Property error for case ${index}: ${error.message}` };
    }
  }
  return { verdict: 'PASS', confidence: 1, testedCases: cases.length, reason: 'Property held for all supplied cases.' };
}
