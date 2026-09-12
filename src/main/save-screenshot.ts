import { app } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { settings } from './settings'

function getSaveDir(): string {
  return settings.screenshotDir || join(app.getPath('pictures'), 'InterviewCoder')
}

function generateFilename(buffer: Buffer): string {
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  // Screenshots are usually compressed JPEG; fall back to PNG when raw
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  return `${date}_${time}.${isJpeg ? 'jpg' : 'png'}`
}

export async function saveScreenshotToDisk(base64Data: string): Promise<void> {
  // Privacy mode is a hard guarantee: never write screenshots to disk
  if (settings.privacyMode) return
  if (!settings.screenshotAutoSave) return

  const dir = getSaveDir()
  try {
    await mkdir(dir, { recursive: true })
    const buffer = Buffer.from(base64Data, 'base64')
    const filePath = join(dir, generateFilename(buffer))
    await writeFile(filePath, buffer)
  } catch (error) {
    console.error('Failed to save screenshot:', error)
  }
}
