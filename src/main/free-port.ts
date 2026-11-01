import { createServer } from 'node:net'

/**
 * Loopback port allocation for the local child processes that expose an HTTP
 * API (the exam Chrome's CDP endpoint and the local ASR server).
 *
 * Binding is the only reliable free-port probe: the OS refuses a listener on a
 * port that is already taken, so a successful bind proves availability at that
 * instant. The window between closing and the child binding is unavoidable but
 * tiny, and both callers retry on failure.
 */

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

/** First free port in [start, end], or null when the range is exhausted. */
export async function pickFreePort(start: number, end: number): Promise<number | null> {
  for (let port = start; port <= end; port++) {
    if (await isPortFree(port)) return port
  }
  return null
}
