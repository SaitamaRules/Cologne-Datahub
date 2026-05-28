# vm-web — DMZ host (Nginx + BIND9)

Deployment artefacts for the DMZ-side host of the Phase 7 lab.

## Role

- **BIND9**: authoritative for `cologne.local`, recursive forwarder to
  OPNsense's Unbound. Serves DMZ and LAN.
- **Nginx**: TLS termination, L7 rate limiting, reverse proxy to the
  API on `vm-app` (LAN).

**Network:** DMZ `192.168.113.0/24`. **Host IP:** `192.168.113.30`.

## Layout

```
vm-web/
├── docker-compose.yml         # the stack (bind9 + nginx)
├── bind9/                     # zones and named.conf (C.2)
├── certs/                     # CA + server cert generator (C.3)
├── nginx/                     # TLS proxy config (C.4)
└── README.md                  # this file
```

## Pre-deployment checklist

Before the first `docker compose up`:

1. Certificates exist in `certs/out/` — run the generator if not:
   ```bash
   docker run --rm -v "$PWD/infra/vm-web/certs:/work" -w /work \
     --entrypoint sh alpine/openssl generate-certs.sh
   ```
   (See `certs/README.md` to reuse the dev-local CA.)

2. Host firewall (UFW on vm-web) allows the right inbound ports.
   Configured in sub-phase C.8.

3. OPNsense rules allow:
   - WAN:443 → DMZ:443 (DNAT to 192.168.113.30:443)
   - DMZ → LAN:8000 from this host's IP to vm-app's IP
   - DMZ ↔ LAN:53 (so LAN clients can resolve via this BIND9)
   - DMZ → WAN:53 (so BIND9 can forward to OPNsense Unbound)

   Configured in sub-phase C.9.

## Deployment

From inside vm-web, after pulling the repo:

```bash
cd ~/Cologne-Datahub
docker compose -f infra/vm-web/docker-compose.yml up -d
docker compose -f infra/vm-web/docker-compose.yml ps
```

Both services should report `healthy` within ~30 seconds.

## Validation from the host (Windows or vm-web itself)

```bash
# Internal DNS resolves through BIND9 (on vm-web port 53)
dig @192.168.113.30 api.cologne.local +short      # 10.10.10.20
dig @192.168.113.30 db-pg.cologne.local +short    # 10.10.10.10

# Reverse resolution works
dig @192.168.113.30 -x 192.168.113.30 +short      # web.cologne.local.

# External names are forwarded via OPNsense Unbound
dig @192.168.113.30 cloudflare.com +short

# Version is hidden (blue-team hardening)
dig @192.168.113.30 version.bind chaos txt +short  # empty

# HTTPS responds (CA must be trusted by the client for clean OK)
curl --cacert infra/vm-web/certs/out/ca.crt https://192.168.113.30/nginx-health
```

The API endpoints (`/health`, `/api/...`) only work after `vm-app` is
also up (sub-phase C.6), since Nginx proxies to it.

## Local syntax validation (without arrancar el stack)

From Windows on the dev machine:

```powershell
docker compose -f infra/vm-web/docker-compose.yml config | Out-Null
```

If the command exits without error, the compose file parses cleanly.
It does **not** validate runtime DNS or certs — that needs the live
host.
