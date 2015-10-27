# Shibboleth Service Provider

A generic Shibboleth service provider service for use in Shibboleth authentication schemes.

## Running for Development

The build image looks for the host `shibsp`, so use that name if you want the server to automatically restart whenever a build completes. `DEV=true` exposes the `/restart` endpoint for server restarting.

```bash
docker run -it --rm --name shibsp -p 80:80 -p 443:443 \
  -e SERVER_NAME='local.broadinstitute.org' \
  -e DEV='true' -v "$PWD":/working \
  broadinstitute/shibboleth-service-provider
```

## Building

`lein cljsbuild auto` will rebuild whenever files are changed and restart the server if it is running at the host `shibsp`.

```bash
docker run --rm -it -v "$PWD":/working broadinstitute/shibboleth-service-provider-build \
  lein cljsbuild auto
```

## Continuous Integration

Steps to build a deployment image:
```bash
docker build -t broadinstitute/shibboleth-service-provider-build -f src/docker/build/Dockerfile .
docker run --rm -it -v "$PWD":/working broadinstitute/shibboleth-service-provider-build \
  lein cljsbuild once
docker build -t broadinstitute/shibboleth-service-provider -f src/docker/run/Dockerfile .
# Push docker images.
# On deployment server:
docker run -it --rm -p 80:80 -p 443:443 \
  -e SERVER_NAME='FIXME' \
  broadinstitute/shibboleth-service-provider
```
