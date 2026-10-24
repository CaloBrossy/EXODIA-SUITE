import { add, at, bool, concat, eq, for_, if_, int, len, let_, lt, not, or, ref, ret, set, str, sub } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { needsClarification, norm } from './shared'
import { tc, uniqueTests } from './testing'

const KIND = 'strings' as const

type Variant = 'palindromo' | 'vocales' | 'invertir'

function variantOf(t: string): Variant | null {
  if (/palindrom/.test(t)) return 'palindromo'
  if (/vocal/.test(t)) return 'vocales'
  if (/invertir|reverso|al reves/.test(t)) return 'invertir'
  return null
}

const quoted = (text: string) => text.match(/["“”']([^"“”']+)["“”']/)?.[1] ?? text.match(/\bde(?:l)?(?: la)?(?: palabra| cadena| texto)?\s+([a-záéíóúñ]+)\s*$/i)?.[1]

function sampleOf(text: string, fallback: string) {
  return quoted(text) ?? fallback
}

const isVowel = (c: string) => 'aeiouáéíóúAEIOUÁÉÍÓÚ'.includes(c)

function build(text: string): Solution {
  const t = norm(text)
  const v = variantOf(t)
  if (!v)
    return needsClarification(KIND, 'Cadenas', { summary: 'Problema de texto.', ambiguities: ['¿Palíndromo, vocales o invertir?'] }, [
      { label: 'Palíndromo', text: '¿Es palíndromo "neuquen"?' },
      { label: 'Vocales', text: 'Contá las vocales de la palabra casa' },
      { label: 'Invertir', text: 'Invertir la cadena hola' },
    ])
  const s = sampleOf(text, v === 'palindromo' ? 'neuquen' : v === 'vocales' ? 'casa' : 'hola')
  const assumptions = quoted(text) ? [] : [`No se entrecomilló el texto: se usa «${s}».`]
  assumptions.push('Índices = puntos de código Unicode (JS [...s]); en C/Go se asume ASCII.')

  if (v === 'palindromo') {
    const ok = [...s].every((c, i, a) => c === a[a.length - 1 - i])
    return {
      kind: KIND,
      title: `¿Palíndromo «${s}»?`,
      status: 'ok',
      analysis: emptyAnalysis({
        summary: 'Decidir si el texto se lee igual al derecho y al revés.',
        goal: 'verdadero o falso.',
        known: [`texto = "${s}"`],
        unknown: ['Si es palíndromo.'],
        constraints: ['Se comparan puntos de código, sin ignorar mayúsculas ni espacios.'],
        conditions: ['texto[i] ≠ texto[n-1-i] → falso.'],
        edgeCases: ['Vacío: verdadero.', 'Un carácter.', 'Mayúsculas distintas.'],
        assumptions,
      }),
      math: null,
      mathNote: 'No hay fórmula: es una comparación de posiciones.',
      strategies: [{ id: 'dos-puntas', label: 'Dos puntas', summary: 'Comparar i con n − 1 − i hasta el centro.' }],
      strategy: 'dos-puntas',
      design: {
        inputs: ['texto: cadena'],
        outputs: ['esPalindromo: lógico'],
        variables: ['i, j: índices'],
        steps: ['i = 0, j = n − 1.', 'Mientras i < j, si las letras difieren devolver falso.', 'Si no, verdadero.'],
        conditions: ['texto[i] ≠ texto[j] → falso.'],
        loops: ['PARA i hasta el centro, o dos índices que avanzan.'],
        special: ['Posición = punto de código, no byte UTF-8.'],
        complexity: { time: 'O(n)', space: 'O(1)', why: 'A lo sumo n/2 comparaciones.' },
      },
      program: {
        entry: 'esPalindromo',
        fns: [
          {
            name: 'esPalindromo',
            params: [{ name: 'texto', type: 'str', doc: 'cadena a revisar.' }],
            returns: 'bool',
            fallible: false,
            doc: 'Decide si un texto es palíndromo.',
            returnsDoc: 'verdadero si se lee igual al revés.',
            body: [
              let_('i', 'int', int(0), { step: 1 }),
              let_('j', 'int', sub(len('texto'), int(1)), { step: 1 }),
              for_('k', int(0), len('texto'), [
                if_(lt(ref('i'), ref('j')), [if_(not(eq(at('texto', ref('i')), at('texto', ref('j')))), [ret(bool(false), { step: 2 })], [set('i', add(ref('i'), int(1)), { step: 2 }), set('j', sub(ref('j'), int(1)), { step: 2 })], { step: 2 })], undefined, { step: 2 }),
              ], { step: 2 }),
              ret(bool(true), { step: 3 }),
            ],
          },
        ],
      },
      tests: uniqueTests([
        tc([s], () => ok, 'normal', 'El texto del enunciado.'),
        tc(['neuquen'], () => true, 'normal', 'Palíndromo.'),
        tc(['hola'], () => false, 'normal', 'No lo es.'),
        tc(['a'], () => true, 'límite', 'Un carácter.'),
        tc([''], () => true, 'límite', 'Vacío.'),
      ]),
      sqlNote: 'SQL no aplica a un único texto.',
      questions: [{ stage: 'problem', question: '¿"Neuquen" y "neuquen" son el mismo palíndromo?', answer: 'En esta versión no: se distingue mayúscula de minúscula.' }],
    }
  }

  if (v === 'vocales') {
    const count = [...s].filter(isVowel).length
    return {
      kind: KIND,
      title: `Vocales de «${s}»`,
      status: 'ok',
      analysis: emptyAnalysis({
        summary: 'Contar vocales (a e i o u, con y sin tilde).',
        goal: 'Un entero ≥ 0.',
        known: [`texto = "${s}"`],
        unknown: ['La cantidad de vocales.'],
        constraints: ['La y no cuenta. Mayúsculas sí.'],
        conditions: ['La letra es a, e, i, o, u (con tilde o no).'],
        edgeCases: ['Sin vocales: 0.', 'Vacío: 0.'],
        assumptions,
      }),
      math: null,
      mathNote: 'Es un conteo, no una fórmula.',
      strategies: [{ id: 'recorrido', label: 'Un recorrido', summary: 'Mirar cada letra y sumar si es vocal.' }],
      strategy: 'recorrido',
      design: {
        inputs: ['texto: cadena'],
        outputs: ['cantidad: entero'],
        variables: ['total, i'],
        steps: ['total ← 0.', 'Para cada posición, si es vocal sumar 1.', 'Devolver total.'],
        conditions: ['letra ∈ {a,e,i,o,u,á,…} → contar.'],
        loops: ['PARA i DESDE 0 HASTA n − 1.'],
        special: ['Se compara la letra (1 punto de código) con literales.'],
        complexity: { time: 'O(n)', space: 'O(1)', why: 'Un pase.' },
      },
      program: {
        entry: 'contarVocales',
        fns: [
          {
            name: 'contarVocales',
            params: [{ name: 'texto', type: 'str', doc: 'texto a revisar.' }],
            returns: 'int',
            fallible: false,
            doc: 'Cuenta vocales, incluidas las tildadas.',
            returnsDoc: 'La cantidad.',
            body: [
              let_('total', 'int', int(0), { step: 1 }),
              for_(
                'i',
                int(0),
                sub(len('texto'), int(1)),
                [
                  if_(
                    or(or(or(eq(at('texto', ref('i')), str('a')), eq(at('texto', ref('i')), str('e'))), or(eq(at('texto', ref('i')), str('i')), eq(at('texto', ref('i')), str('o')))), or(eq(at('texto', ref('i')), str('u')), or(eq(at('texto', ref('i')), str('A')), eq(at('texto', ref('i')), str('E'))))),
                    [set('total', add(ref('total'), int(1)), { step: 2 })],
                    [
                      if_(
                        or(eq(at('texto', ref('i')), str('I')), or(eq(at('texto', ref('i')), str('O')), eq(at('texto', ref('i')), str('U')))),
                        [set('total', add(ref('total'), int(1)), { step: 2 })],
                        undefined,
                        { step: 2 },
                      ),
                    ],
                    { step: 2 },
                  ),
                ],
                { step: 2 },
              ),
              ret(ref('total'), { step: 3 }),
            ],
          },
        ],
      },
      tests: uniqueTests([
        tc([s], () => count, 'normal', 'El texto del enunciado.'),
        tc(['casa'], () => 2, 'normal', 'casa → 2.'),
        tc(['rhythm'], () => 0, 'límite', 'Sin vocales.'),
        tc([''], () => 0, 'límite', 'Vacío.'),
        tc(['AEIOU'], () => 5, 'normal', 'Mayúsculas.'),
      ]),
      sqlNote: 'SQL no aplica a un único texto.',
      questions: [{ stage: 'problem', question: '¿La y cuenta?', answer: 'No en esta versión.' }],
    }
  }

  const rev = [...s].reverse().join('')
  return {
    kind: KIND,
    title: `Invertir «${s}»`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: 'Devolver el texto al revés.',
      goal: 'Una cadena nueva.',
      known: [`texto = "${s}"`],
      unknown: ['El reverso.'],
      constraints: ['Puntos de código, de derecha a izquierda.'],
      conditions: [],
      edgeCases: ['Vacío.', 'Un carácter.'],
      assumptions,
    }),
    math: null,
    mathNote: 'No hay fórmula.',
    strategies: [{ id: 'concat', label: 'Concatenar al revés', summary: 'Recorrer desde el final y concatenar.' }],
    strategy: 'concat',
    design: {
      inputs: ['texto: cadena'],
      outputs: ['salida: cadena'],
      variables: ['salida, i'],
      steps: ['salida ← "".', 'Para i desde n − 1 hasta 0, concatenar texto[i].', 'Devolver salida.'],
      conditions: [],
      loops: ['PARA i DESDE n − 1 HASTA 0.'],
      special: ['Concatenar en un bucle es O(n²) en algunos lenguajes; n es chico en los ejemplos.'],
      complexity: { time: 'O(n²)', space: 'O(n)', why: 'Cada concatenación puede copiar el prefijo.' },
    },
    program: {
      entry: 'invertir',
      fns: [
        {
          name: 'invertir',
          params: [{ name: 'texto', type: 'str', doc: 'cadena a invertir.' }],
          returns: 'str',
          fallible: false,
          doc: 'Invierte una cadena por concatenación desde el final.',
          returnsDoc: 'El reverso.',
          body: [
            let_('salida', 'str', str(''), { step: 1 }),
            for_('i', int(0), sub(len('texto'), int(1)), [set('salida', concat(at('texto', ref('i')), ref('salida')), { step: 2 })], { step: 2, note: 'Se antepone texto[i]: el PARA crece y el resultado queda invertido' }),
            ret(ref('salida'), { step: 3 }),
          ],
        },
      ],
    },
    tests: uniqueTests([
      tc([s], () => rev, 'normal', 'El texto del enunciado.'),
      tc(['hola'], () => 'aloh', 'normal', 'hola → aloh.'),
      tc(['a'], () => 'a', 'límite', 'Un carácter.'),
      tc([''], () => '', 'límite', 'Vacío.'),
    ]),
    sqlNote: 'SQL no aplica a un único texto.',
      questions: [{ stage: 'code', question: '¿Por qué anteponemos y no recorremos i hacia atrás?', answer: 'El PARA de la IR siempre crece. Anteponer texto[i] produce el reverso.' }],
  }
}

export const stringsKind: KindDef = {
  id: KIND,
  label: 'Cadenas de texto',
  description: 'Palíndromo, conteo de vocales e inversión. Índices = puntos de código; C/Go asumen ASCII.',
  examples: [
    { title: 'Palíndromo', text: '¿Es palíndromo "neuquen"?' },
    { title: 'Vocales', text: 'Contá las vocales de la palabra casa' },
    { title: 'Invertir', text: 'Invertir la cadena hola' },
  ],
  detect: (text) => (variantOf(norm(text)) ? 0.9 : 0),
  build,
}
