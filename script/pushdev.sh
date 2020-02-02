set -x

# FYI: `gcloud auth print-access-token` generates a new token each time, which prevents caching.

tar -c --exclude='./node_modules/*' . \
  | curl https://"$USER"-dev-dot-broad-shibboleth-prod.appspot.com/.src \
  --data-binary @- -H "Authorization: Bearer $(gcloud auth print-access-token)"
