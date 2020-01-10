set -x

tar -c --exclude='./node_modules/*' . \
  | curl https://"$USER"-dev-dot-broad-shibboleth-prod.appspot.com/.src \
  --data-binary @- -H "Authorization: key $(<.authkey)"
