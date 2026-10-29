import { describe, expect, it } from 'vitest'
import {
  matchesExamChromeCommand,
  parseTargets,
  pickActiveTarget,
  type TabFocus
} from './chrome-cdp'

const page = (overrides: Record<string, unknown>) => ({
  id: 't1',
  type: 'page',
  url: 'https://exam.example/question/1',
  title: 'Question 1',
  webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/t1',
  ...overrides
})

describe('parseTargets', () => {
  it('keeps page-type targets in order', () => {
    const body = [
      page({ id: 'a' }),
      { id: 'svc', type: 'service_worker', url: 'https://x/sw.js' },
      page({ id: 'b', url: 'chrome://newtab/' })
    ]
    const targets = parseTargets(body)
    expect(targets.map((t) => t.id)).toEqual(['a', 'b'])
    expect(targets[0].webSocketDebuggerUrl).toBe('ws://127.0.0.1:9222/devtools/page/t1')
  })

  it('drops devtools mirrors and entries without a debugger url', () => {
    const body = [
      page({ id: 'mirror', url: 'devtools://devtools/bundled/inspector.html' }),
      page({ id: 'nodesc', webSocketDebuggerUrl: undefined }),
      page({ id: 'real' })
    ]
    expect(parseTargets(body).map((t) => t.id)).toEqual(['real'])
  })

  it('tolerates malformed bodies', () => {
    expect(parseTargets(null)).toEqual([])
    expect(parseTargets('nope')).toEqual([])
    expect(parseTargets([1, 'x', null])).toEqual([])
  })
})

describe('matchesExamChromeCommand', () => {
  const profile = '/Users/user/Library/Application Support/open-interview/chrome-profile'

  it('matches only when BOTH the port and our profile dir are on the command line', () => {
    const command = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9223 --user-data-dir=${profile} --no-first-run`
    expect(matchesExamChromeCommand(command, 9223, profile)).toBe(true)
  })

  it('rejects a foreign browser that only listens on the same port', () => {
    const command = 'chrome --remote-debugging-port=9222 --user-data-dir=/tmp/other-profile'
    expect(matchesExamChromeCommand(command, 9222, profile)).toBe(false)
  })

  it('rejects our profile dir with a different debug port', () => {
    const command = `chrome --remote-debugging-port=9229 --user-data-dir=${profile}`
    expect(matchesExamChromeCommand(command, 9223, profile)).toBe(false)
  })

  it('tolerates spaces inside the profile path', () => {
    const command = `chrome --user-data-dir=${profile} --remote-debugging-port=9223`
    expect(matchesExamChromeCommand(command, 9223, profile)).toBe(true)
  })

  it('rejects empty or unrelated command lines', () => {
    expect(matchesExamChromeCommand('', 9223, profile)).toBe(false)
    expect(matchesExamChromeCommand('chrome --headless', 9223, profile)).toBe(false)
  })
})

describe('pickActiveTarget', () => {
  const targets = (ids: string[]) =>
    ids.map((id) => ({
      id,
      type: 'page',
      url: `https://x/${id}`,
      title: id,
      webSocketDebuggerUrl: `ws://page/${id}`
    }))

  it('prefers the focused+visible tab over list order', async () => {
    const focus: Record<string, TabFocus> = {
      a: { visible: true, focused: false },
      b: { visible: true, focused: true }
    }
    const picked = await pickActiveTarget(
      targets(['a', 'b']),
      async (url) => focus[url.slice(-1)] ?? null
    )
    expect(picked?.id).toBe('b')
  })

  it('falls back to the first visible tab when nothing is focused', async () => {
    const focus: Record<string, TabFocus> = {
      a: { visible: false, focused: false },
      b: { visible: true, focused: false }
    }
    const picked = await pickActiveTarget(
      targets(['a', 'b']),
      async (url) => focus[url.slice(-1)] ?? null
    )
    expect(picked?.id).toBe('b')
  })

  it('keeps list order when no candidate reports focus', async () => {
    const picked = await pickActiveTarget(targets(['a', 'b', 'c']), async () => null)
    expect(picked?.id).toBe('a')
  })

  it('survives probing errors', async () => {
    const picked = await pickActiveTarget(targets(['a', 'b']), async (url) => {
      if (url.endsWith('a')) throw new Error('boom')
      return { visible: true, focused: true }
    })
    expect(picked?.id).toBe('b')
  })

  it('only probes the first probeLimit candidates', async () => {
    const probed: string[] = []
    const picked = await pickActiveTarget(
      targets(['a', 'b', 'c']),
      async (url) => {
        probed.push(url.slice(-1))
        return null
      },
      2
    )
    expect(probed).toEqual(['a', 'b'])
    expect(picked?.id).toBe('a')
  })

  it('returns null for an empty target list', async () => {
    expect(await pickActiveTarget([], async () => null)).toBeNull()
  })
})
