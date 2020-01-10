const _ = require('lodash/fp')

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

function consumeStreamp(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (chunk) => { chunks.push(chunk) })
    stream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
  })
}

function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

module.exports = {formatJson, formatRes, requestp, requestOkp, consumeStreamp, wait}
