FROM phusion/baseimage:0.9.17

# Note: Node script runs apt-get update.
RUN true \
  $(curl -sL https://deb.nodesource.com/setup_4.x | bash -) \
  && apt-get install -y -qq --no-install-recommends \
    apache2 \
    libapache2-mod-shib2 \
    nodejs \
    unzip \
  && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN curl https://releases.hashicorp.com/vault/0.3.1/vault_0.3.1_linux_amd64.zip > /tmp/vault.zip \
  && unzip /tmp/vault.zip -d /bin && rm /tmp/vault.zip
RUN curl -L https://github.com/stedolan/jq/releases/download/jq-1.5/jq-linux64 > \
  /usr/local/bin/jq \
  && chmod +x /usr/local/bin/jq

# This is the default, but it must be declared to use it:
ENV NODE_PATH='/usr/lib/node_modules'
RUN npm install -g jsonwebtoken source-map-support

COPY src/docker/run/apply-config.sh /etc/my_init.d/apply-config.sh
COPY src/docker/run/fetch-vault-configs.sh /usr/local/bin/fetch-vault-configs

# Apache Config
# Disable default site
RUN a2dissite 000-default
# Enable custom site
COPY src/docker/run/apache-site.conf /etc/apache2/sites-available/site.conf
RUN a2ensite site
# Enable required modules
RUN a2enmod proxy proxy_http ssl headers
COPY src/docker/run/apache-run.sh /etc/service/apache/run
COPY src/docker/run/shibboleth2.xml /etc/shibboleth/shibboleth2.xml
COPY src/docker/run/attribute-map.xml /etc/shibboleth/attribute-map.xml
COPY src/docker/run/shibboleth-run.sh /etc/service/shibboleth/run
# Idp metadata available at https://this-host/Shibboleth.sso/Metadata

RUN mkdir /working
WORKDIR /working

COPY src/docker/run/app-run.sh /etc/service/app/run
COPY target target

EXPOSE 80 443

ENV VAULT_ADDR='https://clotho.broadinstitute.org:8200'
ENV VAULT_ROOT='secret/dsde'
ENV VAULT_PROJECT_NAME='shibboleth'
