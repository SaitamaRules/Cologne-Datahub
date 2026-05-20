# vm-db — LAN host (PostgreSQL + MongoDB)

Deployment artefacts for the data-tier host of the Phase 7 lab
topology. Populated in sub-phase C.7 (docker-compose.yml).

This host runs PostgreSQL 16 and MongoDB 7 side by side, exposing
different ports on the same host IP. It is only reachable from `vm-app`
via explicit OPNsense firewall rules.

**Network:** LAN `10.10.10.0/24`. **Host IP:** `10.10.10.10`.

For the single-host development equivalent, see `../dev-local/`.
