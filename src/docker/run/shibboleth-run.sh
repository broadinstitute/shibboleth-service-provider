#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

if [ ! -e /etc/shibboleth/sp-cert.pem ]; then
  vault read -field=cert-pem "$VAULT_ROOT/shibboleth-cert/$NIH_ENV" \
    > /tmp/sp-cert.pem && mv /tmp/sp-cert.pem /etc/shibboleth/sp-cert.pem
  vault read -field=key-pem "$VAULT_ROOT/shibboleth-cert/$NIH_ENV" \
    > /tmp/sp-key.pem && mv /tmp/sp-key.pem /etc/shibboleth/sp-key.pem
fi

# If this directory does not exist, shibd silently fail to create the listener socket.
mkdir -p /var/run/shibboleth

SHIB_XML=$(< /etc/shibboleth/shibboleth2.xml)
SHIB_XML=${SHIB_XML/'--SERVER_NAME--'/"$SERVER_NAME"}
echo "$SHIB_XML" > /etc/shibboleth/shibboleth2.xml

exec /usr/sbin/shibd -F -f
