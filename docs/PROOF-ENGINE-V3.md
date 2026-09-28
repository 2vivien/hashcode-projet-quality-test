# Proof Engine v3

Proof Engine v3 is the evidence layer of HashCode Quality. Its job is not to report that a command exited with code 0; its job is to establish a declared requirement using declared proof rules.

## Core distinction

- **PASS**: an execution completed without violating the selected oracle.
- **PROVEN**: the declared requirement was established by the declared oracle set, using the required evidence, inside the declared scope.
- **NOT_PROVEN**: evidence established that the requirement was not satisfied.
- **INSUFFICIENT_PROOF**: the system lacks required evidence or a required proof signal.
- **INCONCLUSIVE**: the available evaluators could not establish the requirement.

No result may be upgraded from PASS to PROVEN merely because a test exists.

## Proof chain

```text
Requirement
  ├── Acceptance Criteria
  ├── Invariants
  └── Risk
        ↓
      Oracle
        ↓
      Dataset
        ↓
     Execution
        ↓
      Evidence
        ↓
    Evaluation
        ↓
       Proof
        ↓
    Regression
        ↓
       Gate
```

The persisted proof graph is content-addressed with SHA-256.

## Oracle families

### Deterministic

- EXACT
- STRUCTURAL
- SCHEMA
- INVARIANT

These should be preferred whenever the system can produce a deterministic observation.

### Comparative / generative

- DIFFERENTIAL
- METAMORPHIC
- PROPERTY
- RELATIONAL
- STATE_MACHINE
- CONCURRENCY

These require an adapter or evaluator capable of producing a validated verdict and the relevant evidence.

### Semantic

- SEMANTIC
- BEHAVIORAL
- HUMAN

An LLM judge is never treated as ground truth. Its verdict is an evidence signal with confidence and evaluator identity.

## Frozen evaluation harness

The evaluation harness contains the oracle plans, evaluator identity, datasets, thresholds and policy. It receives a SHA-256 identity.

The intended contract is:

1. construct the evaluator outside the code under test;
2. freeze its definition;
3. record its hash;
4. execute the candidate;
5. verify the harness identity before accepting proof;
6. reject mutation as a reproducibility violation.

This follows the same important experimental principle used by reproducible evaluation harnesses: the candidate must not redefine the metric used to judge it.

## Evidence

Every execution evidence record should contain, where applicable:

- evidence ID;
- command/tool;
- timestamp;
- exit code;
- duration;
- Git SHA;
- input hash;
- dataset version;
- evaluator version;
- model/provider/prompt identity for AI evaluations;
- logs and artifacts.

Evidence is hashed before it contributes to a proof receipt.

## High-risk proof

Critical requirements require independent proof signals.

A strict proof policy requires:

- at least two oracle results;
- independent oracle types;
- all required evidence;
- no failed oracle;
- no unresolved oracle.

For production/AI adapters, a recommended combination is deterministic evidence plus an independent semantic, differential or human evaluation when semantics cannot be reduced to a deterministic invariant.

## AI evaluation

AI proof should be decomposed into:

1. input;
2. expected behavior;
3. output;
4. claims;
5. supporting evidence;
6. contradictions;
7. missing requirements;
8. evaluator verdict;
9. confidence;
10. reproducibility metadata.

For agentic systems, the evidence surface should additionally include:

- selected tools;
- tool arguments;
- authorization decision;
- execution order;
- state mutations;
- external side effects.

A correct final answer does not prove that an agent used an authorized or safe trajectory.

## Regression

A defect should produce:

```text
Finding
  ↓
Minimal reproduction
  ↓
Regression test
  ↓
Generalized property
  ↓
Related-risk search
```

The current engine records actionable regression cases from findings and links them into the proof graph.

## CLI

```bash
npx hashcode-quality check --profile standard
npx hashcode-quality prove
npx hashcode-quality evidence
npx hashcode-quality regressions
npx hashcode-quality explain-proof --json
```

The commands inspect the latest persisted run under:

```text
.hashcode-quality/runs/
```

## Requirement configuration

A project can declare proof-oriented requirements in `quality.yaml`:

```yaml
requirements:
  - id: payment_idempotency
    statement: "A payment request with the same idempotency key never creates a second charge"
    risk: CRITICAL
    acceptance_criteria:
      - "one logical payment produces one charge"
    invariants:
      - "same idempotency key maps to one charge"
    required_evidence:
      - exitCode
```

The requirement becomes part of the proof graph and can be connected to future domain-specific adapters.

## Design rule

HashCode Quality should prefer a smaller number of strong, independently justified proof signals over a large number of superficial checks.

A green test suite is valuable evidence. It is not, by itself, proof of every property of the system.
