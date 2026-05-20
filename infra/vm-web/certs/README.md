# certs — internal CA and server certificate for vm-web

Internal PKI used by Nginx on vm-web to terminate TLS. Logically the
same model as `infra/dev-local/certs/` (an internal CA signs a server
certificate), but with a SAN list tailored to the Phase 7 access paths.

## SAN matrix

| Name                      | Used by                                                     |
|---------------------------|-------------------------------------------------------------|
| `datahub.cologne.local`   | external clients (Windows host) reaching via WAN DNAT       |
| `proxy.cologne.local`     | internal clients (DMZ/LAN) resolving via BIND9              |
| `web.cologne.local`       | direct access to vm-web by its OS hostname                  |
| `localhost`               | in-container healthchecks                                   |
| `127.0.0.1`               | local debugging from inside vm-web                          |

## Reusing the dev-local CA (recommended)

If the dev-local CA already exists and you want clients to keep
trusting the same anchor (no need to re-import the CA into the Windows
trust store), copy it into vm-web's out/ before running the script:

```powershell
New-Item -ItemType Directory -Force -Path "infra/vm-web/certs/out" | Out-Null
Copy-Item infra/dev-local/certs/out/ca.crt infra/vm-web/certs/out/
Copy-Item infra/dev-local/certs/out/ca.key infra/vm-web/certs/out/
```

The generation script detects the CA and reuses it; only the server
certificate is generated.

## Generating (or rotating) the server certificate

From the repository root:

```powershell
docker run --rm `
  -v "${PWD}/infra/vm-web/certs:/work" -w /work `
  --entrypoint sh alpine/openssl generate-certs.sh
```

The script prints the CA SHA-256 fingerprint and the server cert's SAN
list at the end. Verify the SANs match the matrix above before deploying.

## Verifying the generated cert

```powershell
docker run --rm -v "${PWD}/infra/vm-web/certs/out:/work" -w /work `
  alpine/openssl x509 -in server.crt -noout -text | Select-String -Pattern "Subject:|DNS:|Not After"
```

Expected output: subject CN is `proxy.cologne.local`, the four `DNS:`
entries from the matrix, and a validity of about 10 years.

## Trust store on Windows (one-time)

To stop curl/browsers complaining when probing the HTTPS endpoint from
the host, import `ca.crt` once into Windows' Trusted Root CAs:

```powershell
Import-Certificate -FilePath "infra/vm-web/certs/out/ca.crt" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

Requires an elevated PowerShell. The CA is valid 10 years, so this is
a single action across the lifetime of the lab.

## Files

```
certs/
├── openssl.cnf            # CSR + extensions config (SANs, key usage)
├── generate-certs.sh      # idempotent CA + server cert generator
├── README.md              # this file
└── out/                   # gitignored — never commit private keys
    ├── ca.crt
    ├── ca.key             # ! sensitive
    ├── server.crt
    └── server.key         # ! sensitive
```

The `out/` directory is matched by the `infra/**/certs/out/` rule in
`.gitignore`; nothing inside is ever committed.
