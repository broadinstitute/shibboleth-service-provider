#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

if [ ! -e /etc/ssl/certs/ca-bundle.crt ]; then
  vault read -field=value secret/dsde/ca-bundle-crt \
        > /tmp/ca-bundle.crt && mv /tmp/ca-bundle.crt /etc/ssl/certs
fi
if [ ! -e /etc/ssl/private/server.key ]; then
  vault read -field=private-server-key "$VAULT_ROOT/ssl-certs/$SERVER_NAME" \
        > /tmp/private-server.key && mv /tmp/private-server.key /etc/ssl/private/server.key
fi
if [ ! -e /etc/ssl/certs/server.crt ]; then
  vault read -field=server-crt "$VAULT_ROOT/ssl-certs/$SERVER_NAME" \
    > /tmp/server.crt && mv /tmp/server.crt /etc/ssl/certs
fi

exec /usr/sbin/apachectl -DNO_DETACH -DFOREGROUND 2>&1
