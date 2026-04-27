# 0006. Internal Certificate Authority for TLS

- Status: accepted
- Date: 2026-04-27
- Deciders: Francisco
- Tags: security, tls, infrastructure

## Context and Problem Statement

Phase 4 introduces TLS termination at the Nginx layer. The application
will be accessed over HTTPS, and the certificate has to be issued by
something. The project is internal: it runs on a developer laptop now
and will run inside a private network behind OPNsense in Phase 7,
without a publicly resolvable domain. That rules out automatic
certificate authorities like Let's Encrypt out of the box. This ADR
records how certificates are issued for the project and why.

## Decision Drivers

- The hostname (`cologne-datahub.local`) is not publicly resolvable
  and never will be in this project. There is no AAAA/A record on the
  public Internet pointing at it.
- The project must work the same way on a laptop, in a virtual machine,
  and in CI, with no external dependencies for certificate issuance.
- The TFC includes an explicit objective of practising real
  infrastructure skills. Running a small CA is one of those skills;
  hand-waving it with self-signed certificates would skip the lesson.
- Renewals should not depend on me remembering to do them during the
  TFC. The defence is in June 2026 and the project must keep working.
- The certificate validation chain has to be testable in CI without
  exposing private keys.

## Considered Options

- **Option A** — Run a small internal CA, issue the server certificate
  from it.
- **Option B** — Use a single self-signed server certificate, no CA.
- **Option C** — Use Let's Encrypt with a real public domain.
- **Option D** — Use mkcert (a developer tool that installs a local CA
  and issues certificates for development hostnames).

## Decision Outcome

Chosen option: "**Option A — Internal CA**". A root CA is generated
once and used to sign a server certificate for the project. Both live
in `infra/certs/out/` (gitignored), produced by a versioned shell
script that runs inside an `alpine/openssl` container.

The CA is valid for ten years, the server certificate too. Both
durations are intentionally long: this is a TFC, not a production
service, and certificate rotation is a topic for the runbook in
Phase 10 rather than something I want to hit during the defence.

### Positive Consequences

- The project is fully self-contained. Anyone with Docker can clone
  the repo, run one script, and have a working TLS deployment.
- Running a CA, even a tiny one, exercises the X.509 concepts that
  the curriculum touches on (key usage, extended key usage, subject
  alternative names, the difference between a CSR and a signed cert)
  in a way that is observable and explainable in the oral defence.
- The same generation script runs in CI to produce ephemeral
  certificates per workflow run. No private keys cross the trust
  boundary of the runner.
- Future rotation, revocation, or chain extension is a matter of
  editing the script — not learning a new tool.

### Negative Consequences

- Browsers and HTTP clients will reject the certificate by default
  because the CA is not in any trust store. Users either have to
  trust the CA (one-off install) or pass `--cacert` explicitly.
- Maintaining the CA is on me. Forgetting where the CA private key
  lives, or losing it, would force every dependent system to trust
  a new CA.

## Pros and Cons of the Options

### Option A — Internal CA

- Good, because it teaches and demonstrates the real shape of TLS
  certificate issuance.
- Good, because it has no dependencies outside `openssl` and a shell.
- Good, because it scales to multiple certificates if Phase 7 needs
  to issue per-service certs (e.g. for the Python monitor).
- Bad, because clients need to trust the CA explicitly.

### Option B — Single self-signed certificate

- Good, because there is one less moving part: no separate CA, no
  signing step.
- Bad, because every client must trust that specific certificate,
  not a CA. Rotating the server cert means re-trusting on every
  client, which scales poorly the moment more than one machine is
  involved.
- Bad, because it does not match how TLS works in the real world.
  The TFC is explicitly about real infrastructure skills.

### Option C — Let's Encrypt with a real domain

- Good, because no client trust setup is needed: every browser and
  every operating system already trusts Let's Encrypt.
- Good, because renewals are automatic.
- Bad, because it requires a real public domain pointing at the
  deployment, which the project does not have and does not intend
  to acquire. The deployment runs inside a private network behind
  OPNsense; even if a domain were registered, the ACME challenge
  would need to reach the server from the public internet.
- Bad, because using Let's Encrypt in development pollutes the
  rate limits of the production endpoints. The staging endpoints
  are an option, but they too require a public domain.
- Acknowledged: this is the right answer for a real production
  deployment. The runbook in Phase 10 will document how the
  internal-CA setup would map to a Let's Encrypt configuration if
  the project ever moved to a public domain.

### Option D — mkcert

- Good, because it gives a working local CA in two commands.
- Good, because it integrates with the system trust store
  automatically.
- Bad, because it hides the moving parts. The whole point of doing
  this for a TFC is to have the certificate generation visible in
  the repository, where it can be inspected and explained.
- Bad, because it adds a system-level installation step that other
  collaborators (e.g. the ZfL students) would also need.

## Links

- `infra/certs/openssl.cnf` — versioned OpenSSL configuration.
- `infra/certs/generate-certs.sh` — generation script.
- `infra/certs/README.md` — usage instructions, trust setup,
  rotation procedure.
- `infra/nginx/nginx.conf` — TLS configuration in the proxy.
- `.github/workflows/ci.yml` — `e2e` job that generates ephemeral
  certificates and probes the proxy over HTTPS.
- ADR-0005 (Nginx as the reverse proxy).
