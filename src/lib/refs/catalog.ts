export type ElemCat = 'alcalino' | 'alcalinotérreo' | 'transición' | 'metal' | 'metaloide' | 'no metal' | 'halógeno' | 'noble' | 'actínido'
export type ElemState = 'sólido' | 'líquido' | 'gas'
export type Element = { z: number; sym: string; name: string; cat: ElemCat; mass: number; conf: string; en: number | null; state: ElemState }

export const CAT_COLOR: Record<ElemCat, string> = {
  alcalino: '#e85d4c',
  'alcalinotérreo': '#f0a04b',
  'transición': '#e8c547',
  metal: '#7d8f69',
  metaloide: '#4c9a8b',
  'no metal': '#4c8dff',
  'halógeno': '#7c6cf0',
  noble: '#c06cff',
  'actínido': '#d98b6c',
}

const E = (z: number, sym: string, name: string, cat: ElemCat, mass: number, conf: string, en: number | null, state: ElemState): Element =>
  ({ z, sym, name, cat, mass, conf, en, state })

/** Períodos 1 a 4 completos, más metales que se consultan seguido. Masas IUPAC aproximadas. */
export const ELEMENTS: Element[] = [
  E(1, 'H', 'Hidrógeno', 'no metal', 1.008, '1s¹', 2.2, 'gas'),
  E(2, 'He', 'Helio', 'noble', 4.0026, '1s²', null, 'gas'),
  E(3, 'Li', 'Litio', 'alcalino', 6.94, '[He] 2s¹', 0.98, 'sólido'),
  E(4, 'Be', 'Berilio', 'alcalinotérreo', 9.0122, '[He] 2s²', 1.57, 'sólido'),
  E(5, 'B', 'Boro', 'metaloide', 10.81, '[He] 2s² 2p¹', 2.04, 'sólido'),
  E(6, 'C', 'Carbono', 'no metal', 12.011, '[He] 2s² 2p²', 2.55, 'sólido'),
  E(7, 'N', 'Nitrógeno', 'no metal', 14.007, '[He] 2s² 2p³', 3.04, 'gas'),
  E(8, 'O', 'Oxígeno', 'no metal', 15.999, '[He] 2s² 2p⁴', 3.44, 'gas'),
  E(9, 'F', 'Flúor', 'halógeno', 18.998, '[He] 2s² 2p⁵', 3.98, 'gas'),
  E(10, 'Ne', 'Neón', 'noble', 20.18, '[He] 2s² 2p⁶', null, 'gas'),
  E(11, 'Na', 'Sodio', 'alcalino', 22.99, '[Ne] 3s¹', 0.93, 'sólido'),
  E(12, 'Mg', 'Magnesio', 'alcalinotérreo', 24.305, '[Ne] 3s²', 1.31, 'sólido'),
  E(13, 'Al', 'Aluminio', 'metal', 26.982, '[Ne] 3s² 3p¹', 1.61, 'sólido'),
  E(14, 'Si', 'Silicio', 'metaloide', 28.085, '[Ne] 3s² 3p²', 1.9, 'sólido'),
  E(15, 'P', 'Fósforo', 'no metal', 30.974, '[Ne] 3s² 3p³', 2.19, 'sólido'),
  E(16, 'S', 'Azufre', 'no metal', 32.06, '[Ne] 3s² 3p⁴', 2.58, 'sólido'),
  E(17, 'Cl', 'Cloro', 'halógeno', 35.45, '[Ne] 3s² 3p⁵', 3.16, 'gas'),
  E(18, 'Ar', 'Argón', 'noble', 39.948, '[Ne] 3s² 3p⁶', null, 'gas'),
  E(19, 'K', 'Potasio', 'alcalino', 39.098, '[Ar] 4s¹', 0.82, 'sólido'),
  E(20, 'Ca', 'Calcio', 'alcalinotérreo', 40.078, '[Ar] 4s²', 1, 'sólido'),
  E(21, 'Sc', 'Escandio', 'transición', 44.956, '[Ar] 4s² 3d¹', 1.36, 'sólido'),
  E(22, 'Ti', 'Titanio', 'transición', 47.867, '[Ar] 4s² 3d²', 1.54, 'sólido'),
  E(23, 'V', 'Vanadio', 'transición', 50.942, '[Ar] 4s² 3d³', 1.63, 'sólido'),
  E(24, 'Cr', 'Cromo', 'transición', 51.996, '[Ar] 4s¹ 3d⁵', 1.66, 'sólido'),
  E(25, 'Mn', 'Manganeso', 'transición', 54.938, '[Ar] 4s² 3d⁵', 1.55, 'sólido'),
  E(26, 'Fe', 'Hierro', 'transición', 55.845, '[Ar] 4s² 3d⁶', 1.83, 'sólido'),
  E(27, 'Co', 'Cobalto', 'transición', 58.933, '[Ar] 4s² 3d⁷', 1.88, 'sólido'),
  E(28, 'Ni', 'Níquel', 'transición', 58.693, '[Ar] 4s² 3d⁸', 1.91, 'sólido'),
  E(29, 'Cu', 'Cobre', 'transición', 63.546, '[Ar] 4s¹ 3d¹⁰', 1.9, 'sólido'),
  E(30, 'Zn', 'Zinc', 'transición', 65.38, '[Ar] 4s² 3d¹⁰', 1.65, 'sólido'),
  E(31, 'Ga', 'Galio', 'metal', 69.723, '[Ar] 4s² 3d¹⁰ 4p¹', 1.81, 'sólido'),
  E(32, 'Ge', 'Germanio', 'metaloide', 72.63, '[Ar] 4s² 3d¹⁰ 4p²', 2.01, 'sólido'),
  E(33, 'As', 'Arsénico', 'metaloide', 74.922, '[Ar] 4s² 3d¹⁰ 4p³', 2.18, 'sólido'),
  E(34, 'Se', 'Selenio', 'no metal', 78.971, '[Ar] 4s² 3d¹⁰ 4p⁴', 2.55, 'sólido'),
  E(35, 'Br', 'Bromo', 'halógeno', 79.904, '[Ar] 4s² 3d¹⁰ 4p⁵', 2.96, 'líquido'),
  E(36, 'Kr', 'Kriptón', 'noble', 83.798, '[Ar] 4s² 3d¹⁰ 4p⁶', 3.0, 'gas'),
  E(47, 'Ag', 'Plata', 'transición', 107.87, '[Kr] 5s¹ 4d¹⁰', 1.93, 'sólido'),
  E(50, 'Sn', 'Estaño', 'metal', 118.71, '[Kr] 5s² 4d¹⁰ 5p²', 1.96, 'sólido'),
  E(79, 'Au', 'Oro', 'transición', 196.97, '[Xe] 6s¹ 4f¹⁴ 5d¹⁰', 2.54, 'sólido'),
  E(80, 'Hg', 'Mercurio', 'transición', 200.59, '[Xe] 6s² 4f¹⁴ 5d¹⁰', 2.0, 'líquido'),
  E(82, 'Pb', 'Plomo', 'metal', 207.2, '[Xe] 6s² 4f¹⁴ 5d¹⁰ 6p²', 2.33, 'sólido'),
  E(92, 'U', 'Uranio', 'actínido', 238.03, '[Rn] 7s² 5f³', 1.38, 'sólido'),
]

export function gridCell(z: number): { r: number; c: number } | null {
  if (z === 1) return { r: 1, c: 1 }
  if (z === 2) return { r: 1, c: 18 }
  if (z >= 3 && z <= 4) return { r: 2, c: z - 2 }
  if (z >= 5 && z <= 10) return { r: 2, c: z + 8 }
  if (z >= 11 && z <= 12) return { r: 3, c: z - 10 }
  if (z >= 13 && z <= 18) return { r: 3, c: z }
  if (z >= 19 && z <= 36) return { r: 4, c: z - 18 }
  return null
}

export const elemLatex = (e: Element) =>
  `\\mathrm{${e.sym}}\\ (Z=${e.z}):\\ ${e.mass}\\ \\mathrm{u},\\ ${e.conf.replaceAll('¹⁴', '^{14}').replaceAll('¹⁰', '^{10}').replaceAll('¹', '^1').replaceAll('²', '^2').replaceAll('³', '^3').replaceAll('⁴', '^4').replaceAll('⁵', '^5').replaceAll('⁶', '^6')}`

export type Sheet = { id: string; title: string; section: string; keywords: string; latex: string; note?: string }

export const CALCULUS: Sheet[] = [
  { id: 'd-pot', title: 'Potencia', section: 'Derivadas', keywords: 'derivada potencia', latex: '\\frac{d}{dx} x^{n} = n x^{n-1}' },
  { id: 'd-sin', title: 'Seno', section: 'Derivadas', keywords: 'derivada seno', latex: '\\frac{d}{dx}\\sin x = \\cos x' },
  { id: 'd-cos', title: 'Coseno', section: 'Derivadas', keywords: 'derivada coseno', latex: '\\frac{d}{dx}\\cos x = -\\sin x' },
  { id: 'd-exp', title: 'Exponencial', section: 'Derivadas', keywords: 'derivada exponencial', latex: '\\frac{d}{dx} e^{x} = e^{x}' },
  { id: 'd-ln', title: 'Logaritmo', section: 'Derivadas', keywords: 'derivada logaritmo', latex: '\\frac{d}{dx}\\ln x = \\frac{1}{x}' },
  { id: 'd-tan', title: 'Tangente', section: 'Derivadas', keywords: 'derivada tangente', latex: '\\frac{d}{dx}\\tan x = \\sec^{2} x' },
  { id: 'i-pot', title: 'Integral de potencia', section: 'Integrales', keywords: 'integral potencia', latex: '\\int x^{n}\\,dx = \\frac{x^{n+1}}{n+1}+C \\quad (n\\neq -1)' },
  { id: 'i-ln', title: 'Integral de 1/x', section: 'Integrales', keywords: 'integral logaritmo', latex: '\\int \\frac{1}{x}\\,dx = \\ln|x|+C' },
  { id: 'i-exp', title: 'Integral exponencial', section: 'Integrales', keywords: 'integral exponencial', latex: '\\int e^{x}\\,dx = e^{x}+C' },
  { id: 'i-sin', title: 'Integral del seno', section: 'Integrales', keywords: 'integral seno', latex: '\\int \\sin x\\,dx = -\\cos x+C' },
  { id: 'i-cos', title: 'Integral del coseno', section: 'Integrales', keywords: 'integral coseno', latex: '\\int \\cos x\\,dx = \\sin x+C' },
  { id: 't-pit', title: 'Identidad fundamental', section: 'Trigonometría', keywords: 'seno coseno pitagoras', latex: '\\sin^{2}\\theta + \\cos^{2}\\theta = 1' },
  { id: 't-sec', title: 'Secante', section: 'Trigonometría', keywords: 'tangente secante', latex: '1 + \\tan^{2}\\theta = \\sec^{2}\\theta' },
  { id: 't-sin-sum', title: 'Seno de la suma', section: 'Trigonometría', keywords: 'seno suma', latex: '\\sin(a\\pm b) = \\sin a\\cos b \\pm \\cos a\\sin b' },
  { id: 't-cos-sum', title: 'Coseno de la suma', section: 'Trigonometría', keywords: 'coseno suma', latex: '\\cos(a\\pm b) = \\cos a\\cos b \\mp \\sin a\\sin b' },
  { id: 't-double', title: 'Ángulo doble', section: 'Trigonometría', keywords: 'doble', latex: '\\sin 2x = 2\\sin x\\cos x' },
  { id: 't-cos2', title: 'Coseno del doble', section: 'Trigonometría', keywords: 'coseno doble', latex: '\\cos 2x = \\cos^{2} x - \\sin^{2} x' },
]

const triples = (rows: [string, string, string][]) => rows
export const GREEK: Sheet[] = triples([
  ['α', 'alfa', '\\alpha'], ['β', 'beta', '\\beta'], ['γ', 'gamma', '\\gamma'], ['δ', 'delta', '\\delta'],
  ['ε', 'épsilon', '\\varepsilon'], ['ζ', 'zeta', '\\zeta'], ['η', 'eta', '\\eta'], ['θ', 'theta', '\\theta'],
  ['ι', 'iota', '\\iota'], ['κ', 'kappa', '\\kappa'], ['λ', 'lambda', '\\lambda'], ['μ', 'mu', '\\mu'],
  ['ν', 'nu', '\\nu'], ['ξ', 'xi', '\\xi'], ['π', 'pi', '\\pi'], ['ρ', 'rho', '\\rho'],
  ['σ', 'sigma', '\\sigma'], ['τ', 'tau', '\\tau'], ['υ', 'ípsilon', '\\upsilon'], ['φ', 'phi', '\\varphi'],
  ['χ', 'chi', '\\chi'], ['ψ', 'psi', '\\psi'], ['ω', 'omega', '\\omega'],
]).map(([glyph, name, latex]) => ({ id: `gr-${name}`, title: `${glyph} ${name}`, section: 'Griego', keywords: `${name} ${glyph} alfabeto`, latex, note: glyph }))

export const PREFIXES: Sheet[] = triples([
  ['Q', 'quetta', '30'], ['R', 'ronna', '27'], ['Y', 'yotta', '24'], ['Z', 'zetta', '21'], ['E', 'exa', '18'],
  ['P', 'peta', '15'], ['T', 'tera', '12'], ['G', 'giga', '9'], ['M', 'mega', '6'], ['k', 'kilo', '3'],
  ['h', 'hecto', '2'], ['da', 'deca', '1'], ['d', 'deci', '-1'], ['c', 'centi', '-2'], ['m', 'mili', '-3'],
  ['μ', 'micro', '-6'], ['n', 'nano', '-9'], ['p', 'pico', '-12'], ['f', 'femto', '-15'], ['a', 'atto', '-18'],
  ['z', 'zepto', '-21'], ['y', 'yocto', '-24'], ['r', 'ronto', '-27'], ['q', 'quecto', '-30'],
]).map(([sym, name, exp]) => ({ id: `si-${name}`, title: `${sym} ${name}`, section: 'Prefijos SI', keywords: `${name} ${sym} 10^${exp}`, latex: `\\mathrm{${sym}} = 10^{${exp}}`, note: `10^${exp}` }))

export type Material = { id: string; name: string; density: number; young: number | null; resistivity: number | null; thermal: number | null }
export const MATERIALS: Material[] = [
  { id: 'acero', name: 'Acero', density: 7850, young: 200, resistivity: 1.7e-7, thermal: 50 },
  { id: 'aluminio', name: 'Aluminio', density: 2700, young: 69, resistivity: 2.65e-8, thermal: 237 },
  { id: 'cobre', name: 'Cobre', density: 8960, young: 110, resistivity: 1.68e-8, thermal: 401 },
  { id: 'hierro', name: 'Hierro', density: 7870, young: 211, resistivity: 9.7e-8, thermal: 80 },
  { id: 'vidrio', name: 'Vidrio', density: 2500, young: 70, resistivity: 1e11, thermal: 1 },
  { id: 'roble', name: 'Madera (roble)', density: 700, young: 11, resistivity: null, thermal: 0.17 },
  { id: 'agua', name: 'Agua', density: 997, young: null, resistivity: 1.8e5, thermal: 0.6 },
  { id: 'hormigon', name: 'Hormigón', density: 2400, young: 30, resistivity: null, thermal: 1.4 },
  { id: 'oro', name: 'Oro', density: 19300, young: 79, resistivity: 2.44e-8, thermal: 317 },
  { id: 'silicio', name: 'Silicio', density: 2330, young: 160, resistivity: 2.3e3, thermal: 148 },
]

export const materialLatex = (m: Material) =>
  `\\rho(${m.name}) = ${m.density}\\,\\mathrm{kg/m^3}`

export const E6 = [10, 15, 22, 33, 47, 68]
export const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82]
export const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91]
/** Década 100–976, tres cifras, IEC 60063. */
export const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976]

export const BANDS = [
  { id: 'negro', name: 'Negro', digit: 0, exp: 0, color: '#222' },
  { id: 'marron', name: 'Marrón', digit: 1, exp: 1, color: '#6b3a1f' },
  { id: 'rojo', name: 'Rojo', digit: 2, exp: 2, color: '#d32f2f' },
  { id: 'naranja', name: 'Naranja', digit: 3, exp: 3, color: '#ef6c00' },
  { id: 'amarillo', name: 'Amarillo', digit: 4, exp: 4, color: '#fbc02d' },
  { id: 'verde', name: 'Verde', digit: 5, exp: 5, color: '#388e3c' },
  { id: 'azul', name: 'Azul', digit: 6, exp: 6, color: '#1565c0' },
  { id: 'violeta', name: 'Violeta', digit: 7, exp: 7, color: '#6a1b9a' },
  { id: 'gris', name: 'Gris', digit: 8, exp: 8, color: '#9e9e9e' },
  { id: 'blanco', name: 'Blanco', digit: 9, exp: 9, color: '#f4f4f4' },
] as const
export const MULT_EXTRA = [
  { id: 'dorado', name: 'Dorado', exp: -1, color: '#d4af37' },
  { id: 'plateado', name: 'Plateado', exp: -2, color: '#c0c0c0' },
] as const
export const TOL = [
  { id: 'marron', name: 'Marrón', tol: 1 },
  { id: 'rojo', name: 'Rojo', tol: 2 },
  { id: 'verde', name: 'Verde', tol: 0.5 },
  { id: 'azul', name: 'Azul', tol: 0.25 },
  { id: 'violeta', name: 'Violeta', tol: 0.1 },
  { id: 'dorado', name: 'Dorado', tol: 5 },
  { id: 'plateado', name: 'Plateado', tol: 10 },
] as const

export function decode4(d1: number, d2: number, exp: number, tol: number) {
  const value = (d1 * 10 + d2) * 10 ** exp
  return { value, tol, latex: `R = ${value}\\,\\Omega \\pm ${tol}\\%` }
}

export type RefHit = { id: string; title: string; section: string; keywords: string }

export function searchRefs(q: string): RefHit[] {
  const n = q.trim().toLocaleLowerCase('es')
  if (n.length < 2) return []
  const hit = (id: string, title: string, section: string, keywords: string): RefHit | null =>
    `${title} ${keywords}`.toLocaleLowerCase('es').includes(n) ? { id, title, section, keywords } : null
  return [
    ...ELEMENTS.flatMap((e) => hit(`el-${e.z}`, e.name, 'Elemento', `${e.sym} ${e.cat}`) ? [{ id: `el-${e.z}`, title: `${e.name} (${e.sym})`, section: 'Elemento', keywords: e.sym }] : []),
    ...CALCULUS.flatMap((s) => { const h = hit(s.id, s.title, s.section, s.keywords); return h ? [h] : [] }),
    ...GREEK.flatMap((s) => { const h = hit(s.id, s.title, s.section, s.keywords); return h ? [h] : [] }),
    ...PREFIXES.flatMap((s) => { const h = hit(s.id, s.title, s.section, s.keywords); return h ? [h] : [] }),
    ...MATERIALS.flatMap((m) => { const h = hit(`mat-${m.id}`, m.name, 'Material', 'densidad young'); return h ? [h] : [] }),
  ].slice(0, 12)
}
