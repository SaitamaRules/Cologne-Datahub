# Backup helper image for vm-db.
#
# Bundles the PostgreSQL 16 client (pg_dump / pg_restore) and the MongoDB
# Database Tools (mongodump / mongorestore) plus curl, so a single
# container can back up both databases and pull the OPNsense config.
#
# Built locally by `docker compose build`; never pushed to a registry.

FROM postgres:16-bookworm

# Pinned for reproducibility — bump deliberately, not automatically.
ARG MONGO_TOOLS_VERSION=100.17.0

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates; \
    curl -fsSL -o /tmp/mongodb-database-tools.deb \
      "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-debian12-x86_64-${MONGO_TOOLS_VERSION}.deb"; \
    apt-get install -y --no-install-recommends /tmp/mongodb-database-tools.deb; \
    rm -f /tmp/mongodb-database-tools.deb; \
    rm -rf /var/lib/apt/lists/*

COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

# This container hosts the backup tooling only — it does not run a database.
# Drop the postgres entrypoint and idle; Ofelia execs the scripts on schedule.
ENTRYPOINT []
CMD ["tail", "-f", "/dev/null"]
