export const PROOF_NODE_TYPES = Object.freeze({ REQUIREMENT: 'requirement', RISK: 'risk', ORACLE: 'oracle', EXECUTION: 'execution', EVIDENCE: 'evidence', EVALUATION: 'evaluation', PROOF: 'proof', REGRESSION: 'regression', GATE: 'gate' });

export function buildProofGraph({ checks = [], proofAssessments = [], findings = [], gate = null, gitSha = null } = {}) {
  const nodes = [];
  const edges = [];
  const addNode = (id, type, data = {}) => nodes.push({ id, type, data });
  const addEdge = (from, to, relation) => edges.push({ from, to, relation });
  for (const assessment of proofAssessments) {
    const check = checks.find(c => c.id === assessment.checkId);
    if (!check) continue;
    const requirementId = `requirement:${check.id}`;
    const riskId = `risk:${check.id}`;
    const proofId = `proof:${check.id}`;
    addNode(requirementId, PROOF_NODE_TYPES.REQUIREMENT, { id: check.id, statement: check.purpose, scope: { category: check.category } });
    addNode(riskId, PROOF_NODE_TYPES.RISK, { level: check.risk });
    addEdge(requirementId, riskId, 'has_risk');
    for (const [i, oracle] of (assessment.plan?.oracles ?? []).entries()) {
      const oracleId = `oracle:${check.id}:${i}`;
      const result = assessment.receipt?.oracles?.[i];
      addNode(oracleId, PROOF_NODE_TYPES.ORACLE, { type: oracle.type, criterion: oracle.criterion, evaluator: oracle.evaluator, evidenceRequired: oracle.evidenceRequired ?? [] });
      addEdge(riskId, oracleId, 'tested_by');
      const executionId = `execution:${check.id}`;
      if (i === 0) {
        addNode(executionId, PROOF_NODE_TYPES.EXECUTION, { status: check.result?.status ?? null, exitCode: check.result?.exitCode ?? null, command: check.result?.evidence?.command ?? null, gitSha });
        addEdge(requirementId, executionId, 'executed_as');
        if (check.result?.evidence) {
          const evidenceId = `evidence:${check.id}`;
          addNode(evidenceId, PROOF_NODE_TYPES.EVIDENCE, { id: check.result.evidence.id ?? null, tool: check.result.evidence.tool ?? null, timestamp: check.result.evidence.timestamp ?? null, inputHash: check.result.evidence.meta?.inputHash ?? null });
          addEdge(executionId, evidenceId, 'produced');
          addEdge(evidenceId, oracleId, 'consumed_by');
        }
      }
      const evaluationId = `evaluation:${check.id}:${i}`;
      addNode(evaluationId, PROOF_NODE_TYPES.EVALUATION, { verdict: result?.verdict ?? 'NOT_EVALUATED', confidence: result?.confidence ?? 0 });
      addEdge(oracleId, evaluationId, 'evaluated_as');
      addEdge(evaluationId, proofId, 'supports');
    }
    addNode(proofId, PROOF_NODE_TYPES.PROOF, { status: assessment.receipt?.status ?? 'INSUFFICIENT_PROOF', confidence: assessment.receipt?.confidence ?? 0, proofHash: assessment.receipt?.proofHash ?? null });
    for (const finding of findings.filter(f => f.regressionTests?.length && f.location === check.id)) {
      const regressionId = `regression:${finding.id}`;
      addNode(regressionId, PROOF_NODE_TYPES.REGRESSION, { findingId: finding.id, tests: finding.regressionTests });
      addEdge(proofId, regressionId, 'creates_regression');
    }
  }
  const gateId = 'gate:quality';
  addNode(gateId, PROOF_NODE_TYPES.GATE, { status: gate?.status ?? null, reasons: gate?.reasons ?? [] });
  for (const proof of nodes.filter(n => n.type === PROOF_NODE_TYPES.PROOF)) addEdge(proof.id, gateId, 'contributes_to');
  return { version: '1.0', gitSha, nodes, edges };
}
