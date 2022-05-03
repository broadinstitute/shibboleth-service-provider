const assert = require('assert').strict
const auth = require('auth')
const bodyParser = require('body-parser')
const config = require('config')
const cp = require('child_process')
const express = require('express')
const jwt = require('jsonwebtoken')
const _ = require('lodash/fp')
const saml2 = require('saml2-js')
const url = require('url')
const u = require('utils')
const whitelist = require('whitelist')


function escapeHtml(html) {
  return html
    .replace(/[<]/g, '&lt;')
    .replace(/[>]/g, '&gt;')
}

function decodeUriEncoded(s, shouldTrim = false) {
  const dec = decodeURIComponent
  const kvs = s.split('&')
  const pairs = _.map((kv) => kv.split('='))(kvs)
  return _.fromPairs(
    _.map(([k, v]) => [dec(shouldTrim ? k.trim() : k), dec(shouldTrim ? v.trim() : v)])(pairs)
  )
}

async function withConfig(req, res, next) {
  req.config = await config.maybeFetchConfigData(async () => {
    return (await auth.getBearerTokenFromMetadata()) || (await auth.getBearerTokenFromGcloudAuth())
  })
  next()
}

function verifyJwt(token, publicKey) {
  try {
    return jwt.verify(token, publicKey, {algorithms: ['RS256']})
  } catch (err) {
    return
  }
}

const app = express()

app.use((req, res, next) => {
  if (req.headers['host'] !== 'shibboleth.dsde-prod.broadinstitute.org') {
    return next()
  }
  res.status(400)
  res.write('This version of the Shibboleth service has been permanently shut down.')
  res.write(' The current version is\navailable at broad-shibboleth-prod.appspot.com.')
  res.write(' Contact support@terra.bio for migration assistance.\n')
  res.end()
})

app.get('/hello', (req, res) => {
  res.send(`The time is: ${(new Date()).toISOString()}\n`)
})

app.get('/repl', async (req, res) => {
  function p(x) {
    let s = undefined
    if (_.isObject(x)) { s = JSON.stringify(x, null, 2) }
    else { s = x.toString() }
    res.send(s+'\n').end()
  }
  p(isWhiteListed('/example-return?token=asdf'))
})

app.post('/.src', async (req, res, next) => {
  const [type, value] = (req.headers['authorization'] || '').split(/\s+/)
  global.authCache = global.authCache || {}
  if (global.authCache[value]) {
    console.log('Using bearer token from cache.')
    req.locals = {isReloadOkay: true}
    next()
    return
  }
  const requiredPerm = 'appengine.applications.update'
  assert.ok(
    process.env.GOOGLE_CLOUD_PROJECT,
    'GOOGLE_CLOUD_PROJECT environment variable not defined'
  )
  const permsCheck = u.httpreq({
    hostname: 'cloudresourcemanager.googleapis.com',
    path: `/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}:testIamPermissions`,
    method: 'post',
    headers: {'Authorization': req.headers['authorization'], 'Content-Type': 'application/json'}
  })
  permsCheck.req.write(JSON.stringify({permissions: [requiredPerm]}))
  permsCheck.req.end()
  await permsCheck.resp
  if (permsCheck.res.statusCode !== 200) {
    res.status(permsCheck.res.statusCode)
    return permsCheck.res.pipe(res)
  }
  permsCheck.body = await u.consumeStreamp(permsCheck.res)
  const grantedPerms = JSON.parse(permsCheck.body.toString()).permissions
  if (_.indexOf(requiredPerm)(grantedPerms) !== -1) {
    global.authCache[value] = true
    setTimeout(() => { delete global.authCache[value] }, 3600000)
    req.locals = {isReloadOkay: true}
    next()
  } else {
    res.send(JSON.stringify({error: {
      message: 'missing required permission',
      requiredPermission: requiredPerm,
      grantedPermissions: grantedPerms
    }}, null, 2)).end()
  }
})

app.get('/public-key.pem', withConfig, (req, res, next) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send(req.config.data.prodKeyPublic).end()
})

app.get('/dev/public-key.pem', withConfig, (req, res, next) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send(req.config.data.devKeyPublic).end()
})

app.get('/', (req, res, next) => {
  const exampleReturnUrl = '/example-return?token=<token>'
  const devStartUrl = `/dev/login?return-url=${encodeURIComponent(exampleReturnUrl)}`
  const prodStartUrl = `/login?return-url=${encodeURIComponent(exampleReturnUrl)}`
  res.send([
    '<h2>Example Workflows for eRA Commons Account Verification</h2>',
    `<p>return url:<br> <b>${escapeHtml(exampleReturnUrl)}</b></p>`,
    `<p>url-encoded:<br><b>${encodeURIComponent(exampleReturnUrl)}</b></p>`,
    '<h3>Development Flow</h3>',
    `<p>key url: <a href="/dev/public-key.pem">/dev/public-key.pem</a>`,
    `<p>start:<br><a href="${devStartUrl}">${devStartUrl}</a></p>`,
    '<h3>Production Flow</h3>',
    `<p>key url: <a href="/public-key.pem">/public-key.pem</a>`,
    `<p>start:<br><a href="${prodStartUrl}">${prodStartUrl}</a></p>`,
    ].join('')).end()
})

app.get('/dev/login', (req, res, next) => {
  const returnUrl = req.query['return-url']
  const isDev = process.env.NODE_ENV !== 'production' // set by App Engine
  res.set(
    'Set-Cookie',
    `return-url=${encodeURIComponent(returnUrl)}; Path=/; HttpOnly` +
    (isDev ? '' : '; SameSite=None; Secure')
  )
  res.send([
    '<h2>Fake eRA Commons Login Page</h2>',
    `<p>return URL: <b>${escapeHtml(returnUrl)}</b></p>`,
    '<form method="post">',
    '<p>Enter any "username" to continue:<br>',
    '<input type="text" name="fakeUsername"></p>',
    '<p><input type="submit" value="&quot;Sign-In&quot;"></p>',
    '</form>',
  ].join('')).end()
})

app.post('/dev/login', withConfig, async (req, res, next) => {
  const body = await u.consumeStreamp(req)
  const cleaned = decodeUriEncoded(body.toString(), true)
  const cookies = decodeUriEncoded(req.get('cookie'))
  const fakeUsername = cleaned.fakeUsername.length === 0 ? undefined : cleaned.fakeUsername
  const payload = {'eraCommonsUsername': fakeUsername}
  const privateKey = req.config.data.devKeyPrivate
  const token = jwt.sign(payload, privateKey, {algorithm: 'RS256', expiresIn: '60m'})
  const returnUrl = cookies['return-url'].replace('<token>', token).replace('{token}', token)
  res.send([
    '<h2>"Sign-In" Successful!</h2>',
    `<p>fake username: <b>${escapeHtml(fakeUsername)}</b></p>`,
    '<h3>JWT</h3>',
    '<p>signing key: <b>(dev private key)</b></p>',
    '<p>verification key: <b><a href="/dev/public-key.pem">/dev/public-key.pem</a></b></p>',
    `<p>token payload: <b>${escapeHtml(JSON.stringify(payload))}</b></p>`,
    `<p>token:<br><b>${token.match(/.{1,40}/g).join('<br>')}</b></p>`,
    '<h3>Return URL</h3>',
    `<a href="${returnUrl}">${returnUrl.match(/.{1,40}/g).join('<br>')}</a>`,
  ].join('')).end()
})

app.get('/example-return', withConfig, (req, res, next) => {
  const token = req.query.token
  const [header, payload, signature] =
    _.map((x) => Buffer.from(x, 'base64').toString())(token.split('.'))
  const devPublicKey = req.config.data.devKeyPublic
  const prodPublicKey = req.config.data.prodKeyPublic
  const devVerified = verifyJwt(token, devPublicKey) && 'passed' || 'failed'
  const prodVerified = verifyJwt(token, prodPublicKey) && 'passed' || 'failed'
  res.send([
    '<h2>Example Return Page</h2>',
    `<p>header: <b>${header}</b></p>`,
    `<p>payload: <b>${payload}</b></p>`,
    '<h3>Verification</h3>',
    `<p>dev: <b>${devVerified}</b>`,
    `<p>prod: <b>${prodVerified}</b>`,
  ].join('')).end()
})

function maybeCreateSp(config) {
  if (global.sp) return global.sp;
  global.sp = new saml2.ServiceProvider({
    entity_id: 'https://broad-shibboleth-prod.appspot.com',
    private_key: config.data.spKey,
    certificate: config.data.spCert,
    assert_endpoint: 'https://broad-shibboleth-prod.appspot.com/assert'
  })
  return global.sp
}

const withSp = [withConfig, (req, res, next) => {
  req.sp = maybeCreateSp(req.config)
  next()
}]

function maybeCreateIdp(config) {
  if (global.idp) return global.idp;
  global.idp = new saml2.IdentityProvider({
    sso_login_url: "https://auth.nih.gov/affwebservices/public/saml2sso",
    sso_logout_url: "https://auth.nih.gov/affwebservices/public/saml2sso",
    certificates: [config.data.idpCert],
    sign_get_request: true
  })
  return global.idp
}

const withIdp = [withConfig, (req, res, next) => {
  req.idp = maybeCreateIdp(req.config)
  next()
}]

app.get("/metadata.xml", withSp, function(req, res) {
  res.type('application/xml').send(req.sp.create_metadata()).end()
})

app.get("/login", [withSp, withIdp], function(req, res) {
  const returnUrl = req.query['return-url']
  res.set(
    'Set-Cookie',
    `return-url=${encodeURIComponent(returnUrl)}; Path=/; HttpOnly; Secure; SameSite=None`
  )
  req.sp.create_login_request_url(req.idp, {}, (err, loginUrl, requestId) => {
    if (err) return console.error(err)
    res.redirect(loginUrl)
  })
})

function isWhiteListed(urlString) {
  let url = undefined
  try {
    url = new URL(urlString)
  } catch (e) {
    return false
  }
  if (url.protocol !== 'https:') return false;
  const parsedWhitelist = _.map((x) => new URL(x))(whitelist)
  const match = _.find((x) => {
    if (url.origin === x.origin) {
      return url.pathname.startsWith(x.pathname)
    }
    return false
  })(parsedWhitelist)
  return match ? true : false
}

function redirectOrPause(res, returnUrl, token) {
  if (isWhiteListed(returnUrl)) {
    return res.redirect(returnUrl)
  } else {
    const returnUrlWithRedaction = returnUrl.replace(token, '[redacted]')
    res.send([
      '<h2>Un-Trusted Return URL</h2>',
      `<p>The provided return URL:</p>`,
      `<p><b>${escapeHtml(returnUrlWithRedaction)}</b></p>`,
      `<p>is not trusted. Contact `,
      `<a href="https://support.terra.bio/hc/en-us">Terra Support</a>`,
      ` to request that your URL be added to the trusted list.</p>`,
      `<p style="font-size: small;">Full URL for diagnosis:<br>${escapeHtml(returnUrl)}</p>`
    ].join('')).end()
  }
}

app.post("/assert", [withSp, withIdp], bodyParser.urlencoded({extended: true}), function(req, res) {
  const options = {request_body: req.body}
  req.sp.post_assert(req.idp, options, function(err, samlResponse) {
    // Note: If an error is thrown within this callback, the reported error will be
    // "Callback was already called." So that is usually a red herring.
    if (err != null) {
      console.error(err)
      return res.status(500)
    }
    try {
      const cookies = decodeUriEncoded(req.get('cookie'))
      const privateKey = req.config.data.prodKeyPrivate
      const payload = {eraCommonsUsername: samlResponse.user.name_id}
      const token = jwt.sign(payload, privateKey, {algorithm: 'RS256', expiresIn: '60m'})
      const returnUrl = cookies['return-url'].replace('<token>', token).replace('{token}', token)
      return redirectOrPause(res, returnUrl, token)
    } catch (e) {
      console.error(e)
      return res.status(500)
    }
  })
})

module.exports = app
