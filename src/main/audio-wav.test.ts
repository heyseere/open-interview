import { describe, expect, it } from 'vitest'
import { pcm16MonoToWav } from './audio-wav'

function readU16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset)
}

function readU32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset)
}

describe('pcm16MonoToWav', () => {
  const pcm = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06])

  it('produces a buffer of exactly header + payload size', () => {
    const wav = pcm16MonoToWav(pcm)
    expect(wav).toBeInstanceOf(Buffer)
    expect(wav.length).toBe(44 + pcm.length)
  })

  it('writes RIFF and WAVE magic bytes', () => {
    const wav = pcm16MonoToWav(pcm)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
  })

  it('writes correct chunk sizes', () => {
    const wav = pcm16MonoToWav(pcm)
    // RIFF chunk size covers everything after the first 8 bytes
    expect(readU32LE(wav, 4)).toBe(36 + pcm.length)
    // fmt chunk is always 16 bytes for PCM
    expect(readU32LE(wav, 16)).toBe(16)
    // data chunk holds the raw PCM
    expect(wav.toString('ascii', 36, 40)).toBe('data')
    expect(readU32LE(wav, 40)).toBe(pcm.length)
  })

  it('describes mono 16-bit PCM in the fmt chunk', () => {
    const wav = pcm16MonoToWav(pcm)
    expect(readU16LE(wav, 20)).toBe(1) // audio format: PCM
    expect(readU16LE(wav, 22)).toBe(1) // channels: mono
    expect(readU16LE(wav, 32)).toBe(2) // block align: 2 bytes/frame
    expect(readU16LE(wav, 34)).toBe(16) // bits per sample
  })

  it('computes byte rate from the sample rate', () => {
    expect(readU32LE(pcm16MonoToWav(pcm), 24)).toBe(16000)
    expect(readU32LE(pcm16MonoToWav(pcm), 28)).toBe(32000)

    const wav48k = pcm16MonoToWav(pcm, 48000)
    expect(readU32LE(wav48k, 24)).toBe(48000)
    expect(readU32LE(wav48k, 28)).toBe(96000)
  })

  it('copies the PCM payload verbatim after the 44-byte header', () => {
    const wav = pcm16MonoToWav(pcm)
    expect(Buffer.from(wav.subarray(44))).toEqual(Buffer.from(pcm))
  })

  it('handles an empty payload', () => {
    const wav = pcm16MonoToWav(new Uint8Array())
    expect(wav.length).toBe(44)
    expect(readU32LE(wav, 40)).toBe(0)
    expect(readU32LE(wav, 4)).toBe(36)
  })
})
