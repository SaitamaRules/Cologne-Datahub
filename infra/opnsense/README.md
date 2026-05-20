# OPNsense — Phase 7 firewall

OPNsense's running configuration lives in the appliance itself, not
in this repository. This directory is the documentation layer: it
mirrors the intent of the firewall in a form that can be reviewed
alongside the rest of the lab, and serves as the audit reference
during the defence.

## Files

```
opnsense/
├── README.md      # this file
├── RULES.md       # flow matrix, NAT and rule placement
└── NMAP.md        # Block D: verification scans from three vantage points
```

`NMAP.md` is added in Block D once the firewall is fully wired and
the verification scans are run. Until then, only the intended posture
(`RULES.md`) lives here.

## Why not config-as-code

OPNsense's configuration is exportable as XML (`Diagnostics → Backup
& Restore`), but the export contains secrets and machine identifiers
that are awkward to track in git. For a one-firewall lab the cost of
a config-as-code pipeline does not pay back. The discipline used
instead is:

1. Any rule change is reflected in `RULES.md` in the same commit.
2. Block D runs nmap verifications that must match `RULES.md`.
3. Phase 8 will add an XML backup of the running configuration to
   the off-VM backup set, treating it as data, not as source.

## When in doubt

If the firewall behaviour disagrees with `RULES.md`, the document is
the source of truth: bring the firewall back in line, not the doc.
The doc is what is reviewed; the running config is what was last
edited under stress.
