const u = require('utils')

async function getBearerTokenFromMetadata() {
  try {
    const res = await u.httpreq({
      tls: false,
      hostname: 'metadata',
      path: '/computeMetadata/v1/instance/service-accounts/default/token',
      headers: {'Metadata-Flavor': 'Google'}
    }).resp
    if (res.statusCode !== 200) {
      throw new Error(`metadata request failed with code ${res.statusCode}`)
    }
    return (JSON.parse(await u.slurpStream(res))).access_token
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      // DNS lookup failure. Metadata server does not exist.
      return undefined
    } else {
      throw e
    }
  }
}

async function getBearerTokenFromGcloudAuth() {
  const patCommand = 'gcloud auth print-access-token'.split(/\s+/)
  console.log('+ '+patCommand.join(' '))
  const pat = await u.spawnp(patCommand[0], patCommand.slice(1), {stdout: true}).promise
  if (pat.code === 0) {
    return pat.stdout.join('').trim()
  } else {
    throw new Error(`command failed with code ${code}:\n${pat.stderr}`)
  }
}

module.exports = {getBearerTokenFromMetadata, getBearerTokenFromGcloudAuth}
