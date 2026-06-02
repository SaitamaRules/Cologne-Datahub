#!/usr/bin/env python3
"""
Cologne DataHub — service monitor (vm-db).

A dependency-free availability monitor. Every CHECK_INTERVAL seconds it
opens a TCP connection to each target in TARGETS: a successful connect
means "up", a refused connection or timeout means "down". State is held
in memory and an alert is emitted only when a target changes state
(up -> down or down -> up), so a service that stays down is not
re-announced every cycle.

Alerts go to Telegram when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are
set; otherwise they are written to the log only. Standard library only.
"""

import json
import logging
import os
import signal
import socket
import sys
import time
import urllib.error
import urllib.request

# --- Targets: (name, host, port) ------------------------------------------
# Local databases are reached by Docker service name; the API, the proxy
# and the DNS resolver are reached by their physical lab address.
TARGETS = [
    ("postgres", "postgres", 5432),       # vm-db, local (Docker network)
    ("mongo", "mongo", 27017),            # vm-db, local (Docker network)
    ("api", "10.10.10.20", 8000),         # vm-app (LAN)
    ("nginx", "192.168.113.30", 443),     # vm-web (DMZ)
    ("bind9", "192.168.113.30", 53),      # vm-web (DMZ)
]

CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", "30"))
TCP_TIMEOUT = float(os.environ.get("TCP_TIMEOUT", "5"))
STARTUP_DELAY = int(os.environ.get("STARTUP_DELAY", "15"))
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("monitor")

_running = True


def _stop(signum, _frame):
    global _running
    _running = False
    log.info("signal %s received, shutting down", signum)


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def check_tcp(host, port):
    """True if a TCP connection to host:port succeeds within the timeout."""
    try:
        with socket.create_connection((host, port), timeout=TCP_TIMEOUT):
            return True
    except OSError:
        return False


def send_telegram(text):
    """Best-effort Telegram notification. Never raises."""
    if not (BOT_TOKEN and CHAT_ID):
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = json.dumps({"chat_id": CHAT_ID, "text": text}).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=TCP_TIMEOUT) as resp:
            if resp.status != 200:
                log.warning("Telegram returned HTTP %s", resp.status)
    except (urllib.error.URLError, OSError) as exc:
        log.warning("Telegram notification failed: %s", exc)


def notify(text):
    log.info(text)
    send_telegram(text)


def run():
    desc = ", ".join(f"{n}({h}:{p})" for n, h, p in TARGETS)
    log.info(
        "monitor starting — %d targets every %ds: %s",
        len(TARGETS), CHECK_INTERVAL, desc,
    )
    if not (BOT_TOKEN and CHAT_ID):
        log.warning("TELEGRAM_BOT_TOKEN/CHAT_ID not set — alerts go to log only")

    if STARTUP_DELAY > 0:
        time.sleep(STARTUP_DELAY)

    state = {}
    first = True
    while _running:
        results = {name: check_tcp(host, port) for name, host, port in TARGETS}

        if first:
            summary = ", ".join(
                f"{n}={'up' if results[n] else 'down'}" for n, _, _ in TARGETS
            )
            notify(f"Monitor online. Initial state: {summary}")
            state = results
            first = False
        else:
            for name, up in results.items():
                if up != state[name]:
                    icon = "\U0001F7E2" if up else "\U0001F534"  # green / red
                    notify(f"{icon} {'UP' if up else 'DOWN'} — {name}")
            state = results

        # Sleep in one-second slices so SIGTERM is honoured promptly.
        slept = 0
        while _running and slept < CHECK_INTERVAL:
            time.sleep(1)
            slept += 1

    log.info("monitor stopped")


if __name__ == "__main__":
    run()
