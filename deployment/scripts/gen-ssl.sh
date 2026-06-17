#!/usr/bin/env bash
# Generate a self-signed cert for LOCAL production testing.
# For real production use certbot / Let's Encrypt instead (see deployment/README.md).
#
#   bash deployment/scripts/gen-ssl.sh casino.localhost
set -euo pipefail

DOMAIN="${1:-casino.localhost}"
CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:admin.$DOMAIN,DNS:localhost"

echo "Self-signed cert written to $CERT_DIR for $DOMAIN (+ admin.$DOMAIN)."
echo "Browsers will warn on self-signed certs — expected for local testing."
