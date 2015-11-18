FROM phusion/baseimage:0.9.17

ENV DEBIAN_FRONTEND=noninteractive \
  JQ_VERSION=1.5 \
  NODE_PATH='/usr/lib/node_modules' \
  VAULT_ADDR='https://clotho.broadinstitute.org:8200' \
  VAULT_PROJECT_NAME='shibboleth' \
  VAULT_ROOT='secret/dsde' \
  VAULT_VERSION=0.3.1

EXPOSE 80 443

# Note: Node script runs apt-get update.
RUN true \
  $(curl -sL https://deb.nodesource.com/setup_4.x | bash -) \
  && apt-get install -y -qq --no-install-recommends \
    apache2 \
    libapache2-mod-shib2 \
    nodejs \
    unzip \
  && curl -o /tmp/vault.zip https://releases.hashicorp.com/vault/${VAULT_VERSION}/vault_${VAULT_VERSION}_linux_amd64.zip \
  && unzip /tmp/vault.zip -d /bin && rm /tmp/vault.zip \
  && curl -o /usr/local/bin/jq -L https://github.com/stedolan/jq/releases/download/jq-${JQ_VERSION}/jq-linux64 \
  && chmod +x /usr/local/bin/jq \
  && npm install -g jsonwebtoken source-map-support \
  && a2dissite 000-default \
  && a2enmod proxy proxy_http ssl headers \
  && mkdir /working \
  && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /working

COPY src/docker/run/apply-config.sh /etc/my_init.d/apply-config.sh
COPY src/docker/run/fetch-vault-configs.sh /usr/local/bin/fetch-vault-configs
COPY src/docker/run/apache-site.conf /etc/apache2/sites-available/site.conf
COPY src/docker/run/apache-run.sh /etc/service/apache/run
COPY src/docker/run/shibboleth2.xml src/docker/run/attribute-map.xml /etc/shibboleth/
COPY src/docker/run/shibboleth-run.sh /etc/service/shibboleth/run
COPY src/docker/run/app-run.sh /etc/service/app/run
COPY target /working/target

# Idp metadata available at https://this-host/Shibboleth.sso/Metadata

RUN a2ensite site \
  && chmod 0755 /etc/my_init.d/apply-config.sh \
  && chmod 0755 /usr/local/bin/fetch-vault-configs \
  && chmod 0755 /etc/service/apache/run \
  && chmod 0755 /etc/service/shibboleth/run \
  && chmod 0755 /etc/service/app/run \
  && mkdir -p /working/target/config
