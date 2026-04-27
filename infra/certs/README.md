# Certificates

Internal Certificate Authority and server certificate for Cologne
DataHub. The CA is generated on demand and is not committed to the
repository — only the script and configuration that produce it are.

## Layout

- `openssl.cnf` — versioned configuration. Defines the X.509 extensions
  for the CA and the server certificate, plus the Subject Alternative
  Names.
- `generate-certs.sh` — script that creates the CA (if missing) and
  signs a fresh server certificate.
- `out/` — generated material. **Not committed**. Contains the CA
  private key, server private key, and certificates.

## Generating the certificates

From the repository root, using the official `alpine/openssl` image
(no local OpenSSL install required):

```bash
docker run --rm -v "$PWD/infra/certs:/work" -w /work \
    --entrypoint sh alpine/openssl generate-certs.sh
```

On Windows PowerShell:

```powershell
docker run --rm -v "${PWD}/infra/certs:/work" -w /work `
    --entrypoint sh alpine/openssl generate-certs.sh
```

The script produces:

- `out/ca.key` + `out/ca.crt` — the root CA. Reused on subsequent runs
  unless deleted manually. Valid for 10 years.
- `out/server.key` + `out/server.crt` — the server certificate. Always
  regenerated. Valid for 10 years.
- `out/server.csr` — the certificate signing request, kept for
  reference.

## Subject Alternative Names

The server certificate is valid for:

- `cologne-datahub.local` — canonical hostname, resolved internally by
  BIND9 once Phase 6 is in place.
- `localhost` — local development on the host.
- `127.0.0.1` — same, by IP.

This means the same certificate works for every reasonable way to reach
the service during development and inside the deployment, with no need
to edit `/etc/hosts` or equivalent on user machines.

## Trusting the CA

Browsers and `curl` will reject the certificate by default because the
CA is unknown to the system trust store. Two options:

### Option 1 — Trust the CA system-wide

This makes browsers accept the certificate without warnings. Useful for
demonstrations.

- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo cp out/ca.crt /usr/local/share/ca-certificates/cologne-datahub.crt
  sudo update-ca-certificates
  ```
- **Windows**: double-click `out/ca.crt` → _Install Certificate_ →
  _Local Machine_ → _Place all certificates in the following store_ →
  _Trusted Root Certification Authorities_.
- **macOS**:
  ```bash
  sudo security add-trusted-cert -d -r trustRoot \
      -k /Library/Keychains/System.keychain out/ca.crt
  ```

### Option 2 — Pass the CA explicitly to `curl`

For one-off testing without modifying the system:

```bash
curl --cacert infra/certs/out/ca.crt https://localhost/health
```

## Rotation

The server certificate is regenerated on every script run. To rotate
the CA itself (rare — only needed if the private key is compromised):

```bash
rm infra/certs/out/ca.key infra/certs/out/ca.crt
docker run --rm -v "$PWD/infra/certs:/work" -w /work \
    alpine/openssl sh generate-certs.sh
```

After rotation, every system that trusted the previous CA must trust
the new one.

## Why an internal CA?

This is documented in detail in [ADR-0006](../../docs-tfc/adr/0006-internal-ca-tls.md).
The short version: Let's Encrypt requires a publicly resolvable domain
that this project does not have, and self-signed certificates would
not let me practice the real-world skill of running a small CA.
