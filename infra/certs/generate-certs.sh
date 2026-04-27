#!/bin/sh
# generate-certs.sh
#
# Creates an internal Certificate Authority and issues a server
# certificate for Cologne DataHub. All output lands in ./out/ (gitignored).
#
# Designed to run inside the alpine/openssl container. From the host:
#
#   docker run --rm -v "$PWD/infra/certs:/work" -w /work \
#       alpine/openssl sh generate-certs.sh
#
# Idempotent only in the sense that it overwrites previous output. Re-running
# rotates the CA and the server cert. If only the server cert needs renewal,
# delete out/server.* and rerun (the script will reuse ca.* if present).

set -eu

OUT_DIR="out"
CONFIG="openssl.cnf"

CA_VALIDITY_DAYS=3650        # 10 years for the CA
SERVER_VALIDITY_DAYS=3650    # 10 years for the server cert

CA_KEY="$OUT_DIR/ca.key"
CA_CRT="$OUT_DIR/ca.crt"
SERVER_KEY="$OUT_DIR/server.key"
SERVER_CSR="$OUT_DIR/server.csr"
SERVER_CRT="$OUT_DIR/server.crt"

mkdir -p "$OUT_DIR"

# --- Root CA --------------------------------------------------------------
# Reuse an existing CA if present. Letting users rotate the CA is explicit:
# delete ca.key and ca.crt manually before rerunning.

if [ -f "$CA_KEY" ] && [ -f "$CA_CRT" ]; then
    echo "==> Reusing existing CA at $CA_KEY"
else
    echo "==> Generating root CA private key (4096-bit RSA)"
    openssl genrsa -out "$CA_KEY" 4096

    echo "==> Self-signing root CA certificate (valid ${CA_VALIDITY_DAYS} days)"
    openssl req -x509 -new -nodes \
        -key "$CA_KEY" \
        -sha256 \
        -days "$CA_VALIDITY_DAYS" \
        -out "$CA_CRT" \
        -config "$CONFIG" \
        -extensions ca_ext \
        -subj "/C=ES/ST=Andalucia/L=Malaga/O=Cologne DataHub Internal CA/OU=TFC ASIR/CN=Cologne DataHub Root CA"
fi

# --- Server certificate ---------------------------------------------------
# Always regenerated. The CSR is kept in out/ for reference but is not
# strictly necessary at runtime.

echo "==> Generating server private key (2048-bit RSA)"
openssl genrsa -out "$SERVER_KEY" 2048

echo "==> Creating Certificate Signing Request"
openssl req -new \
    -key "$SERVER_KEY" \
    -out "$SERVER_CSR" \
    -config "$CONFIG"

echo "==> Signing server certificate with the internal CA (valid ${SERVER_VALIDITY_DAYS} days)"
openssl x509 -req \
    -in "$SERVER_CSR" \
    -CA "$CA_CRT" \
    -CAkey "$CA_KEY" \
    -CAcreateserial \
    -out "$SERVER_CRT" \
    -days "$SERVER_VALIDITY_DAYS" \
    -sha256 \
    -extfile "$CONFIG" \
    -extensions server_ext

# --- Verification ---------------------------------------------------------
# Confirm the server cert chains correctly to the CA. If this fails, the
# Nginx config in Phase B would also fail, so catching it here saves time.

echo "==> Verifying certificate chain"
openssl verify -CAfile "$CA_CRT" "$SERVER_CRT"

echo
echo "Done. Files in $OUT_DIR:"
ls -la "$OUT_DIR"
echo
echo "Next steps:"
echo "  1. (Optional) Trust ca.crt on machines that will visit the site."
echo "     - Linux:  sudo cp out/ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
echo "     - Windows: double-click out/ca.crt > Install > Local Machine > Trusted Root CAs"
echo "     - macOS:  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain out/ca.crt"
echo "  2. Restart the Nginx container so it picks up the new server cert."
