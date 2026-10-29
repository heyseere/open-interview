import { describe, expect, it } from 'vitest'
import {
  parsePersistedPort,
  parsePortRecord,
  parseSingletonLockPid,
  parseWindowsListenerPid
} from './exam-chrome-identity'

describe('parsePortRecord', () => {
  it('reads the first line and trims whitespace', () => {
    expect(parsePortRecord('9222\n9333')).toBe(9222)
    expect(parsePortRecord('  9223  \n')).toBe(9223)
  })

  it('rejects garbage, out-of-range and empty values', () => {
    expect(parsePortRecord('not-a-port')).toBeNull()
    expect(parsePortRecord('')).toBeNull()
    expect(parsePortRecord('0')).toBeNull()
    expect(parsePortRecord('65536')).toBeNull()
    expect(parsePortRecord('9222.5')).toBeNull()
  })
})

describe('parsePersistedPort', () => {
  it('reads the port field of the JSON state file', () => {
    expect(parsePersistedPort('{"port":9333}')).toBe(9333)
  })

  it('rejects invalid JSON, missing fields and out-of-range ports', () => {
    expect(parsePersistedPort('not json')).toBeNull()
    expect(parsePersistedPort('{"other":1}')).toBeNull()
    expect(parsePersistedPort('{"port":"9333"}')).toBeNull()
    expect(parsePersistedPort('{"port":0}')).toBeNull()
    expect(parsePersistedPort('{"port":70000}')).toBeNull()
  })
})

describe('parseSingletonLockPid', () => {
  it('reads the pid from the last dash-separated segment', () => {
    expect(parseSingletonLockPid('my-macbook-1234')).toBe(1234)
    expect(parseSingletonLockPid('host-1')).toBe(1)
  })

  it('rejects missing, zero and non-numeric pids', () => {
    expect(parseSingletonLockPid('host-')).toBeNull()
    expect(parseSingletonLockPid('host-0')).toBeNull()
    expect(parseSingletonLockPid('host-abc')).toBeNull()
    expect(parseSingletonLockPid('no-dashes')).toBeNull()
  })
})

describe('parseWindowsListenerPid', () => {
  const line = '  TCP    127.0.0.1:9222     0.0.0.0:0    LISTENING    1234  '

  it('extracts the pid of a LISTENING entry on the requested port', () => {
    expect(parseWindowsListenerPid(line, 9222)).toBe(1234)
  })

  it('ignores other states, other ports and malformed lines', () => {
    expect(parseWindowsListenerPid(line, 9333)).toBeNull()
    expect(
      parseWindowsListenerPid('  TCP    127.0.0.1:9222     1.2.3.4:55    ESTABLISHED    1234', 9222)
    ).toBeNull()
    expect(parseWindowsListenerPid('TCP 127.0.0.1:9222 LISTENING 1234', 9222)).toBeNull()
    expect(parseWindowsListenerPid(line.replace('1234', 'abcd'), 9222)).toBeNull()
  })
})
