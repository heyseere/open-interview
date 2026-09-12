/**
 * Convert accumulated markdown solution chunks into plain text for the
 * compact teleprompter display. Code blocks are kept verbatim (they usually
 * contain the answer), while decorative syntax is stripped.
 */
export function markdownToPlainText(markdown: string): string {
  return (
    markdown
      // Fenced code blocks: keep the code, drop the fence markers and language
      .replace(/```[^\n]*\n?/g, '')
      // Inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Images before links
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links keep their label
      .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
      // Headings / blockquotes
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      // Bold / italic / strikethrough
      .replace(/(\*\*\*|\*\*|__)([^*_]+)\1/g, '$2')
      .replace(/(\*|_)([^*_]+)\1/g, '$2')
      .replace(/~~([^~]+)~~/g, '$1')
      // List markers (ordered & unordered)
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
      // Table decoration rows and pipes
      .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, '')
      .replace(/\|/g, ' ')
      // Horizontal rules
      .replace(/^\s*(-{3,}|={3,}|\*{3,})\s*$/gm, '')
      // Raw HTML tags
      .replace(/<[^>]+>/g, '')
      // Collapse whitespace runs (keep single newlines)
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
