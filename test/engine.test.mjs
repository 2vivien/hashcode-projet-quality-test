import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverProject } from '../src/engine/discovery.mjs';
import { buildPlan } from '../src/engine/planner.mjs';
import { runCommand } from '../src/engine/runner.mjs';
import { buildGate } from '../src/engine/evaluate.mjs';

test('discovery detects Node, TypeScript and test script', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hashcode-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({name:'fixture', scripts:{test:'node --test'}, devDependencies:{typescript:'1.0.0'}}));
    writeFileSync(join(dir, 'tsconfig.json'), '{}');
    const project = discoverProject(dir);
    assert.equal(project.stack.node, true);
    assert.equal(project.stack.typescript, true);
    assert.equal(project.scripts.test, 'node --test');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('planner reports missing evidence instead of pretending a test exists', () => {
  const plan = buildPlan({scripts:{}, stack:{playwright:false, prisma:false, docker:false}}, 'standard');
  assert.ok(plan.gaps.some(g => g.id === 'test'));
  assert.equal(plan.checks.some(c => c.id === 'test'), false);
});

test('runner captures deterministic evidence', async () => {
  const result = await runCommand({command: process.execPath, args:['-e','process.stdout.write("ok")']});
  assert.equal(result.status, 'PASS');
  assert.equal(result.stdout, 'ok');
  assert.equal(result.evidence.exitCode, 0);
  assert.match(result.evidence.command, /node|nodejs/);
});

test('gate fails on required high-severity confirmed defects', () => {
  const gate = buildGate({profile:'standard', checks:[{id:'test',required:true,result:{status:'FAIL'}}], findings:[{kind:'CONFIRMED_DEFECT',severity:'HIGH'}]});
  assert.equal(gate.status, 'FAIL');
});
