# vm-web — DMZ host (Nginx + BIND9)

Deployment artefacts for the DMZ-side host of the Phase 7 lab topology.
Populated across sub-phases C.2 (bind9), C.3 (certs), C.4 (nginx) and
C.5 (docker-compose.yml).

This host runs:

- Internal authoritative DNS (BIND9) for the `cologne.local` zone,
  serving both DMZ (`192.168.113.0/24`) and LAN (`10.10.10.0/24`).
- TLS-terminating reverse proxy (Nginx) for the public surface.

**Network:** DMZ `192.168.113.0/24`. **Host IP:** `192.168.113.30`.

For the single-host development equivalent, see `../dev-local/`.
