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

# This is the default, but it must be declared to use it:
ENV NODE_PATH='/usr/lib/node_modules'

RUN npm install -g jsonwebtoken source-map-support

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

RUN mkdir /env
RUN mkdir /working
WORKDIR /working

COPY src/docker/run/app-run.sh /etc/service/app/run
COPY target target

EXPOSE 80 443

ENV VAULT_ADDR='https://clotho.broadinstitute.org:8200'
ENV VAULT_ROOT='secret/dsde/shibboleth-service-provider'
ENV VAULT_TOKEN=fix-me
ENV SERVER_ADMIN='devops@broadinstitute.org'
# Used for $VAULT_ROOT/ssl-certs/$SERVER_NAME and $VAULT_ROOT/signing/$SERVER_NAME secrets.
ENV SERVER_NAME=fix-me
# Used for $VAULT_ROOT/shibboleth-cert/$NIH_ENV secrets.
ENV NIH_ENV=dev
