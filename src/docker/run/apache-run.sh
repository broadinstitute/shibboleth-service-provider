#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

exec /usr/sbin/apachectl -DNO_DETACH -DFOREGROUND 2>&1
