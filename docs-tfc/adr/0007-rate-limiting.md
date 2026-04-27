# 0007. Rate limiting at the Nginx layer

- Status: accepted
- Date: 2026-04-27
- Deciders: Francisco
- Tags: security, performance, nginx

## Context and Problem Statement

After Phase 4 the project terminates TLS at Nginx and proxies to the
application without any traffic shaping in between. A single hostile
client — credential-stuffing the API key, scraping the public dataset
at full speed, or running a small L7 denial-of-service — would reach
the application unhindered, exhaust the connection pool and waste
database CPU.

The project needs an answer to "what stops one client from sending a
million requests a minute". This ADR records that answer for the L7
side. The L3/L4 side (state-table limits, SYN flood mitigation) is
the responsibility of OPNsense in Phase 7, and that decision will be
recorded separately.

## Decision Drivers

- The defence has to be in place before the project ever leaves the
  laptop. By Phase 7 the application sits behind a firewall, but the
  laptop development environment is also a valid threat surface (a
  rogue script on the developer machine should not bring the API
  down).
- Limits must apply per client, not globally. A global limit would
  let one client crowd out everyone else.
- Different routes have different cost profiles. Reads are cheap and
  expected; writes are expensive and rare; documentation is one-shot.
  A one-size-fits-all limit would either be too tight on reads or
  too loose on writes.
- Rejected traffic must never reach the application. The whole point
  is to keep load off the upstream, including PostgreSQL and MongoDB.
- The mechanism must be testable in CI without flaky assertions —
  the load-test step has to confirm the limiter works without
  becoming the source of false negatives on a slow runner.

## Considered Options

- **Option A** — Native Nginx rate limiting (`limit_req_zone`,
  `limit_conn_zone`).
- **Option B** — Application-level rate limiting inside the Hono app.
- **Option C** — A third-party Nginx module or a sidecar (e.g.
  HAProxy in front, ModSecurity, Cloudflare).
- **Option D** — No rate limiting; rely entirely on the OPNsense
  L3/L4 controls coming in Phase 7.

## Decision Outcome

Chosen option: "**Option A — Native Nginx rate limiting**". Three
request-rate zones (`reads`, `writes`, `docs`) and one connection
zone, all keyed on `$binary_remote_addr`, applied per route family
in the HTTPS server block. Health endpoints are deliberately
exempt. Rejected requests return `429 Too Many Requests` (per
RFC 6585) and are logged at `warn` level.

The full policy table, justification of each numeric value, threat
model and load-test evidence live in
[`infra/nginx/RATE_LIMITS.md`](../../infra/nginx/RATE_LIMITS.md).

### Positive Consequences

- Zero new dependencies. The feature is part of the Nginx Open Source
  build that is already in the stack.
- The configuration sits next to the rest of the proxy logic, where
  a reviewer can see what limits exist and why with no jumping
  between files.
- The rejection happens before the upstream is contacted, so the
  protection is real: PostgreSQL and MongoDB do not see rejected
  traffic.
- The 10 MB shared-memory zones hold around 160 000 unique IPs
  concurrently, well above any realistic load for this project.
- The behaviour is deterministic and easy to assert in CI: a
  `wrk` burst run shows a stable rejection ratio that the e2e job
  can check without flakiness.

### Negative Consequences

- The default Nginx behaviour is keying on the IP, which means a
  large NAT or a corporate proxy could see all of its users sharing
  one limit budget. Acceptable for a TFC; in a real production
  setting this would warrant a per-API-key dimension on the writes
  zone.
- The reject status code defaults to 503 in Nginx; the project has
  to override it explicitly to 429. Easy to forget when copying
  configuration around. Mitigated by keeping the override at the
  `http` level so every zone benefits.
- Rate limiting is not visible to the application. Audit logs of
  rejected attempts live only in the Nginx error log; the Phase 9
  monitor will need to read both layers if it wants a full picture.

## Pros and Cons of the Options

### Option A — Native Nginx rate limiting

- Good, because no new components and no new images.
- Good, because the configuration is small (a handful of directives)
  and the documentation is excellent.
- Good, because rejections happen before the upstream, so the cost
  per rejected request is microseconds.
- Bad, because the IP-only key has limitations under NAT (see
  above).

### Option B — Application-level rate limiting

- Good, because the application already knows the API key, so it
  could rate-limit per key for writes — a finer dimension than IP.
- Bad, because every rejected request would still go through TLS
  termination, the proxy and the application's request pipeline
  before being denied. The point is to keep load off the upstream;
  this option does the opposite.
- Bad, because it adds rate-limiting state to the application
  process, which complicates horizontal scaling later.

### Option C — Third-party module or sidecar

- Good, because more sophisticated tools (a WAF, a dedicated proxy)
  offer richer features: per-route signatures, anomaly detection,
  bot scoring.
- Bad, because the project does not need that level of
  sophistication, and adding a separate component increases the
  surface area of what has to be explained at the defence.
- Bad, because most full-featured options (ModSecurity,
  Cloudflare) either require a public domain (which the project
  does not have) or a noticeably bigger image.

### Option D — Rely on OPNsense alone

- Good, because the project already plans to introduce L3/L4
  controls in Phase 7.
- Bad, because L3/L4 limits operate on packets and connections,
  not on application semantics. They cannot tell a write attempt
  from a read attempt and so cannot apply different policies to
  each.
- Bad, because the laptop development environment never sees
  OPNsense. Phase 7 is a deployment story; the application needs
  protection on the laptop too.
- Acknowledged: the L3/L4 controls and the L7 limits are
  complementary, not exclusive. Both will be in place after
  Phase 7.

## Links

- `infra/nginx/nginx.conf` — zones and directives.
- `infra/nginx/RATE_LIMITS.md` — policies, justification and
  load-test evidence.
- `.github/workflows/ci.yml` — e2e job's burst-test step.
- ADR-0005 (Nginx as the reverse proxy).
- ADR-0006 (Internal CA for TLS).
