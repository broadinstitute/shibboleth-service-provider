const cp = require('child_process')
const _ = require('lodash/fp')
const http = require('http')
const https = require('https')

function formatJson(x) {
  return JSON.stringify(x, null, 2)
}

function formatRes(res) {
  const statusCode = res.statusCode
  const headers = res.headers
  if (res.bodyJson) {
    return JSON.stringify({statusCode, headers, body: res.bodyJson}, null, 2) + '\n'
  } else if (res.body) {
    return `status: ${statusCode}\nheaders: ${JSON.stringify(headers, null, 2)}\nbody:\n${res.body}\n`
  } else {
    return `status: ${statusCode}\nheaders: ${JSON.stringify(headers, null, 2)}\n`
  }
}

function httpreq(options) {
  // console.log('httpreq:', options)
  const txn = {}
  let savedResolve, savedReject
  txn.resp = new Promise((resolve, reject) => {
    savedResolve = resolve
    savedReject = reject
  })
  txn.req = (options.tls === false ? http : https).request(options, (res) => {
    txn.res = res
    savedResolve(res)
  })
  txn.req.on('error', (e) => { savedReject(e) })
  const method = _.getOr('get', 'method', options).toLowerCase()
  if (method === 'get') { txn.req.end() }
  return txn
}

function requestp(http, options) {
  return new Promise((resolve, reject) => {
    http.request(_.omit(['consumeBody', 'parseJson'], options), async (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        res.isSuccess = true
      } else {
        res.isSuccess = false
      }
      if (options.consumeBody) {
        res.body = await consumeStreamp(res)
        if (options.parseJson) {
          try {
            res.bodyJson = JSON.parse(res.body.toString())
          } catch (err) {}
        }
      }
      resolve(res)
    }).end()
  })
}

async function requestOkp(http, options) {
  const res = await requestp(http, options)
  if (res.statusCode < 200 || res.statusCode > 299) {
    const err = new Error(`request failed with status ${res.statusCode}`)
    const resBody = (await consumeStreamp(res)).toString()
    try {
      err.details = JSON.parse(resBody)
    } catch (parseError) {
      err.details = resBody
    }
    throw err
  }
  return res
}

function slurpStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (chunk) => { chunks.push(chunk) })
    stream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
  })
}

const consumeStreamp = slurpStream

function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

function ucFirst(s) { return s[0].toUpperCase() + s.slice(1) }

function bufferListToLines(bufferList) {
  const lines = bufferList.map(x => x.toString()).join('').split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    return lines.slice(0, -1)
  } else {
    return lines
  }
}

function spawnp(cmd, args, opts = {}) {
  const spawnOpts = _.omit(
    'stdout stderr pipeStdoutTo pipeStderrTo ignoreNonZero stderrOnError'.split(/\s+/)
  )(opts)
  opts.stderrOnError = opts.stderrOnError === undefined ? true : opts.stderrOnError
  const p = cp.spawn(cmd, args, spawnOpts)
  const promise = new Promise((resolve) => {
    const out = {
      stdout: opts.stdout ? [] : undefined,
      stderr: (opts.stderr || opts.stderrOnError) ? [] : undefined
    }
    p.on('close', (code) => {
      for (let k in out) {
        if (opts[k]) { out[k] = bufferListToLines(out[k]) }
      }
      if (code !== 0 && !opts.ignoreNonZero) {
        const message = `non-zero error code running command: ${cmd} ${args.join(' ')}`
        const stderr = opts.stderrOnError ? '\n'+out.stderr : ''
        throw new Error(message+stderr)
      }
      resolve({code, ...out})
    })
    for (let k in out) {
      const pipeOpt = 'pipe'+ucFirst(k)+'To'
      if (out[k] || opts[pipeOpt]) {
        p[k].on('data', (data) => {
          if (out[k]) { out[k].push(data) }
          if (opts[pipeOpt]) { opts[pipeOpt].stdin.write(data) }
        })
        if (opts[pipeOpt]) {
          p.on('close', (code) => {
            opts[pipeOpt].stdin.end()
          })
        }
      }
    }
  })
  return {p, promise}
}

async function getObjectData(authorization, gsUrlString) {
  // console.log('getObjectData', gsUrlString)
  const url = new URL(gsUrlString)
  const bucketEncoded = encodeURIComponent(url.hostname)
  const objectPathEncoded = encodeURIComponent(url.pathname.slice(1))
  const res = await httpreq({
    hostname: 'www.googleapis.com',
    path: '/download/storage/v1/b/'+bucketEncoded+'/o/'+objectPathEncoded+'?alt=media',
    headers: {authorization}
  }).resp
  // console.log('getObjectData.res.statusCode', res.statusCode)
  if (res.statusCode !== 200) {
    const err = new Error(`object fetch failed with status ${res.statusCode}`)
    err.res = res
    throw err
  } else {
    return (await slurpStream(res)).toString()
  }
}

module.exports = {
  formatJson, formatRes, httpreq, requestp, requestOkp, consumeStreamp, slurpStream, wait, ucFirst,
  spawnp, getObjectData
}
