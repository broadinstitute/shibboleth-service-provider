const bodyParser = require('body-parser')
const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')
const jwt = require('jsonwebtoken')
const _ = require('lodash/fp')
const saml2 = require('saml2-js')
const url = require('url')
const u = require('utils')

let config = undefined
let configData = {}

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

function httpGet(lib, url, options) {
  return new Promise((resolve) => {
    lib.get(url, options, (res) => { resolve(res) })
  })
}

function slurp(stream) {
  return new Promise((resolve) => {
    let data = ''
    stream.on('data', (chunk) => { data += chunk })
    stream.on('end', () => {resolve(data) })
  })
}

function slurpAndParse(stream, cb) {
  slurp(stream, (data) => {
    cb(JSON.parse(data))
  })
}

async function getObjectData(authorization, gsUrlString) {
  const url = new URL(gsUrlString)
  const res = await httpGet(
    https,
    'https://www.googleapis.com/download/storage/v1/b/'+
      encodeURIComponent(url.hostname)+'/o/'+encodeURIComponent(url.pathname.slice(1))+
      '?alt=media',
    {headers: {authorization}}
  )
  if (res.statusCode !== 200) {
    const err = new Error(`object fetch failed with status ${res.statusCode}`)
    err.res = res
    throw err
  } else {
    return slurp(res)
  }
}

async function fetchConfigData(authorization) {
  const configPath = process.env.CONFIG_PATH.trim()
  const configUrl = new URL(configPath)
  config = JSON.parse(await getObjectData(authorization, configPath))
  configData.idpCert = await getObjectData(authorization, config['idp-cert-path'])
  configData.spCert = await getObjectData(authorization, config['sp-cert-path'])
  configData.spKey = await getObjectData(authorization, config['sp-key-path'])
  configData.devKeyPublic =
    await getObjectData(authorization, config['dev-signing-public-key-path'])
  configData.devKeyPrivate =
    await getObjectData(authorization, config['dev-signing-private-key-path'])
  configData.prodKeyPublic =
    await getObjectData(authorization, config['prod-signing-public-key-path'])
  configData.prodKeyPrivate =
    await getObjectData(authorization, config['prod-signing-private-key-path'])
}

function verifyJwt(token, publicKey) {
  try {
    return jwt.verify(token, publicKey, {algorithms: ['RS256']})
  } catch (err) {
    return
  }
}

async function createApp() {

  if (!process.env.CONFIG_PATH) { throw new Error('CONFIG_PATH not defined') }

  try {
    await fetchConfigData(`Bearer ${fs.readFileSync('.access-token').toString().trim()}`)
  } catch (e) {
    const mRes = await httpGet(
      http,
      'http://metadata/computeMetadata/v1/instance/service-accounts/default/token',
      {headers: {'Metadata-Flavor': 'Google'}}
    )
    await fetchConfigData(`Bearer ${JSON.parse(await slurp(mRes)).access_token}`)
  }

  const app = express()

  app.get('/hello', (req, res) => {
    res.send(`The time is: ${(new Date()).toISOString()}\n`)
  })

  app.get('/public-key.pem', (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(configData.prodKeyPublic).end()
  })

  app.get('/dev/public-key.pem', (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(configData.devKeyPublic).end()
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
    res.cookie('return-url', returnUrl, {httpOnly: true, secure: true})
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

  app.post('/dev/login', async (req, res, next) => {
    const body = await u.consumeStreamp(req)
    const cleaned = decodeUriEncoded(body.toString(), true)
    const cookies = decodeUriEncoded(req.get('cookie'))
    const fakeUsername = cleaned.fakeUsername.length === 0 ? undefined : cleaned.fakeUsername
    const payload = {'fake-era-commons-username': fakeUsername}
    const privateKey = configData.devKeyPrivate
    const token = jwt.sign(payload, privateKey, {algorithm: 'RS256'})
    const returnUrl = cookies['return-url'].replace('<token>', token)
    res.send([
      '<h2>"Sign-In" Successful!</h2>',
      `<p>fake username: <b>${fakeUsername}</b></p>`,
      '<h3>JWT</h3>',
      '<p>signing key: <b>(dev private key)</b></p>',
      '<p>verification key: <b><a href="/dev/public-key.pem">/dev/public-key.pem</a></b></p>',
      `<p>token payload: <b>${JSON.stringify(payload)}</b></p>`,
      `<p>token:<br><b>${token.match(/.{1,40}/g).join('<br>')}</b></p>`,
      '<h3>Return URL</h3>',
      `<a href="${returnUrl}">${returnUrl.match(/.{1,40}/g).join('<br>')}</a>`,
    ].join('')).end()
  })

  app.get('/example-return', (req, res, next) => {
    const token = req.query.token
    const [header, payload, signature] =
      _.map((x) => Buffer.from(x, 'base64').toString())(token.split('.'))
    const devPublicKey = configData.devKeyPublic
    const prodPublicKey = configData.prodKeyPublic
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

  const spOptions = {
    entity_id: 'https://broad-shibboleth-prod.appspot.com',
    private_key: configData.spKey,
    certificate: configData.spCert,
    assert_endpoint: 'https://broad-shibboleth-prod.appspot.com/assert'
  }
  const sp = new saml2.ServiceProvider(spOptions)

  const idpOptions = {
    sso_login_url: "https://auth.nih.gov/affwebservices/public/saml2sso",
    sso_logout_url: "https://auth.nih.gov/affwebservices/public/saml2sso",
    certificates: [configData.idpCert],
    sign_get_request: true
  }
  const idp = new saml2.IdentityProvider(idpOptions)

  app.get("/metadata.xml", function(req, res) {
    console.log(spOptions)
    res.type('application/xml').send(sp.create_metadata()).end()
  })

  app.get("/login", function(req, res) {
    const returnUrl = req.query['return-url']
    res.cookie('return-url', returnUrl, {httpOnly: true, secure: true})
    sp.create_login_request_url(idp, {}, (err, loginUrl, requestId) => {
      if (err) return console.error(err)
      res.redirect(loginUrl)
    })
  })

  app.post("/assert", bodyParser.urlencoded({extended: true}), function(req, res) {
    const options = {request_body: req.body}
    sp.post_assert(idp, options, function(err, samlResponse) {
      if (err != null) {
        console.error(err)
        return res.status(500)
      }
      const cookies = decodeUriEncoded(req.get('cookie'))
      const privateKey = configData.prodKeyPrivate
      const payload = {eraCommonsUsername: samlResponse.user.name_id}
      const token = jwt.sign(payload, privateKey, {algorithm: 'RS256'})
      const returnUrl = cookies['return-url'].replace('<token>', token)
      console.log(JSON.stringify({redirectUrl: cookies['return-url'], samlResponse: samlResponse}, null, 2))
      res.redirect(returnUrl)
    })
  })

  return app
}

module.exports = createApp()
