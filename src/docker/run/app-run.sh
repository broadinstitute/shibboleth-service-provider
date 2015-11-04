#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

if [ ! -e /env/signing.env ]; then
  TMP='/tmp/signing.env'
  VALUE="$(vault read -field=secret $VAULT_ROOT/signing/$SIGNING_KEY)"
  echo "export SIGNING_SECRET='$VALUE'" >> "$TMP"
  VALUE="$(vault read -field=redirect-url $VAULT_ROOT/signing/$SIGNING_KEY)"
  echo -n "export REDIRECT_URL='$VALUE'" >> "$TMP"
  mv "$TMP" /env/signing.env
fi

source /env/signing.env

exec node <<EOF
require("source-map-support").install();
require('/working/target/cljsbuild-compiler-0/goog/bootstrap/nodejs');
require('/working/target/cljsbuild-main');
require('/working/target/cljsbuild-compiler-0/org/broadinstitute/shibsp/main');
org.broadinstitute.shibsp.main._main();
EOF
