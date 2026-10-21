import type { ReactNode } from 'react'
import { Save } from 'lucide-react'
import { recordCalculation } from '@/services/knowledge'
import { useFeedback } from '@/components/feedback'
import { Button, Field, Input } from '@/components/ui'

/** Convierte texto a número admitiendo coma decimal y notación científica. Vacío → NaN. */
export function parseNum(s: string): number {
  const t = s.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return NaN
  return Number(t)
}

export function NumField({ label, value, onChange, unit, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; unit?: ReactNode; hint?: ReactNode; placeholder?: string }) {
  const invalid = value.trim() !== '' && !Number.isFinite(parseNum(value))
  return (
    <Field label={label} hint={invalid ? <span className="text-danger">Número inválido</span> : hint}>
      <div className="flex items-center gap-2">
        <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono" aria-invalid={invalid} />
        {unit && <span className="shrink-0 text-sm text-muted">{unit}</span>}
      </div>
    </Field>
  )
}

export function SaveCalcButton({ kind, input, result }: { kind: string; input: string; result: string }) {
  const { fail, notify } = useFeedback()
  return (
    <Button
      size="sm"
      onClick={() =>
        recordCalculation(kind, input, result)
          .then(() => notify('Guardado en el historial. Podés vincularlo desde una nota.', 'ok'))
          .catch(fail)
      }
    >
      <Save size={13} /> Guardar en historial
    </Button>
  )
}

export function ResultBox({ children }: { children: ReactNode }) {
  return <div className="rounded-md bg-sunken px-4 py-3">{children}</div>
}
