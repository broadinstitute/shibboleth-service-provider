FROM phusion/baseimage:0.9.17

# How to install OpenJDK 8 from:
# http://ubuntuhandbook.org/index.php/2015/01/install-openjdk-8-ubuntu-14-04-12-04-lts/

RUN true \
  && add-apt-repository ppa:openjdk-r/ppa \
  && apt-get update \
  && apt-get install -y -qq --no-install-recommends \
    openjdk-8-jdk \
  && apt-get -yq autoremove && apt-get -yq clean && rm -rf /var/lib/apt/lists/* \
  && rm -rf /tmp/* && rm -rf /var/tmp/*

RUN curl https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein > /usr/bin/lein
RUN chmod 755 /usr/bin/lein
# Tell lein that running as root is okay.
ENV LEIN_ROOT=1
# Actually install leiningen.
RUN lein --version

RUN mkdir /working
WORKDIR /working

COPY project.clj project.clj
# Download deps and plugins.
RUN lein cljsbuild once
