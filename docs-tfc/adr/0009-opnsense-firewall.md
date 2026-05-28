# 0009. Perimeter firewall with OPNsense

- Status: accepted
- Date: 2026-05-28
- Deciders: Francisco
- Tags: networking, firewall, security, infrastructure

## Context and Problem Statement

Through Phase 6 the whole system lived in a single Docker network on
one host. Phase 7 splits it across three Ubuntu Server VMs and puts a
real firewall in front: a DMZ (`192.168.113.0/24`) holding the Nginx
proxy and the BIND9 resolver, and a LAN (`10.10.10.0/24`) holding the
application and both databases. Something has to route between the
segments, terminate the WAN edge, and enforce which flows are allowed.

The TFC needs a perimeter device that:

1. Provides three interfaces (WAN, DMZ, LAN) with stateful filtering
   and NAT/DNAT, so the only externally reachable surface is the
   proxy on 443.
2. Adds L3/L4 controls (state-table limits, SYN-flood protection)
   that complement the L7 rate limiting already done in Nginx
   (Phase 5).
3. Includes a DNS resolver the lab can forward to, so internal BIND9
   has a single upstream and the firewall is the only DNS egress.
4. Is recognisable to a systems-administration tribunal, the same
   argument made for BIND9 in ADR-0008.
5. Runs comfortably as a VM in VMware Workstation on modest resources.

This ADR records which firewall platform was chosen and why.

## Decision Drivers

- The platform must be open-source with a clear, unencumbered licence
  and a community edition that is a first-class product, not a
  feature-limited teaser for a paid tier.
- It must have a manageable GUI: a large part of the TFC's value is
  demonstrating that the operator can configure rules, NAT and a
  resolver and reason about them.
- The configuration must be auditable. Even if it is not stored as
  code in the repo, the running posture has to be describable and
  verifiable (see `RULES.md` / `NMAP.md`).
- It must ship the features Phase 7 needs out of the box: multiple
  interfaces, stateful rules, destination NAT, an integrated
  recursive resolver (Unbound), and L3/L4 protections.
- It must have a predictable release and maintenance cadence so the
  lab does not rot between now and the defence.
- It must run on 2 vCPU / 2 GB RAM without strain.

## Considered Options

- **Option A** — OPNsense, a HardenedBSD-based firewall distribution
  with a web GUI, integrated Unbound, and a six-month release cadence.
- **Option B** — pfSense CE (Community Edition), the FreeBSD-based
  firewall OPNsense was originally forked from in 2015.
- **Option C** — VyOS, a Debian-based router/firewall with a
  config-as-code CLI and no GUI.
- **Option D** — Roll the firewall by hand: a plain Ubuntu VM with
  `nftables` rules, `dnsmasq`/Unbound installed separately, and NAT
  configured manually.

## Decision Outcome

Chosen option: "**Option A — OPNsense**". A single OPNsense VM is
given three interfaces (WAN on the VMware NAT network, DMZ and LAN on
host-only networks). It performs the WAN→DMZ destination NAT for 443,
enforces the per-interface rule set documented in
[`infra/opnsense/RULES.md`](../../infra/opnsense/RULES.md), and runs
Unbound as the single DNS egress that internal BIND9 forwards to.

The firewall's posture is default-deny on WAN and DMZ, with explicit
allows enumerated per flow; LAN is treated as the trusted admin zone.
The running configuration is not checked into the repository as code
(see ADR rationale below), but it is mirrored in `RULES.md` and
independently verified by the `nmap` scans in `NMAP.md`.

### Positive Consequences

- The licence is unambiguous: OPNsense is BSD-licensed and its
  community edition is the product, not a trial. There is no
  feature-gated "Plus" tier hanging over it.
- The release cadence is predictable — two dated releases a year —
  which means the lab can be rebuilt or patched on a known schedule
  rather than waiting on an opaque roadmap.
- Unbound ships integrated and turned on, which is exactly the
  upstream that internal BIND9 needs. No separate resolver to install
  and wire up.
- The GUI is modern and the whole rule set, NAT and resolver config
  are visible and explainable in a defence. A REST API exists for
  later automation (e.g. a Phase 9 monitor querying firewall state).
- It runs comfortably in 2 GB of RAM in VMware Workstation.
- It is recognisable. A tribunal in a systems-administration
  programme will know what OPNsense is and will not need a digression
  justifying an exotic choice.

### Negative Consequences

- It is a full BSD appliance. When something breaks below the GUI,
  debugging means knowing HardenedBSD/FreeBSD conventions, which are
  less familiar than Linux. This surfaced during bring-up more than
  once.
- The GUI vocabulary shifts between versions. In the 25.x line "Port
  Forward" became "Destination NAT", which does not match older
  tutorials and cost some confusion before the equivalence was clear.
- A lab gotcha worth recording: with the WAN on a private VMware NAT
  network, the default "Block private networks" rule on WAN silently
  drops all WAN traffic. It has to be disabled for this topology —
  obvious in hindsight, opaque while it is happening.
- It is heavier than hand-rolled `nftables`: a whole OS image to keep
  patched, versus a handful of rules in a file. For a one-firewall
  lab the convenience wins, but it is not free.

## Pros and Cons of the Options

### Option A — OPNsense

- Good, because the community edition is a complete, BSD-licensed
  product with no paid-tier overhang and a transparent, dated release
  cadence.
- Good, because it bundles everything Phase 7 needs (multi-interface
  stateful filtering, NAT/DNAT, Unbound, L3/L4 protections) behind a
  GUI that is straightforward to demonstrate and defend.
- Good, because it is recognisable to the tribunal and matches the
  curriculum's expectations for a systems-administration firewall.
- Bad, because it is a full BSD distribution: low-level debugging
  requires BSD knowledge and the UI vocabulary drifts between
  releases.

### Option B — pfSense CE

- Good, because it is technically very mature and the most widely
  deployed open firewall, so the knowledge transfers broadly.
- Good, because it shares almost all of OPNsense's feature set — the
  two are close cousins.
- Bad, because the governance and licensing picture is less
  comfortable: pfSense CE coexists with a separate commercial "Plus"
  edition, and the community-versus-vendor relationship has been
  visibly tense since OPNsense forked from it in 2015. For a project
  that wants a clean, defensible open-source story, that uncertainty
  is a real (if non-technical) drawback.
- Bad, because the CE release cadence has been less predictable than
  OPNsense's dated six-month rhythm.

### Option C — VyOS

- Good, because its configuration is genuinely code: a single text
  config that could live in the repo, which is conceptually cleaner
  than mirroring a GUI's state in a Markdown file.
- Good, because it is a real-world skill in service-provider and
  cloud-network contexts.
- Bad, because the freely-available rolling builds are aimed at
  contributors, and the stable images sit behind a subscription or a
  self-build. The "just download the LTS ISO" story is not as clean
  as OPNsense's.
- Bad, because it has no GUI. For a TFC where part of the point is
  showing the operator navigating firewall, NAT and resolver
  configuration, a CLI-only device removes a chunk of what is being
  demonstrated and assessed.

### Option D — Hand-rolled nftables on Ubuntu

- Good, because it is the lightest possible option: one VM, a rules
  file, no extra appliance to patch.
- Good, because it would keep everything Linux, matching the rest of
  the lab and avoiding any BSD knowledge gap.
- Good, because the rules could live in the repo as code and be
  reviewed like any other file.
- Bad, because it rebuilds from scratch what a firewall distribution
  already solves: NAT, stateful tracking, a resolver, L3/L4
  protections, an interface to manage it. That is a lot of moving
  parts to assemble and justify.
- Bad, because it teaches the wrong lesson for this TFC. A phase
  explicitly about perimeter firewalling should use a recognised
  firewall platform, the same reasoning that picked BIND9 over
  hand-rolled DNS in ADR-0008.

## Links

- `infra/opnsense/RULES.md` — flow matrix, NAT and per-interface rules.
- `infra/opnsense/NMAP.md` — verification scans from three vantage points.
- `docs/ARCHITECTURE.md` — Phase 7 network topology diagram.
- ADR-0005 (Nginx reverse proxy) — the L7 layer this complements.
- ADR-0007 (rate limiting) — the L7 rate limiting that OPNsense's
  L3/L4 controls complement.
- ADR-0008 (internal DNS with BIND9) — internal BIND9 forwards to
  OPNsense's Unbound as its single upstream.
