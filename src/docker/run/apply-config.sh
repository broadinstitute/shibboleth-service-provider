#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

CONFIG_PATH='/working/target/config'
mkdir -p "$CONFIG_PATH"

FILE="$CONFIG_PATH"'/config.json'
if [ ! -e "$FILE" ]; then
  echo "$FILE"' not found!';
  echo 'copy src/docker/run/config-example.json to target/config/config.json' \
    ' and modify for your environment';
  exit 1;
fi
export SERVER_NAME="$(jq '.serverName' $FILE | tr -d '\"')"
export SIGNING_SECRET="$(jq '.signingSecret' $FILE | tr -d '\"')"

#
# Shibboleth
#
function print_shib_help() {
  echo 'try: docker run --rm -v "$PWD":/working <this-image> shib-keygen -o target/config';
}

FILE="$CONFIG_PATH"'/sp-cert.pem'
if [ ! -e "$FILE" ]; then
  echo "$FILE"' not found!';
  print_shib_help;
  exit 1;
fi
cp "$FILE" /etc/shibboleth

FILE="$CONFIG_PATH"'/sp-key.pem'
if [ ! -e "$FILE" ]; then
  echo "$FILE"' not found!';
  print_shib_help;
  exit 1;
fi
cp "$FILE" /etc/shibboleth

#
# Apache
#
FILE="$CONFIG_PATH"'/ca-bundle.crt'
if [ ! -e "$FILE" ]; then
  echo "$FILE"' not found!';
  echo 'Generate or locate an appropriate ca-bundle.crt for your organization.';
  echo 'e.g.: https://github.com/broadinstitute/dockerfiles/blob/master/apache-proxy/ca-bundle.crt';
  exit 1;
fi
cp "$FILE" /etc/ssl/certs

function print_ssl_help() {
  echo 'Generate or locate an appropriate SSL certificate pair for your organization.';
  echo 'e.g.:' 
  echo 'openssl req -newkey rsa:4096 -days 365 -nodes -x509 \'
  echo '  -subj "/C=US/ST=Your State/L=Your City/O=Your Organization Name/CN=localhost" \'
  echo '  -keyout '"$CONFIG_PATH"'/server.key \'
  echo '  -out '"$CONFIG_PATH"'/server.crt'
}

FILE="$CONFIG_PATH"'/server.crt'
if [ ! -e "$FILE" ]; then
  echo "$FILE"' not found!';
  print_ssl_help;
  exit 1;
fi
cp "$FILE" /etc/ssl/certs

FILE="$CONFIG_PATH"'/server.key'
if [ ! -e "$FILE" ]; then
  echo "$FILE"' not found!';
  print_ssl_help;
  exit 1;
fi
cp "$FILE" /etc/ssl/private
