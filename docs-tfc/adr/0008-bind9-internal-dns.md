# 0008. Internal DNS with BIND9

- Status: accepted
- Date: 2026-04-27
- Deciders: Francisco
- Tags: networking, dns, infrastructure

## Context and Problem Statement

Up to Phase 5 every service in the compose stack referenced its peers
by Docker service name (`postgres`, `mongo`, `app`). That works while
everything lives in the same compose network — Docker's embedded DNS
resolves the names automatically — but it does not survive Phase 7,
where the application moves to a LAN segment and the proxy moves to
a DMZ behind OPNsense. Across segments there is no shared embedded
DNS to lean on.

The TFC needs a DNS layer that:

1. Gives each service a stable name that behaves the same on the
   laptop, in CI and in the eventual VM-based deployment.
2. Lets Phase 7 relocate services across network segments by editing
   one set of records, not by chasing references through the entire
   stack.
3. Reflects how a real operator would build a small private network
   — this is a TFC about infrastructure, and DNS is part of it.

This ADR records how that layer is structured and why.

## Decision Drivers

- The DNS resolution has to work uniformly: same names from the app,
  from Nginx, from import scripts, from a Phase 9 monitor.
- The configuration must be in the repository, reviewable, and
  testable in CI without external dependencies.
- The names must be unambiguous and not collide with public DNS. A
  client that mistypes a query should not accidentally hit a real
  domain.
- The server should not act as a recursive resolver. Public DNS
  resolution stays the responsibility of the host's resolver, both
  for security (smaller attack surface) and for separation of
  concerns.
- Phase 7's transition to LAN/DMZ has to be a single-file edit, not
  a refactor.

## Considered Options

- **Option A** — A self-hosted BIND9 instance, authoritative for an
  internal zone, configured through a versioned `named.conf` and
  zone files.
- **Option B** — Use Docker's embedded DNS only, with service names
  for inter-service communication. Skip a real DNS layer entirely.
- **Option C** — Use a lightweight alternative such as `dnsmasq` or
  CoreDNS instead of BIND9.
- **Option D** — Inline `extra_hosts` entries (`/etc/hosts` overrides)
  in each compose service, mapping FQDNs to fixed IPs.

## Decision Outcome

Chosen option: "**Option A — BIND9 authoritative for `cologne.local`**".
A `bind9` service is added to the compose stack with a fixed IP and
acts as the primary resolver for every other service via the compose
`dns:` directive. The zone file `db.cologne.local` defines five A
records (`ns`, `db-pg`, `db-mongo`, `api`, `proxy`) plus the
matching reverse zone `db.172.28`. Service-to-service references in
Nginx and in the application's environment variables now use FQDNs
(`api.cologne.local:8000`, `mongodb://db-mongo.cologne.local:27017`).

The BIND9 server does not recurse — queries for anything outside
`cologne.local` return `REFUSED`. That is intentional: this server
exists only to give internal services FQDNs they can use to reach
each other.

The IP-pinning is done in compose via a fixed subnet
(`172.28.0.0/24`) and `networks.default.ipv4_address` per service.
The zone file references those exact IPs. The two files must agree;
in Phase 7 only the right-hand side of the A records changes (to
LAN/DMZ addresses) and the rest of the project follows automatically.

### Positive Consequences

- Same FQDN works from every service, including from one-shot
  containers like the import jobs. Phase 7's transition is a single
  edit to the zone file.
- The configuration is plain text, in the repo, reviewable. A future
  reader can see the entire DNS surface in one screen.
- Authoritative-only with a tight `allow-query` ACL keeps the attack
  surface minimal: this server cannot be abused as an open resolver
  from outside the compose network.
- Forward and reverse zones make `dig -x` work, which is small but
  professional and useful for debugging.
- Decouples application configuration from compose service-naming
  conventions. The application no longer "knows" it lives in a
  compose stack.

### Negative Consequences

- One more service in the stack, with its own healthcheck, image
  size and startup time (BIND9 starts in roughly two seconds; not
  a real cost, but it is non-zero).
- The BIND9 image used (`ubuntu/bind9`) is minimal and ships
  without `dig` or `nslookup`. The healthcheck has to use `pgrep`
  to confirm the daemon is alive instead of asking the daemon a
  question, which is slightly less rigorous. Practical mitigation:
  if `named` parses a broken config it exits and `pgrep` reports
  the failure correctly.
- The zone file and the compose IPs must be kept in sync by hand.
  No automation enforces this. Reviewers should sanity-check both
  when touching service IPs. This is a tractable trade-off: the
  alternative of generating one from the other adds machinery for
  a five-record zone.

## Pros and Cons of the Options

### Option A — BIND9

- Good, because BIND9 is the de facto reference DNS server. Anyone
  evaluating the project will recognise the configuration syntax.
- Good, because it scales naturally to the Phase 7 split: the same
  server can be moved to the DMZ unchanged, with its zone file
  updated to the new IPs.
- Good, because the configuration lives in the repo and is testable
  end-to-end in CI.
- Bad, because the official ISC image and the Ubuntu image both
  have rough edges (different file paths, missing tools, different
  default users) that took a few iterations to get right.

### Option B — Docker embedded DNS only

- Good, because zero new components.
- Good, because the embedded resolver "just works" for compose
  service names.
- Bad, because it does not survive Phase 7. The whole point of
  introducing FQDNs now is to make the LAN/DMZ transition a
  rename rather than a refactor.
- Bad, because service names are not FQDNs. Nothing inside the
  application knows it is in a compose network rather than a real
  network, and that abstraction is part of what the TFC is meant
  to demonstrate.

### Option C — dnsmasq or CoreDNS

- Good, because both are lighter than BIND9 and have shorter
  configuration syntax.
- Good, because CoreDNS in particular is the dominant choice in
  Kubernetes and is a real-world skill.
- Bad, because the TFC's grading context is a Higher VET-level
  programme in systems administration. BIND9 is the canonical
  textbook DNS server and matches the curriculum.
- Bad, because Phase 7 will be defended in front of a tribunal that
  will recognise BIND9 immediately. CoreDNS would warrant a
  digression on why a less-common tool was picked.

### Option D — `extra_hosts` per service

- Good, because no extra container at all.
- Good, because the configuration is in compose itself, no extra
  files.
- Bad, because every service has to have the full hosts list copied
  into it, with no single source of truth. Updating one IP means
  editing N services.
- Bad, because there is no reverse lookup, no concept of a zone, no
  way to extend the names without redeploying every container.
- Bad, because it teaches the wrong lesson. A TFC on infrastructure
  should not duck the question of running a DNS server.

## Links

- `infra/bind9/named.conf` — BIND9 configuration.
- `infra/bind9/zones/db.cologne.local` — forward zone.
- `infra/bind9/zones/db.172.28` — reverse zone.
- `infra/bind9/README.md` — service map and operational notes.
- `infra/docker-compose.yml` — fixed subnet, pinned IPs, `dns:`
  directives on every service.
- `infra/nginx/nginx.conf` — upstream now uses
  `api.cologne.local`.
- `.github/workflows/ci.yml` — e2e step that asserts DNS
  resolution from inside the network.
- ADR-0001 (repository structure).
