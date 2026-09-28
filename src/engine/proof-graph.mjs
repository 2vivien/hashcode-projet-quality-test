import { createHash } from 'node:crypto';

function hashGraph(graph) {
  const canonical = JSON.stringify({ version: graph.version, gitSha: graph.gitSha, nodes: graph.nodes, edges: graph.edges });
  return createHash('sha256').update(canonical).digest('hex');
}

export const PROOF_NODE_TYPES = Object.freeze({
  REQUIREMENT: 'requirement', ACCEPTANCE_CRITERION: 'acceptance_criterion', INVARIANT: 'invariant', RISK: 'risk', ORACLE: 'oracle', DATASET: 'dataset', HARNESS: 'harness', EXECUTION: 'execution', EVIDENCE: 'evidence', EVALUATION: 'evaluation', PROOF: 'proof', REGRESSION: 'regression', GATE: 'gate'
});

export function buildProofGraph({ checks = [], proofAssessments = [], requirements = [], findings = [], gate = null, gitSha = null, harness = null } = {}) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const addNode = (id, type, data = {}) => { if (!nodeIds.has(id)) { nodes.push({ id, type, data }); nodeIds.add(id); } };
  const addEdge = (from, to, relation) => edges.push({ from, to, relation });

  if (harness) addNode('harness:evaluation', PROOF_NODE_TYPES.HARNESS, { id: harness.id, version: harness.version, hash: harness.harnessHash, frozen: harness.frozen });

  for (const requirement of requirements) {
    const rid = `requirement:${requirement.id}`;
    addNode(rid, PROOF_NODE_TYPES.REQUIREMENT, requirement);
    addNode(`risk:${requirement.id}`, PROOF_NODE_TYPES.RISK, { level: requirement.risk });
    addEdge(rid, `risk:${requirement.id}`, 'has_risk');
    for (const [i, criterion] of (requirement.acceptanceCriteria ?? []).entries()) {
      const cid = `criterion:${requirement.id}:${i}`;
      addNode(cid, PROOF_NODE_TYPES.ACCEPTANCE_CRITERION, { statement: criterion });
      addEdge(rid, cid, 'has_acceptance_criterion');
    }
    for (const [i, invariant] of (requirement.invariants ?? []).entries()) {
      const iid = `invariant:${requirement.id}:${i}`;
      addNode(iid, PROOF_NODE_TYPES.INVARIANT, { statement: invariant });
      addEdge(rid, iid, 'has_invariant');
    }
  }

  for (const assessment of proofAssessments) {
    const check = checks.find(c => c.id === assessment.checkId);
    const requirement = requirements.find(r => r.id === assessment.checkId) ?? { id: assessment.checkId, statement: check?.purpose ?? '', risk: check?.risk ?? 'MEDIUM', acceptanceCriteria: [], invariants: [] };
    const rid = `requirement:${requirement.id}`;
    const riskId = `risk:${requirement.id}`;
    const proofId = `proof:${assessment.checkId}`;
    addNode(rid, PROOF_NODE_TYPES.REQUIREMENT, requirement);
    addNode(riskId, PROOF_NODE_TYPES.RISK, { level: requirement.risk });
    addEdge(rid, riskId, 'has_risk');
    addNode(proofId, PROOF_NODE_TYPES.PROOF, { status: assessment.receipt?.status ?? 'INSUFFICIENT_PROOF', confidence: assessment.receipt?.confidence ?? 0, proofHash: assessment.receipt?.proofHash ?? null });
    for (const [i, oracle] of (assessment.plan?.oracles ?? []).entries()) {
      const oracleId = `oracle:${assessment.checkId}:${i}`;
      const result = assessment.receipt?.oracles?.[i];
      addNode(oracleId, PROOF_NODE_TYPES.ORACLE, { type: oracle.type, criterion: oracle.criterion, evaluator: oracle.evaluator, evidenceRequired: oracle.evidenceRequired ?? [] });
      addEdge(riskId, oracleId, 'tested_by');
      if (harness) addEdge('harness:evaluation', oracleId, 'defines');
      if (assessment.dataset) {
        const datasetId = `dataset:${assessment.dataset.id}`;
        addNode(datasetId, PROOF_NODE_TYPES.DATASET, assessment.dataset);
        addEdge(oracleId, datasetId, 'uses_dataset');
      }
      const executionId = `execution:${assessment.checkId}`;
      if (i === 0) {
        addNode(executionId, PROOF_NODE_TYPES.EXECUTION, { status: check?.result?.status ?? null, exitCode: check?.result?.exitCode ?? null, command: check?.result?.evidence?.command ?? null, gitSha });
        addEdge(rid, executionId, 'executed_as');
        if (check?.result?.evidence) {
          const evidenceId = `evidence:${assessment.checkId}`;
          addNode(evidenceId, PROOF_NODE_TYPES.EVIDENCE, { id: check.result.evidence.id ?? null, tool: check.result.evidence.tool ?? null, timestamp: check.result.evidence.timestamp ?? null, inputHash: check.result.evidence.meta?.inputHash ?? null });
          addEdge(executionId, evidenceId, 'produced');
          addEdge(evidenceId, oracleId, 'consumed_by');
        }
      }
      const evaluationId = `evaluation:${assessment.checkId}:${i}`;
      addNode(evaluationId, PROOF_NODE_TYPES.EVALUATION, { verdict: result?.verdict ?? 'NOT_EVALUATED', confidence: result?.confidence ?? 0, evaluator: oracle.evaluator ?? null });
      addEdge(oracleId, evaluationId, 'evaluated_as');
      addEdge(evaluationId, proofId, 'supports');
    }
    for (const finding of findings.filter(f => f.regressionTests?.length && (f.location === assessment.checkId || f.checkId === assessment.checkId || f.requirementId === requirement.id))) {
      const regressionId = `regression:${finding.id}`;
      addNode(regressionId, PROOF_NODE_TYPES.REGRESSION, { findingId: finding.id, tests: finding.regressionTests });
      addEdge(proofId, regressionId, 'creates_regression');
    }
  }

  const gateId = 'gate:quality';
  addNode(gateId, PROOF_NODE_TYPES.GATE, { status: gate?.status ?? null, reasons: gate?.reasons ?? [] });
  for (const proof of nodes.filter(n => n.type === PROOF_NODE_TYPES.PROOF)) addEdge(proof.id, gateId, 'contributes_to');
  const graph = { version: '2.0', gitSha, nodes, edges };
  graph.graphHash = hashGraph(graph);
  return graph;
}
