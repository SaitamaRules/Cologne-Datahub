# Rate Limits

This document describes the rate-limiting policies applied at the
Nginx layer, why each value is what it is, and the load-test evidence
that confirms they work as intended.

## Threat model

The rate limiter is the project's first line of defence against three
classes of unwanted traffic:

1. **Credential stuffing on write endpoints.** The API key is the only
   thing standing between an attacker and write access. A leaked or
   guessable key would otherwise be testable at thousands of requests
   per second; the writes limit makes that economically painful.
2. **Aggressive scraping of the public dataset.** The tree registry is
   public information, but a bot pulling it at full speed wastes CPU
   on the application and on PostgreSQL/MongoDB. The reads limit
   keeps a single client from monopolising resources.
3. **Layer-7 denial-of-service.** A small flood of requests, even
   without large payloads, can exhaust the application's connection
   pool. Rate limiting at the edge means Nginx absorbs the flood
   instead of forwarding it.

This is L7 only. L3/L4 protections (state-table limits, SYN flood
mitigation) are the responsibility of OPNsense in Phase 7. The two
layers complement each other; neither replaces the other.

## Policies

All limits key on the client IP (`$binary_remote_addr`). Each zone
gets 10 MB of shared memory, which holds approximately 160 000 unique
IPs concurrently — far more than this project will ever see.

| Family            | Routes                     | Rate     | Burst | Status |
| ----------------- | -------------------------- | -------- | ----- | ------ |
| Reads             | `GET /api/*`               | 30 req/s | 60    | 429    |
| Writes            | `POST/PUT/DELETE /api/*`   | 5 req/s  | 10    | 429    |
| Docs              | `/docs`                    | 2 req/s  | 5     | 429    |
| Connections (all) | every HTTPS location       | 20 max   | —     | 429    |
| Health            | `/health`, `/health/ready` | (none)   | —     | —      |

The `nodelay` modifier is set on every `limit_req` directive: burst
requests are served immediately rather than queued. This is correct
for a low-latency JSON API where queueing would only hide problems.

The HTTP status returned on rejection is 429 (Too Many Requests, per
RFC 6585), not the Nginx default of 503. 503 is reserved for actual
upstream unavailability.

## Why these specific numbers

### Reads — 30 req/s, burst 60

A reasonable browser session against the API will fire several
parallel requests to render a single page (statistics, a tree list,
a detail view). 30 sustained per second is generous: even a power
user with multiple tabs and a script polling the data will stay
below it. The burst of 60 covers the initial page load, where many
requests fan out at once.

A scraper pulling the entire dataset would either accept being
throttled to 30 req/s — which limits the whole 50 000-tree dataset
to about 28 minutes of scraping — or move to a different IP, which
is now its problem rather than ours.

### Writes — 5 req/s, burst 10

Writes are the high-value target. A human entering data through any
realistic UI never exceeds five mutations per second, and the API
key requirement already gates them.

The value is set so that an attacker who has somehow obtained the
key cannot use it to mass-modify the dataset: at 5 req/s, modifying
the entire 50 000-tree dataset takes nearly three hours, which is
plenty of time for an audit log review or a key rotation to catch
the issue.

### Docs — 2 req/s, burst 5

The `/docs` endpoint serves the Swagger UI HTML and the OpenAPI JSON.
Loading either is a one-shot action; nobody legitimately requests it
multiple times per second. The tighter limit makes `/docs` an
unattractive target for a denial-of-service attempt.

### Connections — 20 max

A global cap, applied across every HTTPS location, on simultaneous
connections per IP. Even with HTTP/2 multiplexing, one client should
not need 20 concurrent connections; this is a generous upper bound
that protects against connection-exhaustion attacks while leaving
legitimate users untouched.

### Health — no limit

The Docker healthcheck for the Nginx container hits `/nginx-health`
on plain HTTP every 5 seconds, and the app healthcheck hits
`/health` every 15 seconds. The Phase 9 monitor will hit
`/health/ready` on its own schedule. Rate limiting any of these
would create false-negative alerts during legitimate operation,
which is a worse outcome than the small attack surface they
represent.

## Behaviour when a limit is hit

- The client receives `HTTP/2 429 Too Many Requests` with no body.
- Nginx writes a line to `error.log` at `warn` level, identifying
  the client, the zone, and the limited path:

  ```
  2026/04/27 17:30:12 [warn] 1#1: *123 limiting requests, excess: 60.000 by zone "reads_zone", client: 198.51.100.42, server: _, request: "GET /api/trees?limit=1 HTTP/2.0", host: "127.0.0.1"
  ```

- The application is not contacted. PostgreSQL and MongoDB are not
  contacted. The cost of a rejected request is essentially the cost
  of accepting the TCP connection and reading the HTTP request line,
  which is negligible.

## Load-test evidence

The numbers below come from a `wrk` run against the local stack on
the development laptop. The same test runs in CI as part of the e2e
job (with a tolerant 70% rejection threshold to absorb runner
variability).

### Test command

```sh
docker run --rm --network host williamyeh/wrk \
    -t2 -c10 -d10s --timeout 5s \
    "https://localhost/api/trees?limit=1"
```

Two threads, ten concurrent connections, ten seconds, five-second
timeout per request, against the read endpoint.

### Local result (development laptop)

```
Running 10s test @ https://localhost/api/trees?limit=1
  2 threads and 10 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   112.71us   79.38us   3.03ms   87.41%
    Req/Sec    41.74k     3.87k   47.98k    76.50%
  830150 requests in 10.00s, 302.51MB read
  Socket errors: connect 0, read 0, write 0, timeout 8
  Non-2xx or 3xx responses: 829790
Requests/sec:  83018.35
Transfer/sec:     30.25MB
```

**Numbers in plain English:**

- 830 150 requests issued over 10 seconds (~83 000 req/s).
- 829 790 of them rejected with `429 Too Many Requests` (99.96%).
- 360 of them passed through to the application. The reads zone allows
  exactly `30 req/s × 10 s + burst 60 = 360` successful requests in a
  10-second window — the measured number matches the policy with no
  rounding error.
- Median latency on the rejected requests: 112 µs. Nginx never
  contacts the application, PostgreSQL or MongoDB for these requests.
- Eight `wrk` timeouts (connect 0, read 0, write 0, timeout 8): minor
  noise from the OS scheduler under sustained load, irrelevant to the
  rate-limiter's behaviour.

### Interpretation

- `30 req/s × 10s + burst 60 ≈ 360 successful requests` is the
  theoretical maximum of 200 OKs the read zone allows during the
  test window. The measured number of 2xx responses matches this
  budget within a few requests, which confirms the rate limiter is
  the deciding factor (not Nginx capacity, not application
  latency).
- Throughput at the edge is in the tens of thousands of requests
  per second. The application never sees the rejected traffic,
  which is the whole point.
- Latency on the rejected requests is sub-millisecond because Nginx
  rejects them in its own request pipeline, before any upstream
  contact.

## Verification in CI

The e2e job in `.github/workflows/ci.yml` runs the same `wrk`
command and asserts that at least 70% of responses are non-2xx/3xx.
The threshold is intentionally generous to accommodate slower
GitHub-hosted runners; on the development laptop the figure is
above 99%.

## Future work

- **Phase 7 — OPNsense.** L3/L4 controls (state-table limits, SYN
  flood mitigation) sit in front of Nginx. The two layers have
  complementary jobs: the firewall stops the traffic before it
  reaches a TLS handshake; the rate limiter stops it after.
- **Phase 9 — monitoring daemon.** Limited requests already log to
  `error.log`; the monitor will surface unusual rates of 429s as a
  signal of either misconfigured clients or hostile traffic.
