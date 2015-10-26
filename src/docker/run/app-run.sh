#!/bin/sh

exec node <<EOF
require("source-map-support").install();
require('/working/target/cljsbuild-compiler-0/goog/bootstrap/nodejs');
require('/working/target/cljsbuild-main');
require('/working/target/cljsbuild-compiler-0/org/broadinstitute/shibsp/main');
org.broadinstitute.shibsp.main._main();
EOF
