import { useState } from 'react'
import { ArrowLeftRight, Copy } from 'lucide-react'
import { convert, findQuantity, QUANTITIES, UnitError } from '@/lib/math/units'
import { formatValue } from '@/lib/math/calculator'
import { copyText } from '@/hooks/misc'
import { useFeedback } from '@/components/feedback'
import { Button, cx, ErrorText, Field, Panel, Select } from '@/components/ui'
import { NumField, parseNum, ResultBox, SaveCalcButton } from './shared'

export default function UnitConverter() {
  const { notify } = useFeedback()
  const [qid, setQid] = useState('length')
  const q = findQuantity(qid)
  const [from, setFrom] = useState(q.units[0]!.id)
  const [to, setTo] = useState(q.units[1]!.id)
  const [value, setValue] = useState('1')

  const changeQuantity = (id: string) => {
    const nq = findQuantity(id)
    setQid(id)
    setFrom(nq.units[0]!.id)
    setTo(nq.units[1]!.id)
  }

  let result: number | null = null
  let error = ''
  try {
    result = convert(parseNum(value), qid, from, to)
  } catch (e) {
    if (e instanceof UnitError) error = e.message
    else throw e
  }
  const fromU = q.units.find((u) => u.id === from)!
  const toU = q.units.find((u) => u.id === to)!
  const text = result !== null ? formatValue(result, 'auto', 10) : ''
  const affine = q.units.some((u) => u.offset)

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="flex flex-row flex-wrap gap-1 lg:flex-col" aria-label="Magnitudes">
        {QUANTITIES.map((x) => (
          <button key={x.id} onClick={() => changeQuantity(x.id)} className={cx('rounded-md px-3 py-1.5 text-left text-sm', x.id === qid ? 'bg-sunken font-medium' : 'text-muted hover:bg-sunken hover:text-fg')}>
            {x.label}
          </button>
        ))}
      </nav>
      <Panel title={q.label}>
        <div className="flex flex-col gap-4">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)]">
            <NumField label="Valor" value={value} onChange={setValue} />
            <Field label="De">
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>{q.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </Field>
            <Button size="icon" aria-label="Intercambiar unidades" title="Intercambiar" onClick={() => { setFrom(to); setTo(from) }}><ArrowLeftRight size={15} /></Button>
            <Field label="A">
              <Select value={to} onChange={(e) => setTo(e.target.value)}>{q.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</Select>
            </Field>
          </div>
          {error ? (
            <ErrorText>{error}</ErrorText>
          ) : (
            <ResultBox>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xl tabular break-all">
                  {value} {fromU.label.match(/\(([^)]+)\)$/)?.[1] ?? fromU.id} = <strong>{text}</strong> {toU.label.match(/\(([^)]+)\)$/)?.[1] ?? toU.id}
                </p>
                <Button size="icon" variant="ghost" aria-label="Copiar" onClick={async () => notify((await copyText(text)) ? 'Copiado.' : 'No se pudo copiar.')}><Copy size={14} /></Button>
              </div>
            </ResultBox>
          )}
          {result !== null && <SaveCalcButton kind="units" input={`${value} ${fromU.id} → ${toU.id}`} result={`${text} ${toU.id}`} />}
          <p className="text-xs text-muted">
            {affine
              ? 'La temperatura usa conversiones afines (con desplazamiento): T(K) = T(°C) + 273.15. Para diferencias de temperatura, 1 °C de diferencia equivale a 1 K. Se rechazan valores por debajo del cero absoluto.'
              : 'Conversión lineal mediante factores exactos o de definición estándar (SI, CODATA, NIST) cuando existen.'}
          </p>
        </div>
      </Panel>
    </div>
  )
}
