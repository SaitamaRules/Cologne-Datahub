# OPNsense rules — Phase 7 lab topology

This document is the authoritative reference for the firewall stance
of the Phase 7 lab. The rules themselves live in OPNsense's running
configuration (they cannot be checked into the repo as text without
adding tooling); this file describes them in a form a reviewer or a
future operator can audit against the GUI in minutes.

## Topology recap

```
                           ┌──────────────┐
                           │   Windows    │
                           │  10.10.10.2  │  ← admin host (consciente,
                           │              │    not a production model)
                           └──────┬───────┘
                                  │ LAN
            ┌─────────────────────┴────────────────────────────┐
            │   OPNsense                                       │
            │   WAN  (vmnet8 NAT)   192.168.67.x/24 (dynamic)  │
            │   DMZ  (vmnet10)      192.168.113.1/24           │
            │   LAN  (vmnet11)      10.10.10.1/24              │
            └─────┬───────────────────────────────┬────────────┘
                  │                               │
        ┌─────────┴────────┐           ┌──────────┴──────────┐
        │   DMZ            │           │   LAN               │
        │ vm-web           │           │ vm-app  10.10.10.20 │
        │ 192.168.113.30   │           │ vm-db   10.10.10.10 │
        │ - BIND9 (53)     │           │ - API   (8000)      │
        │ - Nginx (80,443) │           │ - PG    (5432)      │
        └──────────────────┘           │ - Mongo (27017)     │
                                       └─────────────────────┘
```

## Flow matrix

Read as "source ⇒ destination on protocol/port: action". Direction is
the perspective of the OPNsense interface the traffic enters through.

### WAN → anywhere

| Source     | Destination              | Action     | Notes                       |
|------------|--------------------------|------------|-----------------------------|
| any        | 192.168.113.30:443/tcp   | **allow**  | via NAT port forward        |
| any        | any (anything else)      | **deny**   | OPNsense default            |

### DMZ → anywhere

| Source             | Destination              | Action    | Notes                          |
|--------------------|--------------------------|-----------|--------------------------------|
| DMZ net (113.0/24) | 10.10.10.20:8000/tcp     | **allow** | Nginx → API                    |
| DMZ net            | 192.168.113.1:53 udp/tcp | **allow** | BIND9 → Unbound forwarder      |
| DMZ net            | WAN net :80,443 tcp      | **allow** | apt + Docker pulls             |
| DMZ net            | any (anything else)      | **deny**  | explicit default-deny          |

DMZ is the zone exposed via WAN DNAT; everything not strictly needed
for the proxy and DNS is denied.

### LAN → anywhere

| Source             | Destination              | Action     | Notes                                     |
|--------------------|--------------------------|------------|-------------------------------------------|
| LAN net (10.10.10.0/24) | any                 | **allow**  | retained default; see rationale below     |

LAN is treated as the **trusted internal zone**. It contains the admin
host (Windows on `10.10.10.2`) and the two application VMs (`vm-app`,
`vm-db`). The Zero-Trust posture lives at the perimeter (DMZ rules) and
inside each host (UFW). LAN-to-LAN traffic (vm-app ↔ vm-db) never
reaches the firewall — it goes through the vmnet switch directly.

This is a deliberate trade-off: a fully strict LAN posture would
require enumerating every admin path (SSH, GUI, DNS, apt) explicitly,
which doubles the rule count for no realistic threat reduction in a
single-admin lab. The blue-team value is concentrated in DMZ rules and
UFW.

## NAT

### Port forward (the only one in the lab)

| Interface | Proto | Source | Destination port | Redirect target            |
|-----------|-------|--------|------------------|----------------------------|
| WAN       | TCP   | any    | 443              | 192.168.113.30 : 443       |

Auto-generated companion filter rule on WAN allows the matched
traffic; nothing else on WAN is open inbound.

### Outbound NAT

Automatic outbound NAT rule generation (OPNsense default). DMZ and
LAN egress through the WAN interface with the WAN IP as source.

## Per-host firewall (UFW) summary

Defence in depth: even if an OPNsense rule were too permissive, the
host firewall on each VM denies anything not explicitly listed.

| Host    | Inbound allowed                                              |
|---------|--------------------------------------------------------------|
| vm-web  | 22/tcp from LAN; 53/tcp+udp from DMZ and LAN; 80,443/tcp any |
| vm-app  | 22/tcp from LAN; 8000/tcp from 192.168.113.30 only           |
| vm-db   | 22/tcp from LAN; 5432,27017/tcp from 10.10.10.20 only        |

## Admin path documented

The Windows host sits in LAN with IP `10.10.10.2`. It is not a
production model — in a real deployment the admin host would live on
a dedicated management network. The current setup is documented as a
conscious shortcut: the static route on Windows (`192.168.113.0/24
via 10.10.10.1`, added persistently in Block A) routes admin traffic
through OPNsense, but the host itself is in LAN, so it is governed by
the same allow-all LAN rule as the application VMs.

## Verification (deferred to Block D)

Block D runs `nmap` from three vantage points and pastes the output
into `infra/opnsense/NMAP.md`:

- From Windows host → WAN IP of OPNsense — only 443 reachable.
- From vm-web (DMZ) → vm-app and vm-db (LAN) — only 8000 on vm-app
  reachable; nothing else.
- From vm-app (LAN) → vm-web (DMZ) — only 53 reachable; nothing else.

Anything outside the matrix above must show as filtered/closed; any
deviation is a finding to fix before merging the phase.

## Where to find the rules in OPNsense

- **Firewall → NAT → Port Forward**: the WAN:443 → DMZ:443 entry.
- **Firewall → Rules → WAN**: the auto-generated filter rule.
- **Firewall → Rules → DMZ**: four explicit allows + implicit deny.
- **Firewall → Rules → LAN**: the default "allow LAN to any".
- **Firewall → NAT → Outbound**: mode "automatic".

Changes to any of those must be reflected here in the same commit.
