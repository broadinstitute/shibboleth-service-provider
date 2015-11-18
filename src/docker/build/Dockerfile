FROM phusion/baseimage:0.9.17

# How to install OpenJDK 8 from:
# http://ubuntuhandbook.org/index.php/2015/01/install-openjdk-8-ubuntu-14-04-12-04-lts/

ENV DEBIAN_FRONTEND=noninteractive \
  LEIN_ROOT=1

RUN true \
  && add-apt-repository ppa:openjdk-r/ppa \
  && apt-get update \
  && apt-get install -y -qq --no-install-recommends \
    openjdk-8-jdk \
  && curl -o /usr/bin/lein https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein \
  && chmod 0755 /usr/bin/lein \
  && lein --version \
  && mkdir /working \
  && apt-get -yq autoremove && apt-get -yq clean && rm -rf /var/lib/apt/lists/* \
  && rm -rf /tmp/* && rm -rf /var/tmp/*

WORKDIR /working

COPY project.clj /working/project.clj

# Download deps and plugins.
RUN lein cljsbuild once
