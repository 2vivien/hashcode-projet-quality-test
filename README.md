# HashCode Quality

[![Open Source](https://img.shields.io/badge/open--source-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/hashcode-quality.svg)](https://www.npmjs.com/package/hashcode-quality)

**Universal, risk-based quality engineering CLI for software and AI projects.**

HashCode Quality helps developers and AI coding agents inspect a project, understand its stack, select proportionate quality controls and produce evidence-based quality decisions.

> **Tooling finds signals. Tests prove behavior. Engineering analysis finds causes. Issues make correction actionable. The final gate requires evidence.**

## Quick start

No global installation is required:

```bash
npx hashcode-quality init
npx hashcode-quality doctor
npx hashcode-quality audit
npx hashcode-quality check --profile standard
```

With pnpm:

```bash
pnpm dlx hashcode-quality init
pnpm dlx hashcode-quality audit
pnpm dlx hashcode-quality check --profile standard
```

For a project-local installation:

```bash
npm install --save-dev hashcode-quality
```

or:

```bash
pnpm add -D hashcode-quality
```

> The package is designed for Node.js 20+.

## What it does

HashCode Quality is deliberately **stack-aware and risk-based**. It does not force every project to install or execute every quality tool.

The intended pipeline is:

```text
Intent
  ↓
Reconnaissance
  ↓
Version + official documentation research
  ↓
Domain/system model
  ↓
Requirements + invariants
  ↓
Risk model
  ↓
Stack-aware tool selection
  ↓
Acceptance tests
  ↓
Minimal correct implementation
  ↓
Targeted tests
  ↓
Deep quality checks
  ↓
Security / resilience / performance
  ↓
Anti-surengineering
  ↓
Issue intelligence
  ↓
Regression verification
  ↓
Final quality gate
```

## CLI

| Command | Purpose |
|---|---|
| `init` | Creates a starter `quality.yaml` |
| `doctor` | Detects the project stack and available tools |
| `audit` | Recommends quality controls for the detected stack |
| `check` | Runs the project's available quality scripts |
| `prompt` | Prints a bundled HashCode quality-engineering prompt |
| `prove` | Explains proof receipts from the latest run |
| `eval` | Reviews the latest evaluation/proof result |
| `evidence` | Lists execution evidence captured by the engine |
| `regressions` | Lists generated regression cases |
| `explain-proof` | Shows the auditable proof explanation |

Machine-readable output is available with `--json` for supported commands.

## Proof Engine

HashCode Quality separates **execution success** from **proof**:

```text
PASS       = the execution did not violate the selected oracle
PROVEN     = the declared requirement was established by its oracle(s)
             using the required evidence, within the declared scope
```

Every proof receipt records the requirement, risk, oracle definitions, execution, evidence, evaluator verdicts, confidence, reproducibility gaps and proof hash. High-risk/critical proof can require independent proof signals. An evaluator, including an LLM judge, is treated as evidence with uncertainty rather than as ground truth.

The proof graph connects:

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

Inspect the latest run with:

```bash
npx hashcode-quality check --profile standard
npx hashcode-quality prove
npx hashcode-quality evidence
npx hashcode-quality regressions
npx hashcode-quality explain-proof --json
```

## Profiles

- **minimal** — fast feedback for small changes;
- **standard** — normal development workflow;
- **production** — release-oriented quality controls;
- **ai** — production controls plus AI/agent evaluation concerns.

The profiles are documented in `quality.yaml` and the architecture documentation.

## Quality dimensions

1. Code quality
2. Test quality
3. Domain correctness
4. Data integrity
5. Architecture
6. Security
7. Resilience
8. Performance
9. Observability
10. Supply chain
11. AI quality
12. Anti-surengineering

## Tooling strategy

Typical integrations include Knip, ESLint, TypeScript, Vitest, Playwright, dependency-cruiser, jscpd, Gitleaks, Semgrep, Trivy, Syft, Checkov, axe and Lighthouse CI when the stack and risk justify them.

HashCode Quality does **not** treat an individual static-analysis finding as an automatic defect. Findings must be contextualized, corroborated and made actionable. Unused code, duplication and dead CSS are advisory by default.

## AI projects

The framework also covers AI/LLM and agentic systems:

- golden datasets;
- prompt/model regression;
- grounding and factuality evaluation;
- prompt-injection tests;
- tool authorization and dangerous-action tests;
- data-leakage checks;
- structured-output validation;
- cost and latency regression;
- model/provider compatibility;
- agent workflow regression.

## Documentation

- `docs/UNIVERSAL-QUALITY-ARCHITECTURE.md` — architecture of the framework
- `docs/OPEN-SOURCE-TOOLCHAIN.md` — open-source toolchain
- `docs/OPEN-SOURCE-REPOSITORY-STANDARDS.md` — public repository standards
- `docs/NPM-PNPM-CLI.md` — npm/pnpm package and CLI guide
- `docs/ISSUE-QUALITY-SPECIFICATION.md` — Issue contract
- `docs/PROOF-ENGINE-V3.md` — Proof Engine v3 specification
- `quality.yaml` — quality profiles and policies
- `prompts/` — reusable AI engineering prompts
- `CHANGELOG.md` — release history

## Contributing

Read `CONTRIBUTING.md` before opening a Pull Request. Bug reports and feature requests use the GitHub Issue templates.

## Security

Do not publish credentials, tokens, private keys or sensitive data. For security vulnerabilities, follow `SECURITY.md` rather than opening a public Issue.

## License

HashCode Quality is released under the MIT License. See `LICENSE`.

## Status

The npm package and CLI are the public foundation of the HashCode Quality project. The Proof Engine v3 is the evidence and verification foundation for the broader multi-tool quality engine.
