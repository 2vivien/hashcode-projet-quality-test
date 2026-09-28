# Autonomous QA Agent

The Autonomous QA Agent is the execution layer above the HashCode Proof Engine.

## Pipeline

Source tree -> application surface -> scenarios -> risk priority -> browser/API execution -> evidence -> finding fingerprint -> optional GitHub issue.

### Application surface

The agent discovers Next.js pages, API handlers, OpenAPI operations and role-related signals. Next.js uses file-system routing, so route discovery starts from app/ and pages/ files.

### Browser exploration

When Playwright is installed, the agent explores same-origin pages up to configured depth and page limits. It records HTTP status, console errors, page errors, failed requests and 5xx responses. Failed pages receive a screenshot and a Playwright trace.

### API probing

OpenAPI operations and discovered API handlers are probed against the configured base URL. Mutation methods are skipped by default. The explicit --allow-mutations flag is required to enable them.

### Scenario generation

Scenarios cover page navigation, browser health, negative navigation for dynamic routes, API operations and role-oriented navigation. Scenarios are ordered by risk before execution.

### GitHub reporting

Issue creation is opt-in:

    npx hashcode-quality agent --base-url=http://localhost:3000 --open-issues

The reporter fingerprints findings, avoids duplicate open issues, optionally publishes screenshots under qa-artifacts/<run-id>/ and creates a structured issue containing the run ID, Git SHA and reproduction information.

### Evidence boundary

A crawler observation is not automatically a proof. The Proof Engine remains the authority for requirement-level proof. This keeps execution, evidence, evaluation and proof separate.

### Safety boundary

The default agent is observational. It does not execute mutation API methods. Use a disposable test environment before enabling mutation execution.

### Artifacts

Runs are persisted under .hashcode-quality/agent-runs/<run-id>/ with report.json and browser artifacts.

### Extension point

The next major extension is a credential-aware role matrix: role credentials -> route matrix -> object ownership matrix -> expected allow/deny oracle -> execution -> proof. This is where stronger access-control, stateful workflow and business-flow testing belongs.
