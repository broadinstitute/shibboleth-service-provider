if [ ! -e .authkey ]; then
  echo 'Missing .authkey for dev deploy.'
  exit 1
fi

set -x

gcloud app deploy --project=broad-shibboleth-prod --version="$USER-dev" --no-promote -q
