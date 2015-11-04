#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

if [ ! -e /etc/ssl/certs/ca-bundle.crt ]; then
  vault read -field=ca-bundle-crt "$VAULT_ROOT/ssl-certs/$SERVER_NAME" \
    > /tmp/ca-bundle.crt && mv /tmp/ca-bundle.crt /etc/ssl/certs
  vault read -field=private-server-key "$VAULT_ROOT/ssl-certs/$SERVER_NAME" \
    > /tmp/private-server.key && mv /tmp/private-server.key /etc/ssl/private/server.key
  vault read -field=server-crt "$VAULT_ROOT/ssl-certs/$SERVER_NAME" \
    > /tmp/server.crt && mv /tmp/server.crt /etc/ssl/certs
fi

exec /usr/sbin/apachectl -DNO_DETACH -DFOREGROUND 2>&1
