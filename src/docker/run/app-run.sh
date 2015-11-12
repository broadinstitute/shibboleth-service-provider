#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

config='/working/target/config/config.json'
export SERVER_NAME="$(jq '.serverName' $config | tr -d '\"')"
export SIGNING_SECRET="$(jq '.signingSecret' $config | tr -d '\"')"

exec node <<EOF
require("source-map-support").install();
require('/working/target/cljsbuild-compiler-0/goog/bootstrap/nodejs');
require('/working/target/cljsbuild-main');
require('/working/target/cljsbuild-compiler-0/org/broadinstitute/shibsp/main');
org.broadinstitute.shibsp.main._main();
EOF
