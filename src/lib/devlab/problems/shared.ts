import { formatNumber } from '../interpreter'
import { emptyAnalysis, type Analysis, type Clarification, type KindId, type Solution } from '../types'

/** Minúsculas y sin tildes, para reconocer palabras clave. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export const has = (text: string, re: RegExp) => re.test(norm(text))

const NUM = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi

/** Números del enunciado. El separador decimal es el punto; "3,5" se informa como ambiguo. */
export function numbers(text: string): number[] {
  return (text.match(NUM) ?? []).map(Number).filter(Number.isFinite)
}

/** "3,5" puede ser 3.5 o la lista 3 y 5: se pide aclaración en vez de suponer. */
export function decimalCommaClarifications(text: string): Clarification[] | null {
  const m = text.match(/\d,\d/)
  if (!m) return null
  return [
    { label: 'La coma separa decimales', text: text.replace(/(\d),(\d)/g, '$1.$2') },
    { label: 'La coma separa elementos', text: text.replace(/(\d),(\d)/g, '$1, $2') },
  ]
}

export const fmt = (n: number) => formatNumber(n)
export const texNum = (n: number) => {
  const s = fmt(n)
  return s.includes('e') ? s.replace(/e\+?(-?\d+)/, '\\times 10^{$1}') : s
}
export const texList = (xs: number[]) => xs.map(texNum).join(',\\ ')

export const allInts = (xs: number[]) => xs.every((x) => Number.isSafeInteger(x))

export function needsClarification(kind: KindId, title: string, analysis: Partial<Analysis>, clarifications: Clarification[]): Solution {
  return {
    kind,
    title,
    status: 'clarify',
    analysis: emptyAnalysis({ ...analysis, clarifications }),
    math: null,
    strategies: [],
    strategy: '',
    tests: [],
    questions: [],
  }
}

export function unsupported(kind: KindId, title: string, limitation: string, analysis: Partial<Analysis> = {}): Solution {
  return {
    kind,
    title,
    status: 'unsupported',
    analysis: emptyAnalysis({ summary: limitation, ...analysis }),
    math: null,
    strategies: [],
    strategy: '',
    tests: [],
    questions: [],
    limitation,
  }
}

/** Elige la estrategia pedida si existe; si no, la primera. */
export const pick = <T extends { id: string }>(list: T[], id?: string): T => list.find((s) => s.id === id) ?? list[0]!
