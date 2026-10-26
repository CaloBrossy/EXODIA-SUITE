import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, NotebookPen } from 'lucide-react'
import { Tex } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Button, Field, Input, Panel, Select } from '@/components/ui'
import { MatrixError, assertMatrix, parseQ, runMatrix, type OpResult } from '@/lib/math/matrix'
import { createNote } from '@/services/notes'

const OPS = [
  ['add', 'Suma'],
  ['mul', 'Producto'],
  ['transpose', 'Traspuesta'],
  ['det', 'Determinante'],
  ['inverse', 'Inversa'],
  ['rank', 'Rango'],
  ['ref', 'Escalonada'],
  ['rref', 'Reducida'],
  ['solve', 'Ax = b'],
  ['eigen', 'Autovalores'],
  ['diag', 'Diagonalizar'],
  ['kernel', 'Núcleo'],
  ['image', 'Imagen'],
  ['independent', 'Independencia'],
  ['gram', 'Gram-Schmidt'],
] as const

const grid = (fill = '0') => Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => fill))

function seedA() {
  const a = grid()
  ;[['1', '2', '0'], ['0', '1', '1'], ['1', '0', '1']].forEach((row, i) => row.forEach((v, j) => { a[i]![j] = v }))
  return a
}

function seedI() {
  const a = grid()
  for (let i = 0; i < 6; i++) a[i]![i] = '1'
  return a
}

function Grid({ label, n, value, onChange }: { label: string; n: number; value: string[][]; onChange: (g: string[][]) => void }) {
  return (
    <Field label={label}>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 4.5rem))` }}>
        {value.slice(0, n).map((row, i) => row.slice(0, n).map((cell, j) => (
          <Input key={`${i}-${j}`} className="h-8 font-mono text-xs" aria-label={`${label} ${i + 1},${j + 1}`} value={cell} onChange={(e) => onChange(value.map((r, ri) => (ri === i ? r.map((c, cj) => (cj === j ? e.target.value : c)) : r)))} />
        )))}
      </div>
    </Field>
  )
}

export default function Algebra() {
  const navigate = useNavigate()
  const { fail, notify } = useFeedback()
  const [n, setN] = useState(3)
  const [op, setOp] = useState<(typeof OPS)[number][0]>('inverse')
  const [a, setA] = useState(seedA)
  const [b, setB] = useState(seedI)
  const [vec, setVec] = useState(['1', '1', '1', '0', '0', '0'])
  const [out, setOut] = useState<OpResult | null>(null)
  const [error, setError] = useState('')

  const run = () => {
    try {
      const A = assertMatrix(a.slice(0, n).map((row) => row.slice(0, n)))
      const B = op === 'add' || op === 'mul' ? assertMatrix(b.slice(0, n).map((row) => row.slice(0, n))) : undefined
      const vector = op === 'solve' ? vec.slice(0, n).map(parseQ) : undefined
      setOut(runMatrix(op, A, B, vector))
      setError('')
    } catch (e) {
      setOut(null)
      setError(e instanceof MatrixError || e instanceof Error ? e.message : 'No se pudo operar')
    }
  }

  const copy = async () => {
    if (!out) return
    await navigator.clipboard.writeText(out.latex)
    notify('LaTeX copiado')
  }

  const save = async () => {
    if (!out) return
    try {
      const note = await createNote({
        title: 'Álgebra lineal',
        content: ['$$', out.latex, '$$', '', ...out.steps.flatMap((s) => [s.text, '', '$$', s.latex, '$$', ''])].join('\n'),
      })
      navigate(`/notes/${note.id}`)
    } catch (e) { fail(e) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Matrices" actions={<span className="text-xs text-muted">Fracciones exactas, hasta 6×6. Cada fila es un vector en independencia y Gram-Schmidt.</span>}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="Tamaño">
            <Select className="h-8" aria-label="Tamaño" value={String(n)} onChange={(e) => setN(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((k) => <option key={k} value={k}>{k}×{k}</option>)}
            </Select>
          </Field>
          <Field label="Operación">
            <Select className="h-8" aria-label="Operación" value={op} onChange={(e) => setOp(e.target.value as (typeof OPS)[number][0])}>
              {OPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </Field>
          <Button size="sm" variant="primary" onClick={run}>Resolver</Button>
        </div>
        <div className="flex flex-wrap gap-6">
          <Grid label="A" n={n} value={a} onChange={setA} />
          {(op === 'add' || op === 'mul') && <Grid label="B" n={n} value={b} onChange={setB} />}
          {op === 'solve' && (
            <Field label="b">
              <div className="flex flex-col gap-1">
                {vec.slice(0, n).map((v, i) => (
                  <Input key={i} className="h-8 w-20 font-mono text-xs" aria-label={`b ${i + 1}`} value={v} onChange={(e) => setVec(vec.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </div>
            </Field>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Panel>
      {out && (
        <Panel title="Procedimiento" actions={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => void copy()}><Copy size={13} /> LaTeX</Button>
            <Button size="sm" variant="ghost" onClick={() => void save()}><NotebookPen size={13} /> Nota</Button>
          </div>
        }>
          <Tex expr={out.latex} block />
          <ol className="mt-3 flex flex-col gap-3 text-sm">
            {out.steps.map((s, i) => (
              <li key={i}>
                <p>{s.text}</p>
                <Tex expr={s.latex} block />
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  )
}
