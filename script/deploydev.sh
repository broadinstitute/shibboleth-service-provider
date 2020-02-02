set -x

gcloud app deploy --project=broad-shibboleth-prod --version="$USER-dev" --no-promote -q
