#!/usr/bin/env node
/**
 * Scriptable screenshots for the README, without Playwright or Puppeteer.
 *
 * Speaks the Chrome DevTools Protocol directly over Node's built-in
 * `WebSocket` (Node >= 22), so the only requirement is a Chrome/Chromium
 * binary. Two ways to use it:
 *
 *   # 1. Point it at a browser you already run
 *   node scripts/shots.mjs --port 9222 shot out.png --selector '.attention-meta'
 *   node scripts/shots.mjs --port 9222 eval 'document.title'
 *   node scripts/shots.mjs --port 9222 click 140 406
 *
 *   # 2. Let it boot an isolated DSH (temp DSH_HOME, link install) and Chrome
 *   node scripts/shots.mjs launch --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 *   # prints the GUI URL and the CDP port, then waits until Ctrl-C / SIGTERM
 *
 * In `launch` mode nothing touches your real profile: `DSH_HOME` and the
 * Chrome user-data dir are created with `mkdtemp` and removed on exit
 * (unless --keep).
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

// ---------------------------------------------------------------------------
// CDP client
// ---------------------------------------------------------------------------

async function findTarget(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`)
  if (!res.ok) throw new Error(`CDP endpoint returned ${res.status}`)
  const targets = await res.json()
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
  if (!page) throw new Error('no page target; is the browser on a tab?')
  return page.webSocketDebuggerUrl
}

export async function connect(port) {
  const ws = new WebSocket(await findTarget(port))
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true })
  })

  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    const handler = pending.get(msg.id)
    if (!handler) return
    pending.delete(msg.id)
    if (msg.error) handler.reject(new Error(`${msg.error.message} (${msg.error.code})`))
    else handler.resolve(msg.result)
  })

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }

  const mouse = async (type, x, y) => {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
  }

  return {
    send,
    evaluate,
    close: () => ws.close(),
    /** Real pointer click at CSS coordinates (hover first: menus open on hover). */
    async click(x, y) {
      await mouse('mouseMoved', x, y)
      await mouse('mousePressed', x, y)
      await mouse('mouseReleased', x, y)
    },
    async screenshot(file, { selector, clip, full, dpr } = {}) {
      if (dpr) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: 1200, height: 900, deviceScaleFactor: dpr, mobile: false,
        })
      }
      let rect = clip
      if (selector) {
        rect = await evaluate(`(() => {
          const el = document.querySelector(${JSON.stringify(selector)})
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }
        })()`)
        if (!rect) throw new Error(`selector not found: ${selector}`)
      }
      if (full) {
        const { contentSize } = await send('Page.getLayoutMetrics')
        rect = { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 }
      }
      const params = { format: 'png' }
      if (rect) params.clip = { ...rect, scale: rect.scale ?? 1 }
      else if (full) params.captureBeyondViewport = true
      const { data } = await send('Page.captureScreenshot', params)
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
      fs.writeFileSync(file, Buffer.from(data, 'base64'))
      return file
    },
  }
}

// ---------------------------------------------------------------------------
// Isolated instance
// ---------------------------------------------------------------------------

function pickChrome(explicit) {
  if (explicit) return explicit
  const found = DEFAULT_CHROME.find(p => fs.existsSync(p))
  if (found) return found
  throw new Error('no Chrome binary found; pass --chrome <path>')
}

function repoRoot() {
  return path.resolve(import.meta.dirname, '..')
}

/** Run one command to completion, returning its combined output. */
function runCommand(cmd, args, { cwd, env, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch {}
      reject(new Error(`timed out: ${cmd} ${args.join(' ')}\n${out}`))
    }, timeoutMs)
    child.stdout.on('data', (c) => { out += c.toString() })
    child.stderr.on('data', (c) => { out += c.toString() })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve({ output: out })
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}\n${out}`))
    })
  })
}

/** Run one command, resolving with its output once `ready` matches. */
function runUntilReady(cmd, args, { cwd, env, ready, timeoutMs = 90_000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    const timer = setTimeout(() => reject(new Error(`timed out waiting for readiness\n${out}`)), timeoutMs)
    const onData = (chunk) => {
      out += chunk.toString()
      const match = ready?.(out)
      if (match) {
        clearTimeout(timer)
        resolve({ child, output: out, match })
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`exited with ${code}\n${out}`))
    })
  })
}

async function launch({ chromePath, dshPort = '0', cdpPort = 9333, keep = false, timeoutMs = 120_000 }) {
  const chrome = pickChrome(chromePath)
  const root = repoRoot()
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'attention-shots-home-'))
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'attention-shots-chrome-'))
  const children = []
  const cleanup = () => {
    for (const child of children) {
      try { child.kill('SIGTERM') } catch {}
    }
    if (!keep) {
      fs.rmSync(tempHome, { recursive: true, force: true })
      fs.rmSync(userData, { recursive: true, force: true })
    }
  }
  process.on('SIGINT', () => { cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })

  const env = { ...process.env, DSH_HOME: tempHome }

  console.log(`[shots] installing link:${root} into ${tempHome}`)
  const install = await runCommand(
    'dsh',
    ['plugin', '--profile', 'web', 'add', `link:${root}`],
    { env, timeoutMs },
  )
  if (install.output.trim()) console.log(install.output.trim())

  console.log('[shots] starting dsh web')
  const { child: server, match } = await runUntilReady(
    'dsh',
    ['--profile', 'web', '--port', dshPort, '--no-open'],
    { env, timeoutMs, ready: (out) => out.match(/https?:\/\/127\.0\.0\.1:\d+\/[^\s"'<>]+/) },
  )
  children.push(server)
  const url = match[0]
  console.log(`[shots] GUI ${url}`)

  console.log('[shots] starting chrome')
  const browser = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userData}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1600,1000',
    'about:blank',
  ], { stdio: 'ignore' })
  children.push(browser)

  // Wait for the CDP endpoint, then open the GUI URL in that tab.
  for (let i = 0; i < 100; i += 1) {
    try {
      await findTarget(String(cdpPort))
      break
    } catch {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  const cdp = await connect(String(cdpPort))
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url })
  await cdp.evaluate(`new Promise(r => (document.readyState === 'complete' ? r(1) : setTimeout(r, 1500)))`)

  console.log(`\n[shots] ready`)
  console.log(`  GUI : ${url}`)
  console.log(`  CDP : ${cdpPort}`)
  console.log(`  DSH_HOME : ${tempHome}`)
  console.log(`\n  node scripts/shots.mjs --port ${cdpPort} shot docs/images/out.png --selector '.attention-meta'\n`)
  console.log('[shots] Ctrl-C to stop and clean up')
  await new Promise(() => {})
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next
        i += 1
      } else {
        args[key] = true
      }
    } else {
      args._.push(token)
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const [command, ...rest] = args._

if (command === 'launch') {
  await launch({
    chromePath: typeof args.chrome === 'string' ? args.chrome : undefined,
    dshPort: typeof args['dsh-port'] === 'string' ? args['dsh-port'] : '0',
    cdpPort: typeof args['cdp-port'] === 'string' ? args['cdp-port'] : '9333',
    keep: args.keep === true,
  })
} else if (command === 'eval' || command === 'click' || command === 'shot') {
  const cdp = await connect(args.port ?? 9222)
  try {
    if (command === 'eval') {
      console.log(await cdp.evaluate(rest.join(' ')))
    } else if (command === 'click') {
      await cdp.click(Number(rest[0]), Number(rest[1]))
      console.log('clicked')
    } else {
      const out = rest[0] ?? 'shot.png'
      const file = await cdp.screenshot(out, {
        selector: typeof args.selector === 'string' ? args.selector : undefined,
        full: args.full === true,
        dpr: args.dpr ? Number(args.dpr) : undefined,
      })
      console.log(`wrote ${file}`)
    }
  } finally {
    cdp.close()
  }
} else {
  console.log(`Usage:
  node scripts/shots.mjs launch [--chrome <path>] [--cdp-port 9333] [--dsh-port 0] [--keep]
  node scripts/shots.mjs --port 9333 eval '<js expression>'
  node scripts/shots.mjs --port 9333 click <x> <y>
  node scripts/shots.mjs --port 9333 shot <out.png> [--selector <css>] [--full] [--dpr 2]`)
  process.exit(command === undefined ? 0 : 1)
}
