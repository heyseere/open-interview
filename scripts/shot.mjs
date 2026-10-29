// CDP screenshot helper for the packaged Open Interview app (AGENTS.md's
// real-machine verification channel). Launch the app with
//   --remote-debugging-port=9333
// then drive it from here:
//   node scripts/shot.mjs out.png                      # shot current page
//   node scripts/shot.mjs out.png --eval "<js>"        # evaluate JS, then shot
//   node scripts/shot.mjs --eval "<js>"                # evaluate only
//   node scripts/shot.mjs --reload                     # CDP-level page reload
//                                                       (page JS reload is
//                                                       blocked by will-navigate)
//   node scripts/shot.mjs out.png --key Escape         # dispatch a real key
// Each phase gets its OWN CDP connection: Page.reload destroys the session,
// and a capture sent over the dying socket would hang forever.
const args = process.argv.slice(2)
const evalIdx = args.indexOf('--eval')
const js = evalIdx >= 0 ? args[evalIdx + 1] : null
const keyIdx = args.indexOf('--key')
const keyName = keyIdx >= 0 ? args[keyIdx + 1] : null
const wantsReload = args.includes('--reload')
const rest = args.filter((a, i) => {
  if (evalIdx >= 0 && (i === evalIdx || i === evalIdx + 1)) return false
  if (keyIdx >= 0 && (i === keyIdx || i === keyIdx + 1)) return false
  return a !== '--reload'
})
const out = rest[0]

const KEY_CODES = {
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
}

function connect() {
  return new Promise((resolve, reject) => {
    ;(async () => {
      const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json()
      const page = targets.find((t) => t.type === 'page')
      if (!page) return reject(new Error('no page target'))
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      ws.onopen = () => resolve(ws)
      ws.onerror = reject
    })().catch(reject)
  })
}

function session(ws) {
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
  return (method, params = {}, timeoutMs = 8000) =>
    new Promise((res, rej) => {
      const i = ++id
      const timer = setTimeout(() => {
        pending.delete(i)
        rej(new Error(`CDP timeout: ${method}`))
      }, timeoutMs)
      pending.set(i, (msg) => {
        clearTimeout(timer)
        res(msg)
      })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
}

async function withConnection(run) {
  const ws = await connect()
  try {
    return await run(session(ws))
  } finally {
    ws.close()
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (wantsReload) {
  await withConnection(async (send) => {
    await send('Page.enable')
    await send('Page.reload')
    await sleep(2500)
  })
}

if (keyName) {
  const kc = KEY_CODES[keyName]
  if (!kc) {
    console.error('unknown key', keyName)
    process.exit(1)
  }
  await withConnection(async (send) => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...kc })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...kc })
  })
  await sleep(500)
}

if (js) {
  const r = await withConnection((send) =>
    send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }, 15000)
  )
  if (r.result?.exceptionDetails) {
    console.error('EVAL ERROR', JSON.stringify(r.result.exceptionDetails, null, 1))
    process.exit(1)
  }
  console.log('eval:', JSON.stringify(r.result?.result?.value ?? null))
}

if (out) {
  await sleep(400)
  const shot = await withConnection(async (send) => {
    await send('Page.enable')
    return send('Page.captureScreenshot', { format: 'png' })
  })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log('saved', out)
}
process.exit(0)
