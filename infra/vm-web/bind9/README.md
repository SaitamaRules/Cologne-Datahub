# BIND9 — internal DNS for the Phase 7 lab

Authoritative resolver for `cologne.local` and recursive forwarder for
everything else. Runs as a container on `vm-web` (DMZ).

## Role

- **Authoritative** for the `cologne.local` zone (forward + two reverse
  zones, one per lab segment).
- **Recursive resolver** for clients in `192.168.113.0/24` (DMZ) and
  `10.10.10.0/24` (LAN), forwarding everything outside `cologne.local`
  to OPNsense's Unbound at `192.168.113.1`.

External recursion is `forward only`: BIND9 never reaches the public
internet directly. OPNsense is the single egress point for DNS, which
keeps firewall rules simple and gives Phase 9 a single place to monitor
DNS traffic.

## Service map

| FQDN                       | A record       | Role                         |
|----------------------------|----------------|------------------------------|
| ns.cologne.local           | 192.168.113.30 | this BIND9 server            |
| proxy.cologne.local        | 192.168.113.30 | Nginx reverse proxy          |
| web.cologne.local          | 192.168.113.30 | vm-web hostname (canonical)  |
| api.cologne.local          | 10.10.10.20    | Deno API                     |
| app.cologne.local          | 10.10.10.20    | vm-app hostname (canonical)  |
| db-pg.cologne.local        | 10.10.10.10    | PostgreSQL (port 5432)       |
| db-mongo.cologne.local     | 10.10.10.10    | MongoDB (port 27017)         |
| db.cologne.local           | 10.10.10.10    | vm-db hostname (canonical)   |

PTR records point to the canonical VM hostname (`web`/`app`/`db`), not
to service roles.

## When editing zones

Bump the serial in **every** zone file you touch. Format:
`YYYYMMDDNN` where `NN` is the day's revision counter starting at `01`.
Slaves don't exist in this lab, but the serial discipline keeps the
zones healthy and makes intent explicit in commit history.

## Validation (without arrancar el daemon)

From the repository root, on any host with Docker:

```bash
docker run --rm \
  -v "$PWD/infra/vm-web/bind9/named.conf:/etc/bind/named.conf:ro" \
  -v "$PWD/infra/vm-web/bind9/zones:/etc/bind/zones:ro" \
  ubuntu/bind9:latest \
  named-checkconf /etc/bind/named.conf

docker run --rm \
  -v "$PWD/infra/vm-web/bind9/zones:/etc/bind/zones:ro" \
  ubuntu/bind9:latest \
  named-checkzone cologne.local /etc/bind/zones/db.cologne.local

docker run --rm \
  -v "$PWD/infra/vm-web/bind9/zones:/etc/bind/zones:ro" \
  ubuntu/bind9:latest \
  named-checkzone 113.168.192.in-addr.arpa /etc/bind/zones/db.192.168.113

docker run --rm \
  -v "$PWD/infra/vm-web/bind9/zones:/etc/bind/zones:ro" \
  ubuntu/bind9:latest \
  named-checkzone 10.10.10.in-addr.arpa /etc/bind/zones/db.10.10.10
```

All four commands must exit `0` with `OK` in their output before
committing changes.

## Runtime smoke test (once the container is up in sub-phase C.5)

From inside vm-web or any client in DMZ/LAN:

```bash
dig @192.168.113.30 api.cologne.local +short          # 10.10.10.20
dig @192.168.113.30 db-pg.cologne.local +short        # 10.10.10.10
dig @192.168.113.30 -x 10.10.10.20 +short             # app.cologne.local.
dig @192.168.113.30 cloudflare.com +short             # forwarded via OPNsense
dig @192.168.113.30 version.bind chaos txt +short     # empty (version hidden)
```

## Hardening notes

- `version none` hides the BIND9 build version from probes.
- `minimal-responses yes` reduces the surface of every reply.
- `allow-transfer { none; }` blocks zone transfer requests.
- `allow-recursion { trusted; }` prevents this server from being abused
  as an open resolver if a misconfiguration ever exposed it.
