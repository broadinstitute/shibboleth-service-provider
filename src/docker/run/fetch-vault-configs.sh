#!/bin/bash
set -euox pipefail
IFS=$'\n\t'

export VAULT_TOKEN="$1"
env_name="$2"
if [ "$env_name" == 'prod' ]; then
  idp_metadata_url='http://citdecadssoweb.cit.nih.gov/saml2/idp/saml2-nih-itrustprod-idp.xml'
  idp_entity_id='https://itrusteauth.nih.gov/IDP'
else
  idp_metadata_url='http://citdecadssoweb.cit.nih.gov/saml2/idp/saml2-nih-itrustdev-idp.xml'
  idp_entity_id='https://citdecadssoweb.cit.nih.gov/SAML2/IDP'
fi
secret_path="$VAULT_ROOT/$env_name/$VAULT_PROJECT_NAME"

if [ ! -e /working/target/config/config.json ]; then
  echo 'Missing base config: target/config/config.json'
  exit 1
fi

echo $(vault read -format=json "$secret_path/signing-secret") \
  $(< /working/target/config/config.json) \
  | jq -s ".[1] * {signingSecret: .[0].data.value, idpMetadataUrl: \"$idp_metadata_url\", idpEntityId: \"$idp_entity_id\"}" \
  > /working/target/config/config.new.json \
  && mv /working/target/config/config.new.json /working/target/config/config.json

vault read -field=chain "secret/common/ca-bundle.crt" > /working/target/config/ca-bundle.crt
vault read -field=value "$secret_path/sp-cert.pem" > /working/target/config/sp-cert.pem
vault read -field=value "$secret_path/sp-key.pem" > /working/target/config/sp-key.pem
vault read -field=value "$secret_path/server.crt" > /working/target/config/server.crt
vault read -field=value "$secret_path/server.key" > /working/target/config/server.key
