# HashCode Proof Intelligence — Karpathy-Inspired Principles

## Purpose

HashCode must never turn "a test passed" into an unqualified claim that a feature is correct.

A feature is considered **PROVEN** only for a precisely stated requirement, under a declared oracle, using captured evidence, with an explicit record of what was not evaluated.

## Principles extracted from Karpathy's public repositories

### 1. Freeze the evaluation harness

Inspired by `karpathy/autoresearch`: the evaluation harness is deliberately separated from the code being experimented on. `prepare.py` contains fixed data preparation and the ground-truth evaluation; the experimenter changes `train.py`, not the evaluator.

HashCode equivalent:

- requirements and acceptance criteria are immutable inputs to a run;
- the oracle definition is versioned;
- test/evaluation data is identified and hashed;
- the code under test cannot silently rewrite its own oracle;
- evaluator configuration is part of the evidence.

### 2. Measure against a fixed reference

Karpathy's autoresearch uses a fixed validation shard and a fixed `val_bpb` metric. nanochat similarly reports explicit `val_bpb` and CORE metrics and records commit identifiers for runs.

HashCode equivalent:

- every proof has a named dataset/fixture/reference;
- every result records the dataset identity/version/hash when available;
- baseline and candidate results are distinguishable;
- "improved" or "passed" always has a declared comparison rule.

### 3. Experiments are commits plus measurements

autoresearch records the experiment commit, metric, memory, status, and description, and keeps/discards changes based on the fixed metric.

HashCode equivalent:

- proof receipts bind to git SHA;
- executions capture command, timestamp, duration and outputs;
- evaluations record the oracle verdict;
- regression history can be reconstructed from receipts.

### 4. Simplicity is part of engineering quality

autoresearch explicitly treats unnecessary complexity as a cost. llm.c also keeps the root implementation deliberately simple and uses a reference implementation as an anchor.

HashCode equivalent:

- a proof does not justify arbitrary complexity;
- each additional oracle/evaluator has a cost;
- deterministic oracles are preferred over LLM judges when both can answer the requirement;
- proof plans should choose the smallest sufficient oracle set.

### 5. Reference implementations are valuable oracles

micrograd validates its gradients against PyTorch. That is a concrete example of differential/reference-based verification: the implementation under test is compared against an independently trusted implementation.

HashCode equivalent:

- support DIFFERENTIAL oracles;
- compare implementation A vs independent reference B;
- do not treat two implementations sharing the same bug as independent proof;
- record both versions and comparison inputs.

### 6. Reproducibility matters

build-nanogpt deliberately keeps commits small and sequential so the construction and changes can be inspected. autoresearch also works from explicit commits and experiment logs.

HashCode equivalent:

- evidence must be traceable to a commit;
- proof receipts have stable hashes;
- runs should retain enough metadata to reproduce the observation;
- missing reproducibility metadata lowers proof strength.

### 7. One metric never proves the whole system

nanochat tracks several measurements such as validation loss, CORE score, VRAM, throughput and training time. A single metric describes one property.

HashCode equivalent:

- proof is scoped to a requirement;
- one passing check does not prove unrelated behavior;
- receipts explicitly list remaining unproven properties;
- quality gates aggregate many requirement-level proofs rather than pretending one score is universal.

## Proof rule

HashCode uses this hierarchy:

1. **Deterministic oracle** — exact/schema/invariant/property/reference comparison.
2. **Structured evidence** — logs, HTTP responses, DB state, DOM state, traces, artifacts.
3. **Semantic evaluator** — only when deterministic verification cannot establish the criterion.
4. **Human review** — for high-consequence properties that cannot be safely automated.

An LLM judge is evidence, not ground truth.

## Required proof receipt

A receipt must answer:

- What requirement was evaluated?
- What risk justified evaluating it?
- Which oracle was used?
- Which evaluator/version was used?
- What data/input was evaluated?
- What evidence was captured?
- What was the oracle's verdict?
- What confidence/uncertainty exists?
- Which exact properties were verified?
- Which properties remain unverified?
- Which commit produced the behavior?
- Can the result be reproduced?
- What is the immutable receipt hash?

## Status semantics

- **PROVEN**: every required oracle passed and required evidence exists.
- **NOT_PROVEN**: an oracle demonstrated that the requirement was not satisfied.
- **INSUFFICIENT_PROOF**: required evidence or evaluation is missing.
- **INCONCLUSIVE**: evaluation ran but could not establish a reliable verdict.

Never silently convert INSUFFICIENT_PROOF or INCONCLUSIVE to PASS.

## The central distinction

`PASS` means:

> This execution did not violate the oracle.

`PROVEN` means:

> The declared requirement was established by the declared oracle using the declared evidence, within the declared scope.

These are intentionally different concepts.
