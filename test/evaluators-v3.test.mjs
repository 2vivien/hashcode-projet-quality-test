import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRepeated, compareDifferential, evaluateMetamorphic, evaluateProperty } from '../src/engine/evaluators.mjs';

test('repeated evaluator turns disagreement into inconclusive', async () => {
  const result = await evaluateRepeated({ attempts: 3, evaluate: i => ({ verdict: i === 1 ? 'FAIL' : 'PASS', confidence: 1 }) });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.equal(result.agreement, 2 / 3);
});

test('differential evaluator uses an independent baseline', () => {
  assert.equal(compareDifferential({ baseline: 42, candidate: 42 }).verdict, 'PASS');
  assert.equal(compareDifferential({ baseline: 42, candidate: 43 }).verdict, 'FAIL');
});

test('metamorphic evaluator proves a supplied relation deterministically', () => {
  assert.equal(evaluateMetamorphic({ original: 2, transformed: 4, relation: (a, b) => b === a * 2 }).verdict, 'PASS');
});

test('property evaluator reports the first failing case', () => {
  const result = evaluateProperty({ cases: [2, 4, 5], property: x => x % 2 === 0 });
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.failingCase, 2);
});
