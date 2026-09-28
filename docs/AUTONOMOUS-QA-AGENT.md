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

## Authorization intelligence

Authorization is not inferred as proof from route names. The agent needs explicit test identities and, for object-level checks, explicit ownership fixtures.

The fixture model supports:
- role credentials through environment variables;
- owned objects;
- cross-owner object access;
- function-level allow/deny cases;
- forbidden response properties;
- stateful API workflows.

Example:

    {
      "roles": {
        "owner": { "tokenEnv": "HASHCODE_QA_ROLE_OWNER_TOKEN" },
        "other": { "tokenEnv": "HASHCODE_QA_ROLE_OTHER_TOKEN" }
      },
      "objects": {
        "users": [
          { "id": "owner-object", "ownerRole": "owner" },
          { "id": "other-object", "ownerRole": "other" }
        ]
      },
      "authorization": [
        {
          "id": "cross-owner",
          "method": "GET",
          "path": "/api/users/{id}",
          "role": "owner",
          "objectType": "users",
          "objectId": "other-object",
          "expected": "deny"
        }
      ]
    }

The agent never stores the credential itself in the report. Only the role name and a hash of the test inputs are retained in proof evidence.

A BOLA test is:

    Owner identity -> Object A (owned) -> expected ALLOW
                   -> Object B (foreign) -> expected DENY

This directly targets OWASP API1:2023. OWASP describes BOLA as manipulating an object identifier to access another user's object and recommends authorization checks for every endpoint that acts on user-supplied object identifiers. citeturn1search3turn0search14

### Function-level authorization

Explicit functionAuthorization cases test role-to-function boundaries. This targets BFLA: a regular role accessing an administrative or otherwise restricted function. OWASP recommends testing role/group hierarchies and not assuming that administrative functions can be identified safely from URL naming alone. citeturn1search0

### Property-level authorization

Explicit properties cases can declare sensitive fields that a role must never receive. This targets API3:2023, which covers unauthorized object properties and mass-assignment style authorization failures. citeturn1search2

### Stateful API testing

The state-machine layer executes multi-step workflows and carries identifiers observed in earlier responses into later requests. Schemathesis uses the same core principle: stateful testing chains operations using real data from responses, with OpenAPI links and dependency analysis used to discover relationships. citeturn0search8turn0search0

HashCode accepts explicit workflows when business semantics are known and can also build conservative automatic chains from discovered API operations.

### Authorization proof

Authorization observations are converted into Proof Engine receipts:

    role + object ownership + HTTP response
                    |
                    v
             EXACT status oracle
                    +
             INVARIANT oracle
                    |
                    v
              PROOF RECEIPT

Critical denial cases require two oracle types. A single HTTP response is therefore not silently promoted to a critical proof.

### Secrets and evidence

API response samples are redacted for common credential fields and bearer tokens before they enter persisted evidence. Credentials are read from environment variables and are never intentionally serialized into the report.

Browser traces and screenshots are published to GitHub only when issue reporting is explicitly enabled.