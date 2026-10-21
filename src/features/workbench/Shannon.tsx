import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EntropyInputError, parseProbabilities, shannonEntropy } from '@/lib/math/entropy'
import { Tex } from '@/components/Markdown'
import { Button, ErrorText, Field, Textarea } from '@/components/ui'
import { ResultBox, SaveCalcButton } from './shared'

function compute<T>(fn: () => T): { result: T | null; error: string } {
  try {
    return { result: fn(), error: '' }
  } catch (e) {
    if (e instanceof EntropyInputError) return { result: null, error: e.message }
    throw e
  }
}

export function ShannonTool() {
  const [text, setText] = useState('0.5, 0.25, 0.125, 0.125')
  const { result, error } = useMemo(() => compute(() => shannonEntropy(parseProbabilities(text))), [text])
  const uniform = (n: number) => setText(Array.from({ length: n }, () => `1/${n}`).join(', '))
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Tex block expr={String.raw`H(X) = -\sum_i p_i \log_2 p_i`} />
        <p className="text-sm text-muted">
          Medida informacional (bits), no termodinámica: ver la <Link className="text-accent" to="/knowledge/c-entropia-shannon">diferencia con la entropía física</Link>. Ingresá probabilidades separadas por coma, espacio o punto y coma; se admiten fracciones como 1/3.
        </p>
        <Field label="Probabilidades p₁, p₂, …" hint="Cada una en [0, 1]; deben sumar 1 (tolerancia 10⁻⁶).">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="font-mono" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => setText('0.5, 0.5')}>Moneda justa</Button>
          <Button size="sm" onClick={() => setText('0.9, 0.1')}>Moneda cargada</Button>
          <Button size="sm" onClick={() => uniform(6)}>Dado</Button>
          <Button size="sm" onClick={() => uniform(26)}>26 letras uniformes</Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          result && (
            <>
              <ResultBox>
                <p className="text-xs text-muted">Entropía</p>
                <p className="font-mono text-2xl tabular">H = {result.bits.toFixed(6)} <span className="text-base text-muted">bits</span></p>
                <p className="font-mono text-xs text-muted">= {result.nats.toFixed(6)} nats · máximo log₂ {result.terms.length} = {result.maxBits.toFixed(4)} bits</p>
              </ResultBox>
              <p className="text-sm">{result.interpretation}</p>
              <div>
                <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Contribución −pᵢ log₂ pᵢ</h3>
                <ul className="flex flex-col gap-1">
                  {result.terms.slice(0, 40).map((t, i) => (
                    <li key={i} className="grid grid-cols-[4rem_minmax(0,1fr)_5rem] items-center gap-2 font-mono text-xs">
                      <span className="text-muted">p{i + 1}={Number(t.p.toPrecision(4))}</span>
                      <span className="h-2 rounded bg-accent/70" style={{ width: `${result.bits > 0 ? (t.contribution / result.bits) * 100 : 0}%` }} />
                      <span className="text-right">{t.contribution.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <SaveCalcButton kind="shannon" input={`H(${text.slice(0, 120)})`} result={`${result.bits.toFixed(6)} bits`} />
            </>
          )
        )}
      </div>
    </div>
  )
}
