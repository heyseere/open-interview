import { desktopCapturer, nativeImage, screen } from 'electron'

/**
 * Screenshots are downscaled and re-encoded as JPEG before being sent to the
 * AI provider or rendered in the gallery. A raw full-screen PNG can easily
 * reach several MB of base64; a 1600px JPEG typically stays well under 300KB,
 * which noticeably reduces upload latency and token cost.
 */
const MAX_IMAGE_WIDTH = 1600
const JPEG_QUALITY = 82

function compressToBase64(png: Buffer): string | null {
  try {
    const image = nativeImage.createFromBuffer(png)
    if (image.isEmpty()) return null
    const { width } = image.getSize()
    const resized = width > MAX_IMAGE_WIDTH ? image.resize({ width: MAX_IMAGE_WIDTH }) : image
    return resized.toJPEG(JPEG_QUALITY).toString('base64')
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
  const scale = Math.min(1, MAX_IMAGE_WIDTH / width)

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

      const compressed = compressToBase64(thumbnail.toPNG())
      if (compressed) return compressed

      // Extremely defensive fallback: still deliver something usable
      return thumbnail.toPNG().toString('base64')
    })
    .catch((error) => {
      console.error('Error taking screenshot:', error)
    })
}
