const _ = require('lodash/fp')
const u = require('utils')

const configPath = 'gs://broad-shibboleth-prod.appspot.com/configs/config.20251028a.json'

async function fetchConfigData(authorization) {
  // console.log('fetchConfigData')
  const configUrl = new URL(configPath)
  const config = JSON.parse(await u.getObjectData(authorization, configPath))
  const configKeys = [
    'idp-cert-path', 'sp-cert-path', 'sp-key-path',
    'dev-signing-public-key-path', 'dev-signing-private-key-path',
    'prod-signing-public-key-path', 'prod-signing-private-key-path',
  ]
  const promises = _.map((k) => u.getObjectData(authorization, config[k]))(configKeys)
  const resolved = await Promise.all(promises)
  // console.log('fetchConfigData.resolved', resolved.length)
  const cd = {}
  cd.idpCert = resolved[0]
  cd.spCert = resolved[1]
  cd.spKey = resolved[2]
  cd.devKeyPublic = resolved[3]
  cd.devKeyPrivate = resolved[4]
  cd.prodKeyPublic = resolved[5]
  cd.prodKeyPrivate = resolved[6]
  // Wish I could do this instead:
  // [cd.idpCert, cd.spCert, cd.spKey,
  //   cd.devKeyPublic, cd.devKeyPrivate,
  //   cd.prodKeyPublic, cd.prodKeyPrivate] = resolved
  config.data = cd
  return config
}

async function maybeFetchConfigData(getBearerToken) {
  if (global.config) return global.config;
  const token = await getBearerToken()
  // console.log('maybeFetchConfigData.token', token)
  global.config = await fetchConfigData(`Bearer ${token}`)
  return global.config
}

module.exports = {fetchConfigData, maybeFetchConfigData}
