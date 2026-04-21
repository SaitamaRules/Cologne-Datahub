# 0004. PostgreSQL and MongoDB side by side

- Status: accepted
- Date: 2026-04-21
- Deciders: Francisco
- Tags: data, architecture

## Context and Problem Statement

The Cologne tree registry is a single dataset of around 58 MB in
GeoJSON. In any normal project I would pick one database and move on.
In this one I have two, and they serve the same data through two
different route prefixes. The reason is not architectural: the
Erasmus+ syllabus required modelling the same dataset first in a
relational database (Week 1) and then in a document database (Week 3),
and writing a comparison between the two. The TFC inherits that dual
setup. The question this ADR answers is whether to keep both engines
or collapse onto one now that the pedagogical constraint is behind me.

## Decision Drivers

- The comparative work between PostgreSQL and MongoDB is already done
  and documented in `docs-tfc/DIARY.md`. Dropping one engine would
  make that document talk about something the repository no longer
  shows.
- The TFC is graded on whether I can demonstrate the ASIR learning
  outcomes. Keeping both databases lets me demonstrate schema design
  and B-tree indexing on one side, and document storage with
  `2dsphere` geospatial queries on the other. That is more material
  for the defence, not less.
- Running two database containers is cheap in this project (two
  services, two volumes, two sets of backups). It is not cheap enough
  to be irrelevant, but it is cheap enough that I accept the cost in
  exchange for the pedagogical value.
- The application is already structured around two parallel route
  groups (`/api` and `/api/mongo`). Removing one would require
  editing the OpenAPI spec, the Postman collection, the memoria and
  the diary, none of which is worth the trouble.

## Considered Options

- **Option A** — Keep both databases.
- **Option B** — Keep only PostgreSQL (with PostGIS for geospatial).
- **Option C** — Keep only MongoDB.

## Decision Outcome

Chosen option: "**Option A — keep both databases**". The TFC is partly
about showing that I can work with two different data paradigms, and
the code already does it. Collapsing to one would be a regression
dressed up as simplification.

### Positive Consequences

- The comparative section of the memoria can point at real, running
  code for each side instead of hypothetical examples.
- A reviewer can exercise both route groups from the same Postman
  collection and see the difference in practice.
- The operational work of the TFC (backups in Phase 8, the monitor
  in Phase 9) naturally covers both engines, which makes the examples
  richer.
- The `/health/ready` endpoint already reports per-engine status, so
  partial failures are visible instead of hidden.

### Negative Consequences

- Two database containers mean two backup commands, two restore
  procedures, and two places where something can go wrong.
- Functional parity across the two route groups is maintained by
  discipline, not by the type system. If I change `/api/trees` I
  have to remember to change `/api/mongo/trees` as well, or the
  comparison drifts.
- The Python monitor in Phase 9 will need to check both services,
  slightly widening its scope.

## Pros and Cons of the Options

### Option A — Both databases

- Good, because it keeps the pedagogical comparison intact.
- Good, because `/health/ready` already exposes per-engine state.
- Good, because the memoria has concrete code to cite for each
  modelling style.
- Bad, because operational work roughly doubles for the data tier.

### Option B — PostgreSQL only (with PostGIS)

- Good, because one database is simpler to operate, back up and
  monitor.
- Good, because PostGIS is a mature geospatial stack.
- Bad, because it would throw away the Week 3 work and the
  comparison that depends on it.
- Bad, because the memoria would have to talk about MongoDB as
  something I used to work with, which is a harder story to defend
  than "this is the code, here is how it differs".

### Option C — MongoDB only

- Good, because the dataset is already GeoJSON; it fits documents
  naturally.
- Good, because `2dsphere` solves geospatial queries without an
  extension.
- Bad, because it would discard the Week 1 work on relational
  modelling, normalisation and indexing, which is half of the ASIR
  database curriculum.

## Links

- `app/queries/schema.sql` — relational schema.
- `app/queries/queries_pg.sql` — representative PostgreSQL queries.
- `app/queries/queries_mongo.js` — representative MongoDB queries.
- `docs-tfc/DIARY.md` — comparison table (PostgreSQL vs MongoDB).
- `app/src/routes/arboles.ts` and `app/src/routes/arboles_mongo.ts`
  — parallel route groups.
- `app/src/routes/health.ts` — per-engine readiness reporting.
