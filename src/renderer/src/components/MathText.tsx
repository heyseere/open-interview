import { memo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

/**
 * Render math inside a line of plain text (a user's typed question in the
 * history detail, for example).
 *
 * Deliberately NOT MarkdownRenderer: a question is user input, so a leading
 * `#`, `-` or `1.` must stay literal instead of turning into a heading, a list
 * or an ordered list. Only `$…$` / `$$…$$` are interpreted — everything else
 * is shown as typed (paragraphs keep their line breaks via pre-wrap).
 */
const REMARK_PLUGINS = [remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]
// `m-0` drops the paragraph margins the prose wrapper would otherwise supply;
// the surrounding layout already spaces the question from the answer.
const COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <p className="m-0">{children}</p>
}

function MathText({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  )
}

export default memo(MathText)
