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

## Deploying

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

## Generating Certificates for Shibboleth

**Warning: This will require coordination with NIH's Identity Provider System.**

```bash
docker run --rm -it -v "$PWD":/working broadinstitute/shibboleth-service-provider shib-keygen -o .
```

This will generate `sp-cert.pem` and `sp-key.pem` in $PWD.

```bash
export NIH_ENV=dev # dev or prod NIH environment
docker run -it -e VAULT_ADDR='https://clotho.broadinstitute.org:8200' -v "$HOME":/root \
  -v "$PWD":/working \
  broadinstitute/dsde-toolbox \
  vault write secret/dsde/shibboleth-service-provider/shibboleth-cert/$NIH_ENV \
  cert-pem=@sp-cert.pem key-pem=@sp-key.pem
```
