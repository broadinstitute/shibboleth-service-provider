#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

config='/working/target/config/config.json'
export SERVER_NAME="$(jq '.serverName' $config | tr -d '\"')"

exec /usr/sbin/apachectl -DNO_DETACH -DFOREGROUND 2>&1
