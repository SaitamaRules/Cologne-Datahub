# 0002. Deno as the application runtime

- Status: accepted
- Date: 2026-04-21
- Deciders: Francisco
- Tags: runtime, application

## Context and Problem Statement

The project was originally built during an Erasmus+ placement at the
Zentrum für LehrerInnenbildung (ZfL) in Cologne. The runtime for the
API was not an open choice: the ZfL's internal stack is based on Deno,
and new projects are expected to align with it. For the TFC, the
question is whether to keep Deno (the working baseline) or to migrate
to something else. This ADR records why Deno stays.

## Decision Drivers

- The codebase already works on Deno and the original placement
  deliverable was accepted on that stack.
- Deno's permission flags (`--allow-net`, `--allow-env`,
  `--allow-read`) give me something concrete to talk about in the
  defence when the SEG pillar of the TFC comes up: least privilege is
  not a slogan in the memoria, it is literally visible in the
  Dockerfile's `CMD`.
- TypeScript works natively, without a separate build step. For a
  project this size, not having to maintain `tsconfig`, a bundler and
  a linter configuration saves real time.
- The chosen web framework (Hono, ADR-0003) supports Deno as a
  first-class target, so the runtime and framework decisions reinforce
  each other rather than fight.

## Considered Options

- **Option A** — Keep Deno 2.x.
- **Option B** — Rewrite on Node.js 20 with TypeScript.
- **Option C** — Rewrite on Bun.

## Decision Outcome

Chosen option: "**Option A — keep Deno 2.x**". The practical reason is
that the original placement required it; the technical reason is that
the permission model and the built-in tooling are genuinely well
suited to a small, security-focused project, and I would argue for
Deno even if the choice were open.

### Positive Consequences

- The Dockerfile ends with an explicit list of permissions that I can
  defend line by line.
- `deno fmt`, `deno lint`, `deno check` and `deno test` replace an
  entire separate tooling stack.
- `deno.lock` gives reproducible dependency resolution without a
  `node_modules` folder in the image.
- No code has to be rewritten for the TFC; I can spend the time on
  the infrastructure work, which is what the TFC is really about.

### Negative Consequences

- The ecosystem is smaller than Node's. For what this project needs
  (Postgres driver, MongoDB driver, `proj4`, Hono) it is enough, but
  I have to check compatibility one library at a time.
- Dependabot does not track Deno dependencies yet; I have to review
  upgrades to `deno.json` manually.
- Some reviewers will know Node better than Deno. The memoria needs
  to explain the runtime choice, which is partly what this ADR is
  for.

## Pros and Cons of the Options

### Option A — Deno 2.x

- Good, because the project already runs on it.
- Good, because the permission model is useful for the security
  narrative of the TFC.
- Good, because the tooling is built in.
- Bad, because the ecosystem is narrower.

### Option B — Node.js 20 + TypeScript

- Good, because it is the default in the industry and reviewers know
  it well.
- Good, because the npm ecosystem is much larger.
- Bad, because it would mean rewriting a working project for no real
  gain, at the cost of time that is better spent on the new TFC
  objectives.
- Bad, because Node has no process-level permission flags, so the
  security narrative would have to stop at the container boundary
  instead of reaching into the runtime itself.

### Option C — Bun

- Good, because it is fast and also ships its own tooling.
- Bad, because it is younger and I have no experience operating it
  under pressure.
- Bad, because it would mean rewriting the project just to trade one
  runtime for another, with no permission model to compensate.

## Links

- `app/Dockerfile` — explicit permission flags on the final `CMD`.
- ADR-0003 — Hono as the web framework.
