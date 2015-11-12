#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

# If this directory does not exist, shibd silently fail to create the listener socket.
mkdir -p /var/run/shibboleth

config='/working/target/config/config.json'
SERVER_NAME="$(jq '.serverName' $config | tr -d '\"')"

SHIB_XML=$(< /etc/shibboleth/shibboleth2.xml)
SHIB_XML=${SHIB_XML/'--SERVER_NAME--'/"$SERVER_NAME"}
echo "$SHIB_XML" > /etc/shibboleth/shibboleth2.xml

exec /usr/sbin/shibd -F -f
