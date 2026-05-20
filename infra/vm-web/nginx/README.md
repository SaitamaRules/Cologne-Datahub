# Nginx — TLS reverse proxy on vm-web

Phase 7 deployment of the same Nginx reverse proxy used in dev-local,
adapted to the per-VM topology. Behaviour, rate-limiting policy and TLS
configuration are identical; what changes is the deployment context.

## Role

Termination point for all external traffic. Listens on `:80` (redirect
to HTTPS, except `/nginx-health`) and `:443` (TLS, rate limiting,
reverse proxy). Forwards `/api/`, `/health`, `/docs` to the API
upstream at `api.cologne.local:8000` (vm-app on LAN).

## Dependencies

- **BIND9** on vm-web (sub-phase C.2) — resolves `api.cologne.local`
  to `10.10.10.20` so the upstream block works.
- **Certificates** in `../certs/out/` (sub-phase C.3) — mounted
  read-only into the container at `/etc/nginx/certs/`.
- **OPNsense** routing — allows DMZ → LAN port 8000 from vm-web's IP
  to vm-app's IP. Configured in sub-phase C.9.

The Compose file in sub-phase C.5 wires everything together.

## What differs from dev-local

| Aspect              | dev-local                       | vm-web                         |
|---------------------|---------------------------------|--------------------------------|
| upstream IP behind  | `172.28.0.20` (Docker network)  | `10.10.10.20` (LAN, via OPNsense) |
| DNS resolver        | BIND9 in same Docker network    | BIND9 in same VM (localhost)  |
| Cert SAN            | `cologne-datahub.local`         | `datahub.cologne.local` + 3 more |
| Network path        | internal Docker bridge          | physical DMZ → firewall → LAN |

Nothing in this configuration file reflects those differences — the
upstream is resolved by FQDN and DNS does the rest. That is the whole
point.

## Rate-limiting policies

Identical to dev-local. The full threat model and load-test evidence
live in `infra/dev-local/nginx/RATE_LIMITS.md` and apply unchanged to
this deployment.

## Validation (without arrancar el container)

From the repository root, with the certs already generated:

```powershell
docker run --rm `
  -v "${PWD}/infra/vm-web/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" `
  -v "${PWD}/infra/vm-web/nginx/snippets:/etc/nginx/snippets:ro" `
  -v "${PWD}/infra/vm-web/certs/out:/etc/nginx/certs:ro" `
  nginx:alpine `
  nginx -t
```

Expected: `nginx: the configuration file /etc/nginx/nginx.conf syntax is ok`
and `nginx: configuration file /etc/nginx/nginx.conf test is successful`.

The test will fail if certs are missing, if a syntax error slipped in,
or if a snippet path is broken. It cannot validate runtime DNS
resolution — that needs the live stack (sub-phase C.5).

## Files

```
nginx/
├── nginx.conf                 # top-level configuration
├── snippets/proxy.conf        # shared proxy_* directives
└── README.md                  # this file
```
