# BIND9

Internal authoritative DNS server for the project. Resolves the
`cologne.local` zone for inter-service communication. Used by every
service in the compose stack as their primary resolver; the host's
resolver remains responsible for everything else.

## Layout

- `named.conf` — top-level configuration. Authoritative-only, no
  recursion, restricted query ACLs.
- `zones/db.cologne.local` — forward zone, A records for every
  service.
- `zones/db.172.28` — reverse zone for the compose network's `/24`,
  PTR records mirroring the forward zone.

## Service map

| FQDN                       | IP            | Service     |
| -------------------------- | ------------- | ----------- |
| `ns.cologne.local`         | `172.28.0.5`  | bind9       |
| `db-pg.cologne.local`      | `172.28.0.10` | postgres    |
| `db-mongo.cologne.local`   | `172.28.0.11` | mongo       |
| `api.cologne.local`        | `172.28.0.20` | app         |
| `proxy.cologne.local`      | `172.28.0.30` | nginx       |

These IPs are pinned in `docker-compose.yml` under each service's
`networks.default.ipv4_address` field. The compose network itself is
declared with a fixed subnet (`172.28.0.0/24`) so the addresses do not
rotate between recreations.

## Why pinned IPs

Docker's embedded DNS provides service-name resolution out of the box
(`postgres`, `mongo`, etc), but those names are not FQDNs and the
TFC's progression toward Phase 7 (real network segments behind
OPNsense) requires a real DNS layer. Hardcoding IPs in the zone file
is the cleanest way to expose FQDNs that look and behave like the
ones the LAN/DMZ deployment will use.

When Phase 7 lands, the only change to this directory is the IP on
the right of each A record (and the corresponding PTR). The service
names, the zone configuration and the resolver setup stay the same.

## Smoke testing from inside the network

```bash
# From the bind9 container itself:
docker compose -f infra/docker-compose.yml --env-file .env exec bind9 \
    sh -c "dig +short api.cologne.local @127.0.0.1"

# From any other service (uses BIND9 as configured by compose):
docker compose -f infra/docker-compose.yml --env-file .env exec app \
    sh -c "getent hosts api.cologne.local"
```

## Forward + reverse consistency

The two zone files must agree: every A record has a matching PTR
record. There is no automation enforcing this; reviewers should
sanity-check both when touching service IPs.
