# Shibboleth Service Provider

A generic Shibboleth service provider service for use in Shibboleth authentication schemes (e.g. NIH).

![eRA Commons Account Linking Sequence Diagram](era-commons-flow.png)

<!--
title eRA Commons Account Linking with Shibboleth Service
Browser->UI: eRA Commons account linking page
UI->Browser: <a https://shibboleth.../link-nih-account?redirect-url=...{token}> [1]
Browser->Shibboleth: link-nih-account?redirect-url=...{token}
Shibboleth->Browser: Set redirect-url cookie and redirect to /login-and-redirect [2]
Browser->Shibboleth: login-and-redirect
Shibboleth->Shibboleth: Not signed in to eRA Commons [3]
Shibboleth->Browser: Redirect to eRA Commons login at auth.nih.gov/...
Browser->NIH: Login Page
NIH->Browser: Login Page
Browser->NIH: Credentials
NIH->Browser: Redirect back to login-and-redirect with SAML response
Browser->Shibboleth: login-and-redirect (with redirect-url cookie)
Shibboleth->Shibboleth: Create JWT from NIH SAML response [4]
Shibboleth->Browser: Redirect to redirect-url
Browser->UI: /[redirect-url]...token=[JWT]
UI->UI: Handle JWT [5]
-->

1. The web UI presents a link that contains a `redirect-url` parameter which includes the literal string `{token}`. Once the user has successfully completed the eRA Commons login flow, they will be redirected to this URL with the `{token}` literal replaced by the encoded JWT.
2. The passed `redirect-url` parameter is stored as a cookie so it can be used later.
3. The /login-and-redirect path is handled by the libapache2-mod-shib2 Apache module. The user is able to visit that path only if they have an active eRA Commons session. Otherwise, they are automatically redirected to the eRA Commons login page.
4. The JWT is encoded (`jwt-encode(era-commons-username, secret)`) and signed with the secret at vault path `secret/dsde/prod/shibboleth/signing-secret`. The same secret must be used to verify the token passed to the `redirect-url` parameter.
5. `era-commons-username = jwt-decode(token, secret)`

## Configuration

Copy `src/docker/run/config-example.json` `target/config/config.json` and modify for your environment. Run the container to see additional configuration requirements. If you're using Vault, you can generate secrets using this command:
```bash
docker run --rm -v "$PWD":/working broadinstitute/shibboleth-service-provider \
  fetch-vault-configs <vault-token> <environment-name>
```
* `vault-token`: usually "$(<~/.vault-token)"
* `environment-name`: `dev` or `prod`

## Running for Development

`DEV=true` exposes the `/restart` endpoint for server restarting.

```bash
docker run -it --rm --name shib -p 80:80 -p 443:443 \
  -e DEV='true' -v "$PWD":/working \
  broadinstitute/shibboleth-service-provider
```

## Building

`lein cljsbuild auto` will rebuild whenever files are changed and restart the server by calling `https://$APP_HOST/restart`.

```bash
docker run --rm -it -v "$PWD":/working -e APP_HOST=shib \
  broadinstitute/shibboleth-service-provider-build \
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
