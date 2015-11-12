# Shibboleth Service Provider

A generic Shibboleth service provider service for use in Shibboleth authentication schemes (e.g. NIH).

## Configuration

Copy `src/docker/run/config-example.json` `target/config/config.json` and modify for your environment. Run the container to see additional configuration requirements. If you're using Vault, you can generate secrets using this command:
```bash
docker run --rm -v "$PWD":/working broadinstitute/shibboleth-service-provider \
  fetch-vault-configs <vault-token> <environment-name>
```
* `vault-token`: usually "$(<~/.vault-token)"
* `environment-name`: `dev` or `prod`

## Running for Development

The build image looks for the host `shibsp`, so use that name if you want the server to automatically restart whenever a build completes. `DEV=true` exposes the `/restart` endpoint for server restarting.

```bash
docker run -it --rm --name shibsp -p 80:80 -p 443:443 \
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
# On deployment server, follow the "Configuration" instructions, then:
docker run -it --rm -p 80:80 -p 443:443 \
  -v "$PWD"/target:/working/target
  broadinstitute/shibboleth-service-provider
```

## Generating Certificates for Shibboleth

**Warning: This will require coordination with NIH's Identity Provider System.**

```bash
docker run --rm -it -v "$PWD":/working broadinstitute/shibboleth-service-provider shib-keygen -o .
```

This will generate `sp-cert.pem` and `sp-key.pem` in $PWD.
