# dev-local — single-host development stack

This directory contains the original monolithic Docker Compose stack that
runs the entire Cologne DataHub on a single Docker host. It is preserved
**unchanged in behaviour** as a development convenience and is the stack
exercised by the e2e job in CI.

## When to use this

- Local development on the maintainer's laptop (`make up`, `make seed`).
- CI integration tests that need the full stack on a single Linux runner.
- Quick reproduction of issues without bringing up the multi-VM lab.

## When **not** to use this

- The production-like lab deployment described in Phase 7. That topology
  splits the stack across three Ubuntu Server VMs behind an OPNsense
  firewall, with each VM holding its own Compose file under
  `infra/vm-web/`, `infra/vm-app/`, `infra/vm-db/`. Do not mix the two
  modes on the same host.

## How to run

From the repository root:

```bash
make up      # start the full stack (postgres, mongo, bind9, app, nginx)
make seed    # one-shot data load from app/data/baumkataster.json
make logs    # tail logs
make down    # stop, preserve volumes
make clean   # stop, REMOVE volumes (destructive)
```

The stack exposes the Nginx reverse proxy on `127.0.0.1:80` and
`127.0.0.1:443`. The internal Docker network `172.28.0.0/24` is fixed so
that the BIND9 zone file can pin service addresses; this scheme is
intentional and local to single-host mode. It does **not** apply to the
multi-VM topology, where each service sits on a different physical
network.

## Layout

```
dev-local/
├── docker-compose.yml          # the stack
├── bind9/                      # BIND9 zone files for 172.28.0.0/24
├── nginx/                      # TLS-terminating reverse proxy config
└── certs/                      # internal CA + server cert (out/ gitignored)
```

## History

This stack served as the baseline for Phases 0–6. Phase 7 introduces a
realistic network segmentation (DMZ + LAN behind a firewall) and moves
the production deployment artefacts to `infra/vm-*/`. The single-host
mode is retained because it is a faithful development environment and
makes the CI feedback loop substantially cheaper than spinning up the
lab topology on every push.
