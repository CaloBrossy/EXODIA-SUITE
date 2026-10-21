export interface Particle {
  name: string
  symbol: string
  charge: string
  mass: string
  spin: string
  generation?: number
  note: string
}

/** Masas: PDG 2024 (valores centrales redondeados). Las masas de quarks dependen del esquema de definición. */
export const QUARKS: Particle[] = [
  { name: 'Arriba (up)', symbol: 'u', charge: '+2/3', mass: '≈ 2.16 MeV/c²', spin: '1/2', generation: 1, note: 'Con el down forma protones (uud) y neutrones (udd).' },
  { name: 'Abajo (down)', symbol: 'd', charge: '−1/3', mass: '≈ 4.70 MeV/c²', spin: '1/2', generation: 1, note: 'Su decaimiento d → u + e⁻ + ν̄ₑ (vía W⁻) es la desintegración β⁻.' },
  { name: 'Encantado (charm)', symbol: 'c', charge: '+2/3', mass: '≈ 1.27 GeV/c²', spin: '1/2', generation: 2, note: 'Descubierto en 1974 (mesón J/ψ = cc̄).' },
  { name: 'Extraño (strange)', symbol: 's', charge: '−1/3', mass: '≈ 93.5 MeV/c²', spin: '1/2', generation: 2, note: 'Presente en kaones y en hiperones como el Λ.' },
  { name: 'Cima (top)', symbol: 't', charge: '+2/3', mass: '≈ 172.6 GeV/c²', spin: '1/2', generation: 3, note: 'El más masivo; decae antes de formar hadrones (Fermilab, 1995).' },
  { name: 'Fondo (bottom)', symbol: 'b', charge: '−1/3', mass: '≈ 4.18 GeV/c²', spin: '1/2', generation: 3, note: 'Forma mesones B, clave en estudios de violación CP.' },
]

export const LEPTONS: Particle[] = [
  { name: 'Electrón', symbol: 'e⁻', charge: '−1', mass: '0.511 MeV/c²', spin: '1/2', generation: 1, note: 'Estable; responsable de la química y la corriente eléctrica.' },
  { name: 'Neutrino electrónico', symbol: 'νₑ', charge: '0', mass: '< 0.45 eV/c² (límite)', spin: '1/2', generation: 1, note: 'Las oscilaciones prueban que los neutrinos tienen masa no nula.' },
  { name: 'Muon', symbol: 'μ⁻', charge: '−1', mass: '105.66 MeV/c²', spin: '1/2', generation: 2, note: 'Vida media ≈ 2.2 μs; abundante en rayos cósmicos.' },
  { name: 'Neutrino muónico', symbol: 'ν_μ', charge: '0', mass: 'muy pequeña', spin: '1/2', generation: 2, note: 'Solo interactúa por la fuerza débil (y la gravedad).' },
  { name: 'Tau', symbol: 'τ⁻', charge: '−1', mass: '1776.9 MeV/c²', spin: '1/2', generation: 3, note: 'Único leptón capaz de decaer en hadrones.' },
  { name: 'Neutrino tauónico', symbol: 'ν_τ', charge: '0', mass: 'muy pequeña', spin: '1/2', generation: 3, note: 'Observado directamente en 2000 (DONUT).' },
]

export const BOSONS: Particle[] = [
  { name: 'Fotón', symbol: 'γ', charge: '0', mass: '0', spin: '1', note: 'Media la interacción electromagnética.' },
  { name: 'Gluón', symbol: 'g', charge: '0', mass: '0', spin: '1', note: 'Media la fuerza fuerte; lleva carga de color (8 estados).' },
  { name: 'Bosón W', symbol: 'W±', charge: '±1', mass: '80.37 GeV/c²', spin: '1', note: 'Interacción débil con cambio de carga (desintegración β).' },
  { name: 'Bosón Z', symbol: 'Z⁰', charge: '0', mass: '91.19 GeV/c²', spin: '1', note: 'Interacción débil neutra.' },
  { name: 'Higgs', symbol: 'H⁰', charge: '0', mass: '125.2 GeV/c²', spin: '0', note: 'Excitación del campo de Higgs; da masa a W, Z y fermiones (LHC, 2012).' },
]

export interface PhysicsModel {
  name: string
  year: string
  authors: string
  idea: string
  explains: string
  limits: string
}

export const ATOMIC_MODELS: PhysicsModel[] = [
  { name: 'Modelo de Dalton', year: '1808', authors: 'John Dalton', idea: 'La materia está formada por átomos indivisibles; los átomos de un mismo elemento son idénticos y se combinan en proporciones enteras.', explains: 'Leyes de proporciones definidas y múltiples.', limits: 'No contempla partículas subatómicas ni explica la electricidad.' },
  { name: 'Modelo de Thomson («budín de pasas»)', year: '1904', authors: 'J. J. Thomson', idea: 'Esfera de carga positiva uniforme con electrones incrustados (el electrón se descubrió en 1897).', explains: 'Neutralidad del átomo y existencia del electrón.', limits: 'Refutado por la dispersión de partículas α en láminas de oro (Geiger y Marsden, 1909).' },
  { name: 'Modelo de Rutherford (nuclear)', year: '1911', authors: 'Ernest Rutherford', idea: 'Casi toda la masa y la carga positiva están en un núcleo diminuto; los electrones giran alrededor.', explains: 'Las desviaciones grandes y poco frecuentes de partículas α.', limits: 'Según el electromagnetismo clásico, el electrón acelerado radiaría y caería al núcleo; no explica los espectros de líneas.' },
  { name: 'Modelo de Bohr', year: '1913', authors: 'Niels Bohr', idea: 'Órbitas estacionarias con momento angular cuantizado L = nħ; el átomo emite o absorbe fotones al saltar entre niveles: E = hf.', explains: 'Espectro del hidrógeno: Eₙ = −13.6 eV / n² y series de Lyman, Balmer, Paschen…', limits: 'Solo funciona para átomos con un electrón; trayectorias definidas incompatibles con el principio de incertidumbre.' },
  { name: 'Modelo de Bohr–Sommerfeld', year: '1916', authors: 'Arnold Sommerfeld', idea: 'Órbitas elípticas y correcciones relativistas; agrega el número cuántico azimutal.', explains: 'Parte de la estructura fina del hidrógeno.', limits: 'Sigue siendo semiclásico; falla con átomos multielectrónicos.' },
  { name: 'Modelo mecanocuántico', year: '1926–1928', authors: 'Schrödinger, Heisenberg, Born, Pauli, Dirac', idea: 'El electrón se describe con una función de onda ψ; |ψ|² da la probabilidad de encontrarlo (orbitales). Números cuánticos n, l, mₗ, mₛ y principio de exclusión de Pauli.', explains: 'Tabla periódica, enlaces químicos, espectros de átomos multielectrónicos.', limits: 'Correcciones finas (p. ej., corrimiento de Lamb) requieren electrodinámica cuántica.' },
]

export const PHYSICS_THEORIES: PhysicsModel[] = [
  { name: 'Mecánica newtoniana', year: '1687', authors: 'Isaac Newton', idea: 'Tres leyes del movimiento y gravitación universal F = G m₁m₂ / r².', explains: 'Movimiento cotidiano, órbitas planetarias, ingeniería mecánica.', limits: 'Falla a velocidades cercanas a c, en campos gravitatorios intensos y a escala atómica.' },
  { name: 'Termodinámica clásica', year: '1824–1865', authors: 'Carnot, Clausius, Kelvin', idea: 'Conservación de la energía (1.ª ley) y aumento de la entropía en sistemas aislados (2.ª ley).', explains: 'Máquinas térmicas, eficiencia máxima de Carnot, irreversibilidad.', limits: 'Describe estados macroscópicos de equilibrio; la base microscópica la da la mecánica estadística.' },
  { name: 'Electromagnetismo de Maxwell', year: '1865', authors: 'James Clerk Maxwell', idea: 'Cuatro ecuaciones unifican electricidad, magnetismo y óptica; la luz es una onda electromagnética.', explains: 'Circuitos, ondas de radio, antenas, motores, óptica.', limits: 'No explica la radiación del cuerpo negro ni el efecto fotoeléctrico (requieren cuantización).' },
  { name: 'Mecánica estadística', year: '1870–1902', authors: 'Boltzmann, Maxwell, Gibbs', idea: 'Las propiedades macroscópicas surgen del promedio sobre microestados: S = k_B ln Ω.', explains: 'Temperatura, presión y entropía a partir de partículas; teoría cinética de gases.', limits: 'Necesita estadísticas cuánticas (Fermi–Dirac, Bose–Einstein) a bajas temperaturas o altas densidades.' },
  { name: 'Relatividad especial', year: '1905', authors: 'Albert Einstein', idea: 'Las leyes físicas son iguales en todo sistema inercial y c es invariante; E = mc².', explains: 'Dilatación del tiempo, contracción de longitudes, energía nuclear, GPS (en parte).', limits: 'No incluye la gravedad.' },
  { name: 'Relatividad general', year: '1915', authors: 'Albert Einstein', idea: 'La gravedad es la curvatura del espacio-tiempo producida por la energía y la materia.', explains: 'Precesión de Mercurio, lentes gravitacionales, agujeros negros, ondas gravitacionales (2015).', limits: 'Incompatible con la mecánica cuántica a escala de Planck.' },
  { name: 'Mecánica cuántica', year: '1900–1927', authors: 'Planck, Einstein, Bohr, Heisenberg, Schrödinger', idea: 'La energía se intercambia en cuantos; los estados se describen con funciones de onda y probabilidades.', explains: 'Átomos, semiconductores, láseres, transistores (base de la electrónica).', limits: 'No relativista en su forma básica; la interpretación de la medición sigue en debate.' },
  { name: 'Modelo estándar de partículas', year: '1970s', authors: 'Glashow, Weinberg, Salam, Gell-Mann y otros', idea: '12 fermiones (6 quarks, 6 leptones), bosones de gauge (γ, g, W, Z) y el Higgs; describe tres de las cuatro fuerzas.', explains: 'Prácticamente todos los resultados de los aceleradores de partículas.', limits: 'No incluye la gravedad, la materia oscura ni explica la masa de los neutrinos por sí solo.' },
  { name: 'Modelo cosmológico ΛCDM (Big Bang)', year: '1990s–2000s', authors: 'Comunidad cosmológica', idea: 'Universo en expansión desde un estado caliente y denso, con materia oscura fría y energía oscura (Λ).', explains: 'Fondo cósmico de microondas, abundancia de elementos ligeros, estructura a gran escala.', limits: 'Desconoce la naturaleza de la materia y la energía oscuras; tensión en la constante de Hubble.' },
]

export interface Constant {
  name: string
  symbol: string
  value: string
  unit: string
  exact?: boolean
}

/** CODATA 2022; las marcadas como exactas son definiciones del SI desde 2019. */
export const CONSTANTS: Constant[] = [
  { name: 'Velocidad de la luz en el vacío', symbol: 'c', value: '299 792 458', unit: 'm/s', exact: true },
  { name: 'Constante de Planck', symbol: 'h', value: '6.626 070 15 × 10⁻³⁴', unit: 'J·s', exact: true },
  { name: 'Constante de Planck reducida', symbol: 'ħ', value: '1.054 571 817… × 10⁻³⁴', unit: 'J·s', exact: true },
  { name: 'Carga elemental', symbol: 'e', value: '1.602 176 634 × 10⁻¹⁹', unit: 'C', exact: true },
  { name: 'Constante de Boltzmann', symbol: 'k_B', value: '1.380 649 × 10⁻²³', unit: 'J/K', exact: true },
  { name: 'Número de Avogadro', symbol: 'N_A', value: '6.022 140 76 × 10²³', unit: 'mol⁻¹', exact: true },
  { name: 'Constante de los gases', symbol: 'R', value: '8.314 462 618…', unit: 'J/(mol·K)', exact: true },
  { name: 'Gravedad estándar', symbol: 'g_n', value: '9.806 65', unit: 'm/s²', exact: true },
  { name: 'Constante de gravitación', symbol: 'G', value: '6.674 30 × 10⁻¹¹', unit: 'm³/(kg·s²)' },
  { name: 'Permitividad del vacío', symbol: 'ε₀', value: '8.854 187 8188 × 10⁻¹²', unit: 'F/m' },
  { name: 'Permeabilidad del vacío', symbol: 'μ₀', value: '1.256 637 061 27 × 10⁻⁶', unit: 'N/A²' },
  { name: 'Constante de Coulomb', symbol: 'k_e = 1/(4πε₀)', value: '8.987 551 786 × 10⁹', unit: 'N·m²/C²' },
  { name: 'Masa del electrón', symbol: 'mₑ', value: '9.109 383 7139 × 10⁻³¹', unit: 'kg' },
  { name: 'Masa del protón', symbol: 'm_p', value: '1.672 621 925 95 × 10⁻²⁷', unit: 'kg' },
  { name: 'Masa del neutrón', symbol: 'm_n', value: '1.674 927 500 56 × 10⁻²⁷', unit: 'kg' },
  { name: 'Unidad de masa atómica', symbol: 'u', value: '1.660 539 068 92 × 10⁻²⁷', unit: 'kg' },
  { name: 'Constante de Stefan–Boltzmann', symbol: 'σ', value: '5.670 374 419… × 10⁻⁸', unit: 'W/(m²·K⁴)', exact: true },
  { name: 'Constante de Rydberg', symbol: 'R∞', value: '10 973 731.568 157', unit: 'm⁻¹' },
  { name: 'Electronvoltio', symbol: 'eV', value: '1.602 176 634 × 10⁻¹⁹', unit: 'J', exact: true },
]
