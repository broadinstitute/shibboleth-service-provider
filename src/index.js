const cp = require('child_process')
const fs = require('fs').promises
const http = require('http')
const path = require('path')

const nodeModulesPath = path.resolve('node_modules')

function ucFirst(s) { return s[0].toUpperCase() + s.slice(1) }

function bufferListToLines(buffers) {
  return buffers.map(x => x.toString()).join('').split('\n')
}

function omit(object, keys) {
  const newObject = {...object}
  for (let k in keys) {
    delete newObject[k]
  }
  return newObject
}

function spawnp(cmd, args, opts = {}) {
  const spawnOpts = omit(opts,
    'stdout stderr pipeStdoutTo pipeStderrTo ignoreNonZero stderrOnError'.split(/\s+/))
  opts.stderrOnError = opts.stderrOnError === undefined ? true : opts.stderrOnError
  const p = cp.spawn(cmd, args, spawnOpts)
  const promise = new Promise((resolve) => {
    const out = {
      stdout: opts.stdout ? [] : undefined,
      stderr: (opts.stderr || opts.stderrOnError) ? [] : undefined
    }
    p.on('close', (code) => {
      for (let k in out) {
        if (opts[k]) { out[k] = out[k].map(x => x.toString()).join('').split('\n') }
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

async function copyFiles(writeablePath) {
  await spawnp('mkdir', ['-p', writeablePath]).promise
  const untar = spawnp('tar', ['-x'], {cwd: writeablePath})
  const tar = spawnp('tar', ['-c', '--exclude=./node_modules/*', '.'], {pipeStdoutTo: untar.p})
  await Promise.all([tar.promise, untar.promise])
}

function authWithKey(key, req, res, next) {
  const sendAuthError = (obj) => {
    res.type('application/json').status(401).send(JSON.stringify(obj, null, 2)+'\n').end()
  }
  const authHeader = (req.headers['authorization'] || '').trim()
  if (authHeader.length === 0) {
    return sendAuthError({error: {message: 'missing Authorization header'}})
  }
  const [type, value] = authHeader.split(/\s+/)
  if (type.toLowerCase() === 'key') {
    if (value !== key) {
      return sendAuthError({error: {message: 'invalid auth key', type, value, header: authHeader}})
    } else {
      req.auth = {key: value}
      return next()
    }
  } else {
    return sendAuthError({error: {message: 'invalid auth type', type, value, header: authHeader}})
  }
}

async function overwriteFiles(log, writeablePath, req) {
  await spawnp('rm', ['-rf', writeablePath]).promise
  await spawnp('mkdir', ['-p', writeablePath]).promise
  const untar = spawnp('tar', ['-x'], {cwd: writeablePath})
  const pipe = req.pipe(untar.p.stdin)
  return new Promise((resolve) => {
    pipe.on('finish', resolve)
  })
}

function getFilteredRequireCache() {
  return Object.keys(require.cache).filter(x => !x.startsWith(nodeModulesPath))
}

function purgeCache(log, writeablePath) {
  log('purging require cache...')
  getFilteredRequireCache().forEach((key) => {
    log(key)
    delete require.cache[key]
  })
  log('done.')
}

function logRequireCache(log) {
  log('*** require.cache ***')
  getFilteredRequireCache().forEach((key) => {
    log(key)
  })
  log('*** end ***')
}

async function main(opts) {
  const {
    liveReloadEnabled,
    writeablePath, mainPath,
    url, port,
    before = (req, res, next) => { next() },
    after = (req, res) => { res.send(`${(new Date()).toISOString()}: Code reloaded.\n`).end() },
    log = console.log
  } = opts

  let app = undefined

  async function resetApp() {
    app = await require(mainPath)

    logRequireCache(log)

    app.post(url, before, async (req, res, next) => {
      if (!(req.locals && req.locals.isReloadOkay)) {
        return res.status(401)
          .send(JSON.stringify(
            {error: {message: 'req.locals.isReloadOkay is not defined or is false'}}, null, 2)+'\n')
          .end()
      }
      await overwriteFiles(log, writeablePath, req)
      purgeCache(log, writeablePath)
      await resetApp()
      log('reloaded.')
      next()
    })
    app.post(url, after)
    app.delete(url, async (req, res, next) => {
      await spawnp('rm', ['-rf', writeablePath]).promise
      log(`cleared ${writeablePath}.`)
      await copyFiles(writeablePath)
      purgeCache(log, writeablePath)
      await resetApp()
      res.send(`${(new Date()).toISOString()}: Code reset.\n`).end()
    })
  }

  // Start with a clean slate.
  await spawnp('rm', ['-rf', writeablePath]).promise

  if (liveReloadEnabled) {
    // There appears to be some internal state in Node's require that prefers to load files from
    // where they were found last time, so if we want to be able to load them from a writeable
    // directory, we need to place them there before the first call to `require`.
    await copyFiles(writeablePath)
    await resetApp()
    log('Live code reloading enabled.')
  } else {
    app = await require(mainPath)
    logRequireCache(log)
  }

  const server = http.createServer((req, res) => {
    app(req, res)
  })
  server.listen(port)
}

main({
  liveReloadEnabled: false,
  writeablePath: '/tmp/aelivedev',
  mainPath: 'main',
  url: '/.src',
  port: process.env.PORT || 8080,
}).catch((e) => { throw e })
