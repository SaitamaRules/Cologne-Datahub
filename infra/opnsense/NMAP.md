# NMAP verification — Phase 7 firewall posture

Verification of the flow matrix declared in `RULES.md`. Three scans
from three vantage points cover the directions that matter: from the
external WAN side, from DMZ into LAN, and from LAN into DMZ.

Each scan probes the seven ports relevant to the lab (the four ports
exposed on any host, plus 53, 5432, 27017 to confirm they are *not*
reachable where they should not be).

All scans use `-Pn` to skip host discovery (OPNsense and the lab VMs
don't return ICMP from arbitrary sources, which would otherwise cause
nmap to mark them as down before probing TCP).

Run on 2026-05-28.

## Scan 1 — Windows host → WAN of OPNsense

The only port that should be open from outside the lab is 443/tcp,
which OPNsense DNATs to `192.168.113.30:443`.

```
PS C:\Users\Saitama> nmap -Pn -p 22,53,80,443,8000,5432,27017 192.168.67.132
Starting Nmap 7.80 ( https://nmap.org ) at 2026-05-28 20:10 Hora de verano romance
Nmap scan report for 192.168.67.132
Host is up (0.0011s latency).
PORT      STATE    SERVICE
22/tcp    filtered ssh
53/tcp    filtered domain
80/tcp    filtered http
443/tcp   open     https
5432/tcp  filtered postgresql
8000/tcp  filtered http-alt
27017/tcp filtered mongod
MAC Address: 00:0C:29:88:7D:5D (VMware)
Nmap done: 1 IP address (1 host up) scanned in 2.13 seconds
```

**Result:** ✔ matches `RULES.md`. Only 443/tcp open; everything else
filtered by the WAN default-deny.

## Scan 2 — vm-web (DMZ) → LAN hosts

DMZ is treated as a partially trusted zone with explicit allows. From
`vm-web` (the only host in DMZ besides OPNsense), the firewall should
let through exactly one destination: `10.10.10.20:8000` (Nginx → API).
Nothing else, and in particular nothing toward vm-db.

### 2a. vm-web → vm-app (10.10.10.20)

```
francisco@web:~$ nmap -Pn -p 22,53,80,443,8000,5432,27017 10.10.10.20
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-28 20:11 +0200
Nmap scan report for 10.10.10.20
Host is up (0.0013s latency).
PORT      STATE    SERVICE
22/tcp    filtered ssh
53/tcp    filtered domain
80/tcp    filtered http
443/tcp   filtered https
5432/tcp  filtered postgresql
8000/tcp  open     http-alt
27017/tcp filtered mongod
Nmap done: 1 IP address (1 host up) scanned in 1.73 seconds
```

**Result:** ✔ matches `RULES.md`. Only 8000/tcp reachable, which is
the API. SSH from vm-web is correctly blocked (UFW on vm-app limits
22/tcp to the LAN subnet, not to DMZ).

### 2b. vm-web → vm-db (10.10.10.10)

```
francisco@web:~$ nmap -Pn -p 22,53,80,443,8000,5432,27017 10.10.10.10
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-28 20:11 +0200
Nmap scan report for 10.10.10.10
Host is up.
PORT      STATE    SERVICE
22/tcp    filtered ssh
53/tcp    filtered domain
80/tcp    filtered http
443/tcp   filtered https
5432/tcp  filtered postgresql
8000/tcp  filtered http-alt
27017/tcp filtered mongod
Nmap done: 1 IP address (1 host up) scanned in 3.54 seconds
```

**Result:** ✔ matches `RULES.md`. Nothing reachable. The data tier is
not accessible from DMZ — vm-app is the only client of vm-db, by both
firewall rule (OPNsense) and host firewall (UFW on vm-db limits
5432 and 27017 to `10.10.10.20/32`).

## Scan 3 — vm-app (LAN) → vm-web (DMZ)

LAN is the trusted zone; the rule is "allow LAN to any" plus
defence-in-depth in UFW on each host. From vm-app, the surface of
vm-web (Nginx, BIND9, SSH) should be reachable.

```
francisco@app:~$ nmap -Pn -p 22,53,80,443,8000,5432,27017 192.168.113.30
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-28 20:12 +0200
Nmap scan report for 192.168.113.30
Host is up (0.0029s latency).
PORT      STATE    SERVICE
22/tcp    open     ssh
53/tcp    open     domain
80/tcp    open     http
443/tcp   open     https
5432/tcp  filtered postgresql
8000/tcp  filtered http-alt
27017/tcp filtered mongod
Nmap done: 1 IP address (1 host up) scanned in 1.73 seconds
```

**Result:** ✔ matches `RULES.md`. SSH, DNS, HTTP and HTTPS open; the
database ports and the upstream API port (which lives on vm-app
itself, not on vm-web) correctly closed.

## Summary

| Vantage point      | Target           | Expected open       | Actual open       | Verdict |
|--------------------|------------------|---------------------|-------------------|---------|
| Windows host (WAN) | OPNsense WAN     | 443                 | 443               | ✔       |
| vm-web (DMZ)       | vm-app (LAN)     | 8000                | 8000              | ✔       |
| vm-web (DMZ)       | vm-db (LAN)      | —                   | —                 | ✔       |
| vm-app (LAN)       | vm-web (DMZ)     | 22, 53, 80, 443     | 22, 53, 80, 443   | ✔       |

Four scans, zero deviations from the declared posture. The combination
of OPNsense rules and per-host UFW gives a consistent surface area
across the lab.
