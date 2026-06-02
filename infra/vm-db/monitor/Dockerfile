# Service monitor image for vm-db. Standard library only — no pip installs.
FROM python:3.12-slim

# ca-certificates so urllib can verify TLS when reaching the Telegram API.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY monitor.py /app/monitor.py

# Unbuffered stdout so logs show up immediately in `docker compose logs`.
ENV PYTHONUNBUFFERED=1

CMD ["python", "monitor.py"]
