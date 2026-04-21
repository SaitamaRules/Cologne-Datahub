# 0001. Repository layout for the TFC phase

- Status: accepted
- Date: 2026-04-21
- Deciders: Francisco
- Tags: structure, tfc

## Context and Problem Statement

The Cologne DataHub repository originally contained only the application
code (Deno API, SQL queries, import scripts, Postman collection and API
docs) at its root. The TFC extends the project with infrastructure work
(Docker Compose stack, Nginx, BIND9, OPNsense config), operational
tooling (backup scripts, Python monitor) and academic artifacts
(memoria, ADRs, diagrams). A layout decision is needed that keeps the
application self-contained while making room for infrastructure and
documentation without cross-contamination.

## Decision Drivers

- Clear separation between application code and infrastructure.
- Ability to `cd app/` and work on the API in isolation (Deno, tests).
- Room for TFC-level docs (memoria, ADRs, diagrams, runbook) that do
  not belong inside the application.
- Single repository — the TFC is graded as one deliverable.
- Defensibility in the oral exam: the structure should be
  self-explanatory to a reviewer opening the repo for the first time.

## Considered Options

- **Option A** — Flat layout, keep everything at root.
- **Option B** — Multi-module layout: `/app`, `/infra`, `/scripts`,
  `/docs-tfc`.
- **Option C** — Split into two repositories (application vs
  infrastructure).

## Decision Outcome

Chosen option: "**Option B — multi-module layout**", because it
separates concerns cleanly within a single repository and each folder
has a single responsibility that maps directly to a TFC objective
(application, infrastructure, operations, documentation).

### Positive Consequences

- `/app/` is self-contained: `cd app && deno task dev` works with no
  root-level surprises.
- `/infra/` is the obvious home for Docker Compose, Nginx and BIND9
  configs in Phase 1+ without polluting the application folder.
- `/scripts/` at root is reserved for operational scripts (backups,
  monitor) that span the whole stack, distinct from the
  application-level scripts that live in `/app/scripts/`.
- `/docs-tfc/` isolates academic artifacts (memoria, ADRs, diagrams,
  runbook) from the application's own API docs (`/app/docs/`).
- The Makefile at root can orchestrate operations across folders.

### Negative Consequences

- A one-time cost: all existing paths shift by one level
  (`src/` → `app/src/`), invalidating any external bookmarks.
- Tooling invocations must be aware of the subfolder: running Deno
  requires `cd app/` first (mitigated by the Makefile).
- GitHub Actions workflows will need `working-directory: ./app` for
  Deno-related jobs.

## Pros and Cons of the Options

### Option A — Flat layout

- Good, because it requires zero migration effort.
- Good, because tooling runs with no wrappers.
- Bad, because it mixes application, infrastructure and documentation
  at the same level, making responsibilities unclear.
- Bad, because future additions (nginx configs, backup scripts,
  memoria) would collide or nest awkwardly.

### Option B — Multi-module layout

- Good, because it maps 1:1 to the four TFC objectives.
- Good, because each folder can evolve independently.
- Good, because it is the expected shape of a serious project in a
  reviewer's eyes.
- Bad, because of the initial migration cost.
- Bad, because tooling needs to know the subfolder.

### Option C — Two repositories

- Good, because it enforces strict separation.
- Bad, because the TFC is graded as one deliverable; splitting it
  complicates versioning and submission.
- Bad, because cross-references (a memoria that embeds application
  code snippets) become harder to maintain.
- Bad, because CI/CD spans both components.

## Links

- `PLAN_TFC.md` — Phase 0 (Baseline and repo professionalization).
