import { memo, useState, type ReactNode } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button, cx } from '@/components/ui'
import type { LangId } from '@/lib/devlab/languages'

const KEYWORDS = new Set(
  (
    'if else elif for while do return def function fn func const let var mut in of and or not is None True False true false null nil ' +
    'public private protected static final class struct interface new throw throws try catch except raise finally import from package use ' +
    'using namespace include define void int long double float bool boolean char string String auto size_t unsigned signed readonly ' +
    'foreach as match break continue switch case default typeof sizeof declare echo self this impl pub mod crate where type enum ' +
    'SELECT FROM WHERE AS CREATE TABLE INSERT INTO VALUES PRIMARY KEY NOT NULL INTEGER REAL TEXT CASE WHEN THEN ELSE END ORDER BY AND OR GROUP HAVING ' +
    'FUNCIÓN FIN SI ENTONCES NO PARA CADA EN DESDE HASTA HACER MIENTRAS DEVOLVER ERROR Y O DIV MOD'
  ).split(' '),
)

const TOKEN =
  /(\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|\/\/[^\n]*|#[^\n]*|--[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\$[A-Za-z_]\w*|\b\d+(?:\.\d+)?(?:e[-+]?\d+)?\b|[A-Za-zÁÉÍÓÚÑáéíóúñ_][\wÁÉÍÓÚÑáéíóúñ]*)/g

function highlight(code: string, lang: LangId | 'pseudo'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of code.matchAll(TOKEN)) {
    const tok = m[0]
    const i = m.index
    if (i > last) out.push(code.slice(last, i))
    last = i + tok.length
    let cls = ''
    if (tok.startsWith('/*') || tok.startsWith('//')) cls = lang === 'python' || lang === 'sql' ? '' : 'text-muted italic'
    else if (tok.startsWith('#')) cls = lang === 'python' ? 'text-muted italic' : lang === 'c' || lang === 'cpp' ? 'text-accent2' : ''
    else if (tok.startsWith('--')) cls = lang === 'sql' ? 'text-muted italic' : ''
    else if (tok.startsWith('"') || tok.startsWith("'")) cls = 'text-ok'
    else if (tok.startsWith('$')) cls = 'text-sky-500'
    else if (/^\d/.test(tok)) cls = 'text-accent2'
    else if (KEYWORDS.has(tok)) cls = 'text-accent font-medium'
    out.push(cls ? <span key={k++} className={cls}>{tok}</span> : tok)
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}

export const CodeBlock = memo(function CodeBlock({ code, lang, fileName, className }: { code: string; lang: LangId | 'pseudo'; fileName?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  const download = () => {
    if (!fileName) return
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className={cx('overflow-hidden rounded-xl border border-line bg-sunken/70', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wider text-muted">{fileName ?? lang}</span>
        <div className="flex gap-1">
          {fileName && (
            <Button size="sm" variant="ghost" onClick={download} aria-label="Descargar archivo">
              <Download size={13} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void copy()} aria-label="Copiar código">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </Button>
        </div>
      </div>
      <pre className="max-h-[560px] overflow-auto p-3 font-mono text-[12.5px] leading-relaxed">
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  )
})
