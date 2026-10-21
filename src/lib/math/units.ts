/**
 * Conversión de unidades. Cada unidad se expresa como transformación afín a la unidad base:
 * base = valor · factor + offset. Las unidades lineales tienen offset 0.
 */
export interface UnitDef {
  id: string
  label: string
  factor: number
  offset?: number
}
export interface Quantity {
  id: string
  label: string
  units: UnitDef[]
  /** Valor mínimo admitido en la unidad base (p. ej., 0 K). */
  minBase?: number
}

const si = (sym: string, name: string, base: number, prefixes: [string, string, number][]): UnitDef[] =>
  prefixes.map(([p, pn, f]) => ({ id: `${p}${sym}`, label: `${pn}${name} (${p}${sym})`, factor: base * f }))

export const QUANTITIES: Quantity[] = [
  {
    id: 'length',
    label: 'Longitud',
    units: [
      { id: 'm', label: 'metro (m)', factor: 1 },
      { id: 'km', label: 'kilómetro (km)', factor: 1e3 },
      { id: 'cm', label: 'centímetro (cm)', factor: 1e-2 },
      { id: 'mm', label: 'milímetro (mm)', factor: 1e-3 },
      { id: 'um', label: 'micrómetro (µm)', factor: 1e-6 },
      { id: 'nm', label: 'nanómetro (nm)', factor: 1e-9 },
      { id: 'A', label: 'ángstrom (Å)', factor: 1e-10 },
      { id: 'in', label: 'pulgada (in)', factor: 0.0254 },
      { id: 'ft', label: 'pie (ft)', factor: 0.3048 },
      { id: 'yd', label: 'yarda (yd)', factor: 0.9144 },
      { id: 'mi', label: 'milla terrestre (mi)', factor: 1609.344 },
      { id: 'nmi', label: 'milla náutica (nmi)', factor: 1852 },
      { id: 'au', label: 'unidad astronómica (au)', factor: 149_597_870_700 },
      { id: 'ly', label: 'año luz (ly)', factor: 9_460_730_472_580_800 },
    ],
  },
  {
    id: 'mass',
    label: 'Masa',
    units: [
      { id: 'kg', label: 'kilogramo (kg)', factor: 1 },
      { id: 'g', label: 'gramo (g)', factor: 1e-3 },
      { id: 'mg', label: 'miligramo (mg)', factor: 1e-6 },
      { id: 'ug', label: 'microgramo (µg)', factor: 1e-9 },
      { id: 't', label: 'tonelada métrica (t)', factor: 1e3 },
      { id: 'lb', label: 'libra (lb)', factor: 0.45359237 },
      { id: 'oz', label: 'onza avoirdupois (oz)', factor: 0.028349523125 },
      { id: 'u', label: 'unidad de masa atómica (u)', factor: 1.66053906892e-27 },
    ],
  },
  {
    id: 'time',
    label: 'Tiempo',
    units: [
      { id: 's', label: 'segundo (s)', factor: 1 },
      { id: 'ms', label: 'milisegundo (ms)', factor: 1e-3 },
      { id: 'us', label: 'microsegundo (µs)', factor: 1e-6 },
      { id: 'ns', label: 'nanosegundo (ns)', factor: 1e-9 },
      { id: 'min', label: 'minuto (min)', factor: 60 },
      { id: 'h', label: 'hora (h)', factor: 3600 },
      { id: 'd', label: 'día (d)', factor: 86_400 },
      { id: 'wk', label: 'semana', factor: 604_800 },
      { id: 'yr', label: 'año juliano (365.25 d)', factor: 31_557_600 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperatura',
    minBase: 0,
    units: [
      { id: 'K', label: 'kelvin (K)', factor: 1, offset: 0 },
      { id: 'C', label: 'grado Celsius (°C)', factor: 1, offset: 273.15 },
      { id: 'F', label: 'grado Fahrenheit (°F)', factor: 5 / 9, offset: 273.15 - (32 * 5) / 9 },
      { id: 'R', label: 'grado Rankine (°R)', factor: 5 / 9, offset: 0 },
    ],
  },
  {
    id: 'speed',
    label: 'Velocidad',
    units: [
      { id: 'm/s', label: 'metro por segundo (m/s)', factor: 1 },
      { id: 'km/h', label: 'kilómetro por hora (km/h)', factor: 1 / 3.6 },
      { id: 'mph', label: 'milla por hora (mph)', factor: 0.44704 },
      { id: 'kn', label: 'nudo (kn)', factor: 1852 / 3600 },
      { id: 'ft/s', label: 'pie por segundo (ft/s)', factor: 0.3048 },
      { id: 'c', label: 'velocidad de la luz (c)', factor: 299_792_458 },
    ],
  },
  {
    id: 'energy',
    label: 'Energía',
    units: [
      { id: 'J', label: 'joule (J)', factor: 1 },
      { id: 'kJ', label: 'kilojoule (kJ)', factor: 1e3 },
      { id: 'MJ', label: 'megajoule (MJ)', factor: 1e6 },
      { id: 'cal', label: 'caloría termoquímica (cal)', factor: 4.184 },
      { id: 'kcal', label: 'kilocaloría (kcal)', factor: 4184 },
      { id: 'Wh', label: 'vatio-hora (Wh)', factor: 3600 },
      { id: 'kWh', label: 'kilovatio-hora (kWh)', factor: 3.6e6 },
      { id: 'eV', label: 'electronvoltio (eV)', factor: 1.602176634e-19 },
      { id: 'BTU', label: 'BTU (Tabla internacional)', factor: 1055.05585262 },
      { id: 'erg', label: 'ergio (erg)', factor: 1e-7 },
    ],
  },
  {
    id: 'power',
    label: 'Potencia',
    units: [
      { id: 'W', label: 'vatio (W)', factor: 1 },
      { id: 'mW', label: 'milivatio (mW)', factor: 1e-3 },
      { id: 'kW', label: 'kilovatio (kW)', factor: 1e3 },
      { id: 'MW', label: 'megavatio (MW)', factor: 1e6 },
      { id: 'hp', label: 'caballo de fuerza mecánico (hp)', factor: 745.69987158227022 },
      { id: 'CV', label: 'caballo de vapor métrico (CV)', factor: 735.49875 },
      { id: 'BTU/h', label: 'BTU por hora', factor: 1055.05585262 / 3600 },
    ],
  },
  {
    id: 'force',
    label: 'Fuerza',
    units: [
      { id: 'N', label: 'newton (N)', factor: 1 },
      { id: 'kN', label: 'kilonewton (kN)', factor: 1e3 },
      { id: 'dyn', label: 'dina (dyn)', factor: 1e-5 },
      { id: 'kgf', label: 'kilogramo-fuerza (kgf)', factor: 9.80665 },
      { id: 'lbf', label: 'libra-fuerza (lbf)', factor: 4.4482216152605 },
    ],
  },
  {
    id: 'pressure',
    label: 'Presión',
    units: [
      { id: 'Pa', label: 'pascal (Pa)', factor: 1 },
      { id: 'hPa', label: 'hectopascal (hPa)', factor: 100 },
      { id: 'kPa', label: 'kilopascal (kPa)', factor: 1e3 },
      { id: 'MPa', label: 'megapascal (MPa)', factor: 1e6 },
      { id: 'bar', label: 'bar', factor: 1e5 },
      { id: 'mbar', label: 'milibar (mbar)', factor: 100 },
      { id: 'atm', label: 'atmósfera estándar (atm)', factor: 101_325 },
      { id: 'Torr', label: 'torr', factor: 101_325 / 760 },
      { id: 'mmHg', label: 'milímetro de mercurio (mmHg)', factor: 133.322387415 },
      { id: 'psi', label: 'libra por pulgada² (psi)', factor: 6894.757293168 },
    ],
  },
  {
    id: 'charge',
    label: 'Carga eléctrica',
    units: [
      { id: 'C', label: 'coulomb (C)', factor: 1 },
      { id: 'mC', label: 'milicoulomb (mC)', factor: 1e-3 },
      { id: 'uC', label: 'microcoulomb (µC)', factor: 1e-6 },
      { id: 'nC', label: 'nanocoulomb (nC)', factor: 1e-9 },
      { id: 'Ah', label: 'amperio-hora (Ah)', factor: 3600 },
      { id: 'mAh', label: 'miliamperio-hora (mAh)', factor: 3.6 },
      { id: 'e', label: 'carga elemental (e)', factor: 1.602176634e-19 },
    ],
  },
  {
    id: 'voltage',
    label: 'Voltaje',
    units: si('V', 'voltio', 1, [
      ['', '', 1],
      ['µ', 'micro', 1e-6],
      ['m', 'mili', 1e-3],
      ['k', 'kilo', 1e3],
      ['M', 'mega', 1e6],
    ]),
  },
  {
    id: 'current',
    label: 'Corriente',
    units: si('A', 'amperio', 1, [
      ['', '', 1],
      ['n', 'nano', 1e-9],
      ['µ', 'micro', 1e-6],
      ['m', 'mili', 1e-3],
      ['k', 'kilo', 1e3],
    ]),
  },
  {
    id: 'resistance',
    label: 'Resistencia',
    units: si('Ω', 'ohmio', 1, [
      ['', '', 1],
      ['m', 'mili', 1e-3],
      ['k', 'kilo', 1e3],
      ['M', 'mega', 1e6],
      ['G', 'giga', 1e9],
    ]),
  },
]

export class UnitError extends Error {}

export function findQuantity(id: string): Quantity {
  const q = QUANTITIES.find((x) => x.id === id)
  if (!q) throw new UnitError(`Magnitud desconocida: ${id}`)
  return q
}

function findUnit(q: Quantity, id: string): UnitDef {
  const u = q.units.find((x) => x.id === id)
  if (!u) throw new UnitError(`Unidad desconocida para ${q.label}: ${id}`)
  return u
}

export function convert(value: number, quantityId: string, fromId: string, toId: string): number {
  if (!Number.isFinite(value)) throw new UnitError('Ingresá un número válido')
  const q = findQuantity(quantityId)
  const from = findUnit(q, fromId)
  const to = findUnit(q, toId)
  const base = value * from.factor + (from.offset ?? 0)
  if (q.minBase !== undefined && base < q.minBase - 1e-12) {
    throw new UnitError('El valor está por debajo del cero absoluto')
  }
  return (base - (to.offset ?? 0)) / to.factor
}
