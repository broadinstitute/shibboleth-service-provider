FROM phusion/baseimage:0.9.17

# Note: Node script runs apt-get update.
RUN true \
  $(curl -sL https://deb.nodesource.com/setup_4.x | bash -) \
  && apt-get install -y -qq --no-install-recommends \
    apache2 \
    libapache2-mod-shib2 \
    nodejs \
  && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# This is the default, but it must be declared to use it:
ENV NODE_PATH='/usr/lib/node_modules'

RUN npm install -g source-map-support

# Apache Config
# Generate a certificate for local development.
RUN curl -L \
  'https://raw.githubusercontent.com/broadinstitute/dockerfiles/master/apache-proxy/ca-bundle.crt' \
  > /etc/ssl/certs/ca-bundle.crt
RUN openssl req -newkey rsa:4096 -days 365 -nodes -x509 \
    -subj '/C=US/ST=Massachusetts/L=Cambridge/O=Broad Institute/OU=BITS DevOps/CN=localhost/emailAddress=devops@broadinstitute.org' \
    -keyout /etc/ssl/private/server.key \
    -out /etc/ssl/certs/server.crt
# Disable default site
RUN a2dissite 000-default
# Enable custom site
COPY src/docker/run/apache-site.conf /etc/apache2/sites-available/site.conf
RUN a2ensite site
# Enable required modules
RUN a2enmod proxy proxy_http ssl
COPY src/docker/run/apache-run.sh /etc/service/apache/run
COPY src/docker/run/shibboleth2.xml /etc/shibboleth/shibboleth2.xml
COPY src/docker/run/shibboleth-run.sh /etc/service/shibboleth/run
# Idp metadata available at https://this-host/Shibboleth.sso/Metadata

RUN mkdir /working
WORKDIR /working

COPY src/docker/run/app-run.sh /etc/service/app/run
COPY target target

EXPOSE 80 443

ENV SERVER_ADMIN='devops@broadinstitute.org'
