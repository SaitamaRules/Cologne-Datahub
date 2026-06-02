# 0011. Service monitoring with a standard-library Python daemon

- Status: accepted
- Date: 2026-05-28
- Deciders: Francisco
- Tags: monitoring, operations, observability, infrastructure

## Context and Problem Statement

The lab now spans three VMs and runs several long-lived services
(PostgreSQL, MongoDB, the Deno API, Nginx, BIND9) whose users are real
people querying the tree catalogue. Until now nothing watched them: a
crashed container or an unreachable host would only be noticed by
chance, or by a user hitting an error.

Phase 9 adds a monitor that knows whether each service is reachable and
tells the operator when that changes. The phase is deliberately small —
the goal is availability awareness, not a full observability stack.
This ADR records how the monitoring is built and why.

## Decision Drivers

- Proportion to scale. Five services on three VMs is a small estate;
  the monitor should match it, not a fleet.
- Minimal footprint and dependency surface. The less there is to
  install, patch and reason about, the better — ideally nothing beyond
  what the base runtime already ships.
- It must run unattended in the LAN and reach services across the
  segments without weakening the firewall posture more than necessary.
- Alerts should be actionable and quiet: a notification when something
  changes, not a stream of "still down" noise.
- The mechanism must be legible and defensible — a tribunal should be
  able to read it end to end in a few minutes.

## Considered Options

- **Option A** — A small Python daemon using the standard library only
  (`socket` for TCP probes, `urllib` for Telegram), running as a
  container.
- **Option B** — A Prometheus + Grafana stack with per-service
  exporters and Alertmanager.
- **Option C** — Uptime Kuma, a self-hosted uptime monitor with a web
  UI and built-in notifiers.
- **Option D** — A hosted/SaaS uptime monitor (e.g. UptimeRobot,
  Healthchecks.io) probing the services from outside.

## Decision Outcome

Chosen option: "**Option A — standard-library Python daemon**". A
container on `vm-db` opens a TCP connection to each watched service
every 30 seconds. A successful connect is "up", a refused connection or
timeout is "down". The databases are reached locally by Docker service
name; the API, Nginx and BIND9 are reached across the segments by their
lab IP. State is kept in memory and an alert is emitted only on an
up↔down transition, so a service that stays down is announced once, not
every cycle.

Alerts are delivered to Telegram through `urllib` — no third-party
client library — and fall back to log-only output when the bot
credentials are not set, so the monitor is useful from first boot and
the chat integration can be enabled later. The image is `python:3.12-slim`
with no `pip` installs; the only addition is the OS `ca-certificates`
package so TLS to the Telegram API verifies. Reaching the API port from
the monitoring host required a single least-privilege UFW allow on
`vm-app` (`10.10.10.10 → :8000`), mirroring the existing proxy-only
rule.

Two boundaries were set deliberately: the monitor reports availability
(up/down), not metrics — there is no time-series storage, no historical
graphing, no per-service resource data; and in the lab it currently
runs in log-only mode, with the Telegram channel built and ready but
its delivery not yet exercised end to end. Both are recorded as choices
rather than gaps.

### Positive Consequences

- Nothing to install or patch beyond the base image: no exporters, no
  agents, no dashboard server, no dependency tree to keep current.
- The whole monitor is one short, readable file; its behaviour can be
  understood and defended directly, with no framework conventions in
  the way.
- Alerting on transitions only keeps notifications meaningful and
  avoids alarm fatigue.
- It fits the existing model — one more container in the `vm-db`
  compose — and adds no inbound surface: the monitor publishes no
  ports and holds no Docker socket.

### Negative Consequences

- A TCP connect proves the port is accepting connections, not that the
  service behind it is healthy at the application layer. A database
  that listens but cannot serve queries would still read as "up".
- There is no history: the monitor knows the current state and the last
  transition, but it cannot answer "how often did this flap last week".
- Telegram as the sole channel is a single point of failure for
  alerting, and depends on outbound internet reachability from the lab.

## Pros and Cons of the Options

### Option A — Standard-library Python daemon

- Good, because it has effectively zero dependency surface and is small
  enough to read and defend in full.
- Good, because it fits the existing Docker model and adds no inbound
  attack surface.
- Good, because transition-only alerting is exactly the signal the
  operator needs at this scale.
- Bad, because it does TCP-level checks only and keeps no history; it
  is availability awareness, not observability.

### Option B — Prometheus + Grafana + exporters

- Good, because it is the industry-standard observability stack with
  metrics, history, dashboards and rich alerting.
- Good, because the skills transfer directly to production environments.
- Bad, because it is heavily disproportionate for five services: an
  exporter per service, a scrape server, a dashboard server and an
  alert router, all to be deployed, secured and patched.
- Bad, because the resource and maintenance cost dwarfs the problem
  being solved in this lab.

### Option C — Uptime Kuma

- Good, because it is purpose-built for uptime monitoring with a clean
  UI and many built-in notifiers, including Telegram.
- Good, because it would require almost no custom code.
- Bad, because it is an external application with its own database,
  release cadence and attack surface to maintain — more than this
  phase wants, and less transparent to defend than a file that can be
  read top to bottom.

### Option D — Hosted / SaaS uptime monitor

- Good, because it removes all local maintenance and probes from an
  independent vantage point outside the lab.
- Bad, because the lab's services live behind the firewall on private
  segments; an external probe cannot reach the API, the databases or
  the internal DNS without poking holes in the perimeter that defeat
  the Phase 7 posture.
- Bad, because it puts the lab's availability data in a third party and
  adds an external dependency the project otherwise avoids.

## Links

- `infra/vm-db/monitor/monitor.py` — the monitor daemon.
- `infra/vm-db/monitor/Dockerfile` — the stdlib-only image.
- `infra/vm-db/docker-compose.yml` — the `monitor` service.
- ADR-0009 (OPNsense firewall) — the perimeter posture that makes an
  in-LAN monitor the natural fit over an external prober.
