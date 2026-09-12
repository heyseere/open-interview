/**
 * Build a data-URL for screenshot payloads. The main process usually delivers
 * compressed JPEG, but may fall back to raw PNG — sniff the magic bytes so
 * both render correctly.
 */
export function screenshotDataUrl(base64: string): string {
  // JPEG starts with FF D8 FF (base64 prefix "/9j/")
  if (base64.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${base64}`
  }
  return `data:image/png;base64,${base64}`
}
