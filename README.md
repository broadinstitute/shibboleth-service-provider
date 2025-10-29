# Shibboleth Service Provider

A generic Shibboleth service provider service for use in Shibboleth authentication schemes (e.g. NIH).

https://broad-shibboleth-prod.appspot.com/

![eRA Commons Account Linking Sequence Diagram](era-commons-flow.png)

<!--
title eRA Commons Account Linking with Shibboleth Service
Browser->UI: eRA Commons account linking page
UI->Browser: <a https://shibboleth.../login?return-url=...{token}> [1]
Browser->Shibboleth: login?return-url=...{token}
Shibboleth->Browser: Set return-url cookie and redirect to eRA Commons Login page
Browser->NIH: Login Page
NIH->Browser: Login Page
Browser->NIH: Credentials
NIH->Browser: Ask broswer to POST to /assert with SAML payload
Browser->Shibboleth: POST SAML payload to /assert (with return-url cookie)
Shibboleth->Shibboleth: Create JWT from NIH SAML response [2]
Shibboleth->Browser: Redirect to return-url
Browser->UI: /[return-url]...token=[JWT]
UI->UI: Handle JWT
-->

1. The web UI presents a link with a `return-url` parameter which includes the literal string `{token}`. Once the user has successfully completed the eRA Commons login flow, they will be redirected to this URL with the `{token}` literal replaced by the encoded JWT.
2. The JWT is encoded and signed with this system's private key. It must be verified using this system's public key, available at the URL `/public-key.pem`.

## Development

### Philosophy

Fast cycles enable learning through experimentation. This provides the foundation for deep system interrogation and innovation as well as safety because of the ability to recover quickly. Fast cycles have been prioritized in this implementation, both for local changes as well as changes to the system as it exists in a production environment.

Approachability is achieved through supporting development and testing as first-class features. Fake, development-appropriate flows with examples are implemented and supported as production features.

Loose coupling is achieved through parameterization, specifically the `return-url`. This has security implications, so these URLs must be on a whitelist. The flow is carefully constructed so developers can complete and test a production implementation before requesting addition to the whitelist, which is not necessary to enable the flow, only to make it smoother.

### Getting Started

```bash
npm start
```

Minimal server up test:

```bash
curl localhost:8080/hello
```

Beyond this, it should be possible to interrogate the system by using any HTTP client. The error messages should help guide toward correct usage. This ideal is not always achieved, but it is the goal.

### Running Dev Flow locally

Before committing/pushing your changes, you should test the dev flow locally.

#### Pre-requisite
The application gets configuration information from a Google Bucket.  In order for you to run the 
Shibboleth service locally, you must `gcloud auth login` as your `firecloud.org` user because this is the account that 
developers own that have access to the configuration bucket.  If you are already logged in as your `firecloud.org` user, 
try logging in again.  

#### How to execute the dev flow
1. Open your browser to: http://localhost:8080
1. Under the "Development Flow" section, click on the link underneath `start:`
1. Enter any string you want as a "username"
1. Click "Sign-In"
1. You should quickly get a response that says ""Sign-In" Successful!" at the top of the page.  If the page hangs, or 
you get an error at this point, check that you have satisfied the [pre-requisite](#pre-requisite).
1. At the bottom of the resulting page, there should be a large link titled, "Return URL".  Click on that link.
1. This should take you to a page title "Example Return Page" and it should have a section title "Verification"
containing `dev: passed`.  At this point it is normal and expected to say `prod: failed` since we did not test the Prod
flow.  

### Hot Reloading

If running locally, the server must be started with the environment variable `GOOGLE_CLOUD_PROJECT` defined, which provides the source for permissions checking.

```bash
GOOGLE_CLOUD_PROJECT=broad-shibboleth-prod npm start
```

```bash
tar -c --exclude='./node_modules/*' . \
  | curl localhost:8080/.src --data-binary @- \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"
```

### Deployment

The Shibboleth Service Provider is hosted on Google App Engine as a single application which supports both the development and production workflows.
Google Cloud Build deploys a new version of the application automatically when commits are merged to the `master` branch. 

## Certificate Management

The Shibboleth Service Provider uses two certificates to perform its SAML exchange:

* Identity Provider (IdP) certificate
* Service Provider (SP) certificate

_For an explanation of Identity Provider vs. Service Provider, see https://www.okta.com/blog/identity-security/what-is-saml/._

These certificates have expiration dates.

**The current IdP cert is due to expire on Sep 10, 2029.**

**The current SP cert is due to expire on Oct 26, 2035.**

### IdP Certificate Management

IdP certs are managed by the NIH, who is the Identity Provider in the SAML exchange. To update the IdP cert:

1. Receive the updated cert from the NIH.
2. Follow the additional steps at [Deploying Updated Certificates](#deploying-updated-certificates)

### SP Certificate Management

SP certs are managed by us, since we are the Service Provider in the SAML exchange. To update the SP cert:

1. Create a new certificate using `openssl` and the [sp-cert-prod.cnf](sp-cert-prod.cnf) file in this repository:
``` shell
openssl req -new -x509 -nodes \
  -newkey rsa:2048 -keyout sp-key.pem \
  -days 3650 -config sp-cert-prod.cnf \
  -out sp-cert.pem
```
2. Follow the additional steps at [Deploying Updated Certificates](#deploying-updated-certificates)


### Deploying Updated Certificates

1. `gcloud auth login` as your @firecloud.org user.
2. Upload the updated cert to gs://broad-shibboleth-prod.appspot.com/keys, following the naming convention in that directory.
3. Locate the current config file used by Shibboleth as defined [in code](https://github.com/broadinstitute/shibboleth-service-provider/blob/33f70ce71cb5f62574c1df8b914a0c603c3c8e65/src/config.js#L4)
4. Download and edit the current config file to reference the cert you uploaded in step 2.
5. Upload the edited config file to gs://broad-shibboleth-prod.appspot.com/configs, following the naming convention in that directory.
6. Modify [the code](https://github.com/broadinstitute/shibboleth-service-provider/blob/33f70ce71cb5f62574c1df8b914a0c603c3c8e65/src/config.js#L4) to use the config file you just uploaded in step 5.
7. Modify this README to include the new expiration date for your cert.
8. Verify the [Dev Flow](#running-dev-flow-locally) locally as detailed earlier in this README
9. Create and merge a PR with your code changes. Merging the PR will automatically deploy your update to production.
10. Manually smoke-test in production.
