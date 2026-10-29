import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import katex from 'katex'
import { showPowers } from '@/lib/markdown/powers'
import { cx } from './ui'

/** Solo se permiten enlaces http(s), mailto y rutas internas: nunca javascript: ni data:. */
const safeUrl = (url: string) => (/^(https?:|mailto:|\/|#)/i.test(url) ? url : '')

const components: Components = {
  a: ({ href, children }) => {
    const external = href && /^https?:/i.test(href)
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  },
  img: ({ alt }) => <span className="text-muted">[imagen: {alt}]</span>,
}

/**
 * Renderiza Markdown con fórmulas KaTeX. react-markdown no interpreta HTML crudo,
 * así que el contenido de las notas no puede inyectar marcado ni scripts.
 */
export const Markdown = memo(function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cx('prose-nx', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false }]]}
        urlTransform={safeUrl}
        components={components}
      >
        {showPowers(source)}
      </ReactMarkdown>
    </div>
  )
})

export function Tex({ expr, block, className }: { expr: string; block?: boolean; className?: string }) {
  let html: string
  try {
    html = katex.renderToString(expr, { displayMode: block, throwOnError: true, trust: false, strict: 'ignore' })
  } catch (e) {
    return <code className={cx('text-danger', className)} title={(e as Error).message}>{expr}</code>
  }
  // KaTeX genera HTML propio a partir de la expresión; con trust:false no admite \href, \htmlClass, etc.
  return <span className={cx(block && 'block overflow-x-auto py-1', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
