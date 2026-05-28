#!/bin/sh
# Generate (or rotate) the server certificate for vm-web.
#
# Behaviour:
#   - If out/ca.crt and out/ca.key exist, the CA is REUSED. This is
#     the normal case across server cert rotations and lets clients
#     keep trusting the same trust anchor.
#   - If they don't exist, a fresh CA is generated (4096-bit RSA,
#     valid 10 years).
#   - The server certificate is ALWAYS regenerated (2048-bit RSA,
#     valid 10 years, signed by the CA, with the SANs declared in
#     openssl.cnf).
#
# Designed to be run inside an alpine/openssl container:
#
#   docker run --rm \
#     -v "$PWD/infra/vm-web/certs:/work" -w /work \
#     --entrypoint sh alpine/openssl generate-certs.sh
#
# To reuse the existing dev-local CA before first run, copy it in:
#
#   cp infra/dev-local/certs/out/ca.{crt,key} infra/vm-web/certs/out/

set -eu

OUT_DIR="${OUT_DIR:-./out}"
CA_DAYS="${CA_DAYS:-3650}"
SERVER_DAYS="${SERVER_DAYS:-3650}"
CONFIG="${CONFIG:-./openssl.cnf}"

mkdir -p "$OUT_DIR"

if [ -f "$OUT_DIR/ca.key" ] && [ -f "$OUT_DIR/ca.crt" ]; then
    echo "==> CA already exists, reusing it."
else
    echo "==> Generating new CA (4096-bit RSA, valid ${CA_DAYS} days)..."
    openssl genrsa -out "$OUT_DIR/ca.key" 4096
    openssl req -x509 -new -nodes -key "$OUT_DIR/ca.key" \
        -sha256 -days "$CA_DAYS" \
        -out "$OUT_DIR/ca.crt" \
        -subj "/CN=Cologne DataHub Internal CA/O=Cologne DataHub/OU=TFC ASIR Phase 7"
fi

echo "==> Generating server key (2048-bit RSA)..."
openssl genrsa -out "$OUT_DIR/server.key" 2048

echo "==> Generating server CSR..."
openssl req -new -key "$OUT_DIR/server.key" \
    -out "$OUT_DIR/server.csr" \
    -config "$CONFIG"

echo "==> Signing server certificate with the CA (valid ${SERVER_DAYS} days)..."
openssl x509 -req -in "$OUT_DIR/server.csr" \
    -CA "$OUT_DIR/ca.crt" \
    -CAkey "$OUT_DIR/ca.key" \
    -CAcreateserial \
    -out "$OUT_DIR/server.crt" \
    -days "$SERVER_DAYS" -sha256 \
    -extfile "$CONFIG" -extensions v3_req

# Cleanup: CSR is intermediate, not needed after signing.
rm -f "$OUT_DIR/server.csr" "$OUT_DIR/ca.srl"

# Permissions: keys are sensitive, certs are public.
chmod 600 "$OUT_DIR/ca.key" "$OUT_DIR/server.key"
chmod 644 "$OUT_DIR/ca.crt" "$OUT_DIR/server.crt"

echo ""
echo "==> Done. Files in $OUT_DIR:"
ls -la "$OUT_DIR"
echo ""
echo "==> CA fingerprint (SHA-256):"
openssl x509 -in "$OUT_DIR/ca.crt" -noout -fingerprint -sha256
echo ""
echo "==> Server certificate SANs:"
openssl x509 -in "$OUT_DIR/server.crt" -noout -ext subjectAltName
echo ""
echo "==> Server certificate validity:"
openssl x509 -in "$OUT_DIR/server.crt" -noout -dates
