import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cx, Input, Panel, pillClass, Tag } from '@/components/ui'
import { norm } from '@/lib/devlab/problems/shared'
import { GUIDE_CATEGORIES, GUIDE_REFS, GUIDES, type GuideCategory, type GuideSource } from '@/lib/devlab/guides'
import { LANGS, type LangId } from '@/lib/devlab/languages'
import { CodeBlock } from './CodeBlock'
import { LANG_OPTIONS } from './Stages'

const SOURCE: Record<GuideSource, { label: string; cls: string; title: string }> = {
  oficial: { label: 'oficial', cls: 'border-accent/50 text-accent', title: 'Guía o documentación oficial del lenguaje' },
  comunidad: { label: 'comunidad', cls: 'border-ok/50 text-ok', title: 'Convención ampliamente aceptada' },
  proyecto: { label: 'EXODIA', cls: 'border-amber-500/50 text-amber-500', title: 'Preferencia de este proyecto' },
}

export function LangGuide({ initial }: { initial: LangId }) {
  const [lang, setLang] = useState<LangId | 'all'>(initial)
  const [cat, setCat] = useState<GuideCategory | null>(null)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    return GUIDES.filter((g) => (lang === 'all' || g.lang === lang) && (!cat || g.cat === cat) && words.every((w) => norm(`${g.title} ${g.text} ${g.works ?? ''} ${g.better ?? ''}`).includes(w)))
  }, [lang, cat, q])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="glass inline-flex flex-wrap gap-1 self-start rounded-xl p-1">
          <button type="button" className={pillClass(lang === 'all')} onClick={() => setLang('all')}>Todos</button>
          {LANG_OPTIONS.map((l) => (
            <button key={l} type="button" className={pillClass(lang === l)} onClick={() => setLang(l)}>{LANGS[l].label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en las guías…" className="pl-8" aria-label="Buscar en las guías" />
          </div>
          <Tag active={!cat} onClick={() => setCat(null)}>Todas</Tag>
          {GUIDE_CATEGORIES.map((c) => (
            <Tag key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label}</Tag>
          ))}
        </div>
        {lang !== 'all' && (
          <p className="text-xs text-muted">
            Referencias: {GUIDE_REFS[lang]}. Tipado: {LANGS[lang].typing}
          </p>
        )}
        <p className="flex flex-wrap gap-2 text-[11px] text-muted">
          {(Object.keys(SOURCE) as GuideSource[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1"><span className={cx('rounded-full border px-1.5', SOURCE[s].cls)}>{SOURCE[s].label}</span>{SOURCE[s].title}</span>
          ))}
        </p>
      </div>
      {!list.length && <p className="text-sm text-muted">Nada coincide con la búsqueda.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((g, i) => (
          <Panel key={`${g.lang}-${g.title}-${i}`} title={`${LANGS[g.lang].label} · ${GUIDE_CATEGORIES.find((c) => c.id === g.cat)!.label}`} actions={<span title={SOURCE[g.source].title} className={cx('rounded-full border px-1.5 text-[10px]', SOURCE[g.source].cls)}>{SOURCE[g.source].label}</span>}>
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">{g.title}</h3>
              <p className="text-sm text-muted">{g.text}</p>
              {g.ref && <p className="text-[11px] text-muted">Ref.: {g.ref}</p>}
              {g.works && (
                <div>
                  <p className="mb-1 text-[11px] text-amber-500">Funciona, pero cuesta mantenerlo</p>
                  <CodeBlock code={g.works} lang={g.lang} />
                </div>
              )}
              {g.better && (
                <div>
                  <p className="mb-1 text-[11px] text-ok">Recomendado</p>
                  <CodeBlock code={g.better} lang={g.lang} />
                </div>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}
