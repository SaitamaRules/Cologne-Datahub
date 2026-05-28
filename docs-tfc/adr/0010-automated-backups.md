# 0010. Automated backups for the data tier

- Status: accepted
- Date: 2026-05-28
- Deciders: Francisco
- Tags: backups, operations, data, infrastructure

## Context and Problem Statement

Phase 7 placed both databases on `vm-db` in the LAN segment, and the
catalogue they hold is consumed by real users — university students
querying Cologne's tree register — not just by the developer. Until
now nothing protected that data: a corrupted volume, a bad migration
or a deleted collection would be unrecoverable.

Phase 8 adds scheduled, unattended backups of PostgreSQL and MongoDB,
plus a copy of the OPNsense running configuration (which Phase 7
promised to treat as data, not code). The phase is deliberately small
in scope, but its execution must be production-grade: the backups have
to run on their own, be retained sensibly, and be restorable. This ADR
records how the backups are orchestrated and why.

## Decision Drivers

- Reliability first. Real users depend on the data, so the mechanism
  must run unattended and produce restorable artifacts.
- Minimal footprint and few moving parts. The phase should add the
  smallest thing that does the job well, with no gold-plating.
- Reproducible from the repository. The schedule and wiring should be
  versioned, not live as hidden host state that a fresh rebuild would
  miss.
- No secrets in git. Database credentials already live only in the
  host `.env`; the backup path must not change that.
- Consistency with the existing stack. Everything else on the host is
  orchestrated by Docker Compose; the backup mechanism should fit the
  same model rather than introduce a parallel one.
- It must run on `vm-db` itself, where the data and the database
  sockets already are.

## Considered Options

- **Option A** — An Ofelia sidecar that reads its schedule from
  container labels and execs a purpose-built `backup` container
  holding the dump tooling.
- **Option B** — A host `cron` job on `vm-db` invoking the backup
  script directly.
- **Option C** — A dedicated backup framework (e.g. pgBackRest for
  PostgreSQL with WAL archiving, plus a scripted `mongodump`),
  offering point-in-time recovery.
- **Option D** — A managed or off-host backup agent (e.g. restic/borg
  to a remote repository, or a cloud backup service).

## Decision Outcome

Chosen option: "**Option A — Ofelia sidecar**". A small `backup`
container built on the `postgres:16` image (adding the MongoDB
Database Tools and `curl`) holds `backup.sh` and `restore.sh` and
idles. An `mcuadros/ofelia` container runs alongside it and triggers
`backup.sh` once a day at 03:00, reading that schedule from labels on
the `backup` service. Credentials are injected from the host `.env`
via `env_file`, so no secret is committed.

`backup.sh` produces a single timestamped `tar.gz` containing a
PostgreSQL dump (`pg_dump`, custom format), a MongoDB dump
(`mongodump`, gzipped archive) and — when the firewall API is
configured — the OPNsense running configuration pulled over its REST
API. The OPNsense pull is best-effort: a failure logs a warning and
never aborts the database backup. Retention is seven daily copies plus
four weekly copies, the weekly snapshot promoted from the daily set on
Sundays.

`restore.sh` is the symmetric, manual counterpart (`pg_restore
--clean --if-exists`, `mongorestore --drop`), intended to be run by an
operator against a chosen archive. The step-by-step operational
restore procedure belongs to the Phase 10 runbook rather than here.

Two boundaries were set deliberately and are recorded so they read as
choices rather than omissions: backups are stored locally on the host,
with off-host replication (the third leg of a 3-2-1 strategy) and
at-rest encryption left out of scope for this phase; and no live
restore drill was performed as part of closing the phase — the
capability is in the repository and the procedure is documented, but
the rehearsed restore is deferred to the runbook.

### Positive Consequences

- The backup cadence is declared in the compose file, so a fresh
  rebuild of `vm-db` from the repository carries its own schedule
  rather than depending on a crontab someone has to remember to
  recreate.
- Secrets never leave the host `.env`; the scheduler and the tooling
  read them at container creation, and nothing sensitive is committed.
- The mechanism is uniform with the rest of the stack — Compose
  services and a shell script — so a reader of the repo has nothing
  new to learn.
- A single self-contained archive per run keeps both databases and the
  firewall config consistent as one unit and makes rotation trivial.
- The firewall configuration is captured as data on the same schedule
  as the databases, closing the promise made in Phase 7.

### Negative Consequences

- The `backup` container idles permanently just to host the tooling
  and receive `exec` calls. It is cheap, but it is a process that
  exists only to be scheduled into.
- Ofelia needs the Docker socket mounted to exec into containers.
  Socket access is powerful; it is mounted read-only and the scheduler
  does nothing but run the declared job, but it is a privilege worth
  noting.
- `pg_dump`/`mongodump` are logical dumps, not point-in-time backups.
  For this read-mostly catalogue that is adequate, but the design does
  not provide PITR or transactional consistency across the two
  engines.
- Local-only storage means losing the `vm-db` disk loses the backups
  with it. This is the explicit 3-2-1 gap noted above.

## Pros and Cons of the Options

### Option A — Ofelia sidecar

- Good, because the schedule lives in the compose file and is
  versioned with everything else, so the backup cadence is part of the
  reproducible deployment rather than out-of-band host state.
- Good, because it reuses the existing Docker model — no new
  operational concept — and keeps credentials in `.env` through
  `env_file`.
- Good, because it is low-footprint: one tiny scheduler image plus an
  idle tooling container.
- Bad, because that idle container exists solely to be exec'd into,
  and because Ofelia requires the Docker socket to function.

### Option B — Host cron

- Good, because it is the simplest possible mechanism and universally
  understood; nothing to build.
- Good, because it has no idle helper container and no Docker-socket
  dependency.
- Bad, because the schedule lives in a host crontab that is not in the
  repository, so a rebuilt host silently loses its backups until
  someone reinstates it — exactly the hidden-state problem this TFC
  avoids elsewhere.
- Bad, because the script would still need the dump tooling installed
  on the host or invoked through `docker exec`, reintroducing on-host
  dependencies the containerised stack otherwise avoids.

### Option C — pgBackRest (+ scripted mongodump)

- Good, because it is a serious, battle-tested backup tool with
  point-in-time recovery, parallelism and integrity verification.
- Good, because it would raise the PostgreSQL backup to a genuinely
  professional standard.
- Bad, because it is disproportionate for a single small read-mostly
  database and only solves half the problem — MongoDB still needs a
  separate path — so the result is two dissimilar mechanisms instead
  of one simple one.
- Bad, because WAL archiving and PITR add operational complexity that
  this phase explicitly does not want.

### Option D — Managed / off-host agent

- Good, because shipping backups off the host is the correct
  production answer and would close the 3-2-1 gap.
- Good, because tools like restic/borg add deduplication and
  encryption for free.
- Bad, because it pulls in remote storage, credentials and a network
  egress path that the lab does not have and that this phase does not
  need, expanding scope well beyond "minimal".
- Bad, because it would make the phase about moving and securing data
  off-site, a different problem from the one being solved here.

## Links

- `infra/vm-db/backup/backup.sh` — backup script (dumps + rotation).
- `infra/vm-db/backup/restore.sh` — symmetric manual restore.
- `infra/vm-db/backup/Dockerfile` — backup tooling image.
- `infra/vm-db/docker-compose.yml` — `backup` and `ofelia` services.
- ADR-0009 (OPNsense firewall) — its REST API is the source of the
  configuration captured here as data.
