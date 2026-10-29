/**
 * Pure parsing helpers for exam-Chrome identity (no Electron, no fs, no exec)
 * — extracted from chrome-fullpage.ts so the identity rules stay
 * unit-testable (the permissions-policy.ts idiom). The behavioral decision
 * itself (`matchesExamChromeCommand`) lives in chrome-cdp.ts.
 */

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * First line of a DevToolsActivePort-style file → port. Current Chrome no
 * longer writes that file into a custom user-data-dir, so this is only a
 * legacy fallback — but it must still be validated before use.
 */
export function parsePortRecord(raw: string): number | null {
  const port = Number(raw.split('\n')[0].trim())
  return isValidPort(port) ? port : null
}

/** chrome-fullpage.json (JSON `{ port }`) → port, or null on any malformation. */
export function parsePersistedPort(raw: string): number | null {
  try {
    const port = (JSON.parse(raw) as { port?: unknown }).port
    return typeof port === 'number' && isValidPort(port) ? port : null
  } catch {
    return null
  }
}

/**
 * The pid of the process owning our profile, from the macOS/Linux
 * SingletonLock symlink target `<hostname>-<pid>`. The hostname may contain
 * dashes — only the LAST segment is the pid.
 */
export function parseSingletonLockPid(target: string): number | null {
  const pid = Number(target.split('-').pop())
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

/**
 * One `netstat -ano -p tcp` line → the listener pid when the line is a
 * LISTENING entry on `port`, else null.
 *
 * TCP  127.0.0.1:9222  0.0.0.0:0  LISTENING  1234
 */
export function parseWindowsListenerPid(line: string, port: number): number | null {
  const parts = line.trim().split(/\s+/)
  if (parts.length === 5 && parts[3] === 'LISTENING' && parts[1].endsWith(`:${port}`)) {
    const pid = Number(parts[4])
    return Number.isInteger(pid) && pid > 0 ? pid : null
  }
  return null
}
