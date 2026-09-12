const WAV_HEADER_BYTES = 44

/** Wrap 16-bit, mono PCM in a standard little-endian WAV container. */
export function pcm16MonoToWav(pcm: Uint8Array, sampleRate = 16000): Buffer {
  const payload = Buffer.from(pcm)
  const wav = Buffer.alloc(WAV_HEADER_BYTES + payload.length)

  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + payload.length, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(payload.length, 40)
  payload.copy(wav, WAV_HEADER_BYTES)

  return wav
}
