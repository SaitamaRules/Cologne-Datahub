# vm-app — LAN host (Deno API)

Deployment artefacts for the application-tier host of the Phase 7 lab
topology. Populated in sub-phase C.6 (docker-compose.yml).

This host runs the Deno+Hono API container only. It depends on `vm-db`
for both PostgreSQL and MongoDB, and on `vm-web` for DNS resolution.

**Network:** LAN `10.10.10.0/24`. **Host IP:** `10.10.10.20`.

For the single-host development equivalent, see `../dev-local/`.
