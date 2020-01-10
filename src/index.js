const cp = require('child_process')
const fs = require('fs').promises
const http = require('http')
const path = require('path')

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

async function main(opts) {
  const {
    liveReloadEnabled,
    writeablePath, port, mainPath,
    url,
    before = (req, res, next) => { next() },
    after = (req, res) => { res.send(`${(new Date()).toISOString()}: Code reloaded.\n`).end() },
    log = console.log
  } = opts

  let app = liveReloadEnabled ? undefined : require(mainPath)

  function resetApp() {
    app = require(mainPath)
    app.post(url, before, async (req, res, next) => {
      await spawnp('rm', ['-rf', writeablePath]).promise
      await spawnp('mkdir', ['-p', writeablePath]).promise
      const untar = spawnp('tar', ['-x'], {cwd: writeablePath})
      const pipe = req.pipe(untar.p.stdin)
      pipe.on('finish', async () => {
        log('reloading...')
        const resolvedWriteablePath = path.dirname(
          require.resolve(path.join(writeablePath, 'package.json')))
        Object.keys(require.cache).forEach((key) => {
          if (key.startsWith(resolvedWriteablePath)) {
            log(key)
            delete require.cache[key]
          }
        })
        resetApp()
        log('done.')
        after(req, res)
      })
    })
  }

  if (liveReloadEnabled) {
    copyFiles(writeablePath)
    resetApp()
    log('Live code reloading enabled.')
  }
  const server = http.createServer((req, res) => {
    app(req, res)
  })
  server.listen(port)
}

main({
  liveReloadEnabled: process.env.LIVE_CODE_RELOAD === 'true',
  writeablePath: '/tmp/aelivedev',
  port: process.env.PORT || 8080,
  mainPath: './main.js',
  url: '/.src',
  before: async (req, res, next) => {
    const key = (await fs.readFile('.authkey', {encoding: 'utf8'})).trim()
    authWithKey(key, req, res, next)
  }
}).catch((e) => { throw e })
