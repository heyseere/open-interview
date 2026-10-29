import { app, desktopCapturer, nativeImage, screen } from 'electron'
import type { NativeImage } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  JPEG_QUALITY_LADDER,
  SCREENSHOT_BUDGET,
  fitDimensions,
  shrinkFactorForBytes,
  type ImageBudget,
  type Size
} from './image-budget'
import { settings } from './settings'
import { tMain } from './i18n'
import { emitToRenderer, toErrorMessage } from './renderer-send'

/**
 * Screenshot capture, budget-encoded delivery and (opt-in) persistence.
 *
 * Captures are downscaled and re-encoded as JPEG before being sent to the AI
 * provider or rendered in the gallery. A raw full-screen PNG can easily reach
 * several MB of base64; the encoder shrinks each capture until it fits an
 * explicit budget (long edge + total pixels + encoded bytes), so a 5K display
 * cannot produce a surprise multi-megabyte upload. Disk persistence is a
 * separate opt-in step that privacy mode disables unconditionally.
 */

export { FULL_PAGE_BUDGET } from './image-budget'

/**
 * Encode an already-decoded image within `budget`. Quality steps come first
 * (cheap, no visible layout change); if even the lowest quality overshoots,
 * the image is scaled down by the measured factor and re-encoded once — at
 * that point the payload is at most ~1/4 of the overage.
 */
export function encodeImageWithinBudget(image: NativeImage, budget: ImageBudget): string {
  const fitted = fitDimensions(image.getSize(), budget)
  const sized =
    fitted.width === image.getSize().width && fitted.height === image.getSize().height
      ? image
      : image.resize({ width: fitted.width, height: fitted.height })

  for (const quality of JPEG_QUALITY_LADDER) {
    const encoded = sized.toJPEG(quality)
    if (encoded.length <= budget.maxBase64Bytes) return encoded.toString('base64')
  }

  // Still too big at the lowest quality: scale by the measured overshoot
  const lowest = sized.toJPEG(JPEG_QUALITY_LADDER[JPEG_QUALITY_LADDER.length - 1])
  const factor = shrinkFactorForBytes(lowest.length, budget.maxBase64Bytes)
  const shrunk = resizeByFactor(sized, factor)
  return shrunk.toJPEG(JPEG_QUALITY_LADDER[JPEG_QUALITY_LADDER.length - 1]).toString('base64')
}

function resizeByFactor(image: NativeImage, factor: number): NativeImage {
  const { width, height } = image.getSize()
  const target: Size = {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor))
  }
  return image.resize({ width: target.width, height: target.height })
}

function compressToBase64(png: Buffer, budget: ImageBudget): string | null {
  try {
    const image = nativeImage.createFromBuffer(png)
    if (image.isEmpty()) return null
    return encodeImageWithinBudget(image, budget)
  } catch (error) {
    console.warn('Failed to compress screenshot, falling back to raw PNG:', error)
    return null
  }
}

export function takeScreenshot(): Promise<string | void> {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve()

  // Get the primary display's size, capped to the compression target so
  // desktopCapturer scales internally — this avoids encoding a huge full-res
  // PNG only to downscale it right afterwards.
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const target = fitDimensions({ width, height }, SCREENSHOT_BUDGET)
  const scale = width > 0 ? target.width / width : 1

  return desktopCapturer
    .getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) }
    })
    .then((sources) => {
      // desktopCapturer's source order is not guaranteed to start with the
      // primary display — pick the source matching it, falling back to the
      // first source
      const primary =
        sources.find((source) => source.display_id === String(primaryDisplay.id)) ?? sources[0]
      const thumbnail = primary?.thumbnail
      if (!thumbnail || thumbnail.isEmpty()) return undefined

      const compressed = compressToBase64(thumbnail.toPNG(), SCREENSHOT_BUDGET)
      if (compressed) return compressed

      // Extremely defensive fallback: still deliver something usable
      return thumbnail.toPNG().toString('base64')
    })
    .catch((error) => {
      console.error('Error taking screenshot:', error)
    })
}

// --- Opt-in persistence -----------------------------------------------------

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
    // Auto-save is opt-in and the answer flow must never break on it, but a
    // silent failure hides "my screenshots are not where I expect them" —
    // surface it as a toast while the capture itself keeps working.
    console.error('Failed to save screenshot:', error)
    emitToRenderer(
      'ui-notify',
      tMain('err.screenshotSaveFailed', { message: toErrorMessage(error, tMain('err.unknown')) })
    )
  }
}
