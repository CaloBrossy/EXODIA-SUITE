import type { Concept } from '../models'

type SeedConcept = Omit<Concept, 'createdAt' | 'updatedAt' | 'favorite' | 'seed' | 'lastViewedAt'>

const r = String.raw

export const SEED_CONCEPTS: SeedConcept[] = [
  {
    id: 'c-entropia-termo',
    title: 'Entropía (termodinámica)',
    discipline: 'Física',
    tags: ['termodinámica', 'segunda ley', 'función de estado'],
    summary:
      'Función de estado S de un sistema macroscópico que, entre otras cosas, determina qué procesos espontáneos son posibles. Se mide en J/K.',
    explanation: r`La entropía termodinámica es una **función de estado**: su variación entre dos estados de equilibrio depende solo de esos estados, no del camino seguido.

Clausius la definió a partir de procesos **reversibles**: el cambio infinitesimal de entropía es el calor intercambiado reversiblemente dividido por la temperatura absoluta. Para un proceso real (irreversible) entre los mismos estados, $\Delta S$ es el mismo, pero **no** se calcula como $\int \delta Q/T$ con el calor real: hay que imaginar un camino reversible que conecte los estados.

La **segunda ley** afirma que la entropía de un sistema aislado nunca disminuye. Desde la mecánica estadística, Boltzmann la vinculó con el número de microestados compatibles con un macroestado.

> No confundir con la entropía de Shannon: comparten estructura matemática, pero una es una magnitud física (J/K) y la otra una medida de incertidumbre de una distribución (bits).`,
    formalism: r`**Definición de Clausius** (camino reversible):
$$dS = \frac{\delta Q_{\mathrm{rev}}}{T}, \qquad \Delta S = \int_{1}^{2} \frac{\delta Q_{\mathrm{rev}}}{T}$$

**Desigualdad de Clausius** (cualquier proceso): $dS \ge \dfrac{\delta Q}{T_{\text{frontera}}}$. En un sistema aislado: $\Delta S \ge 0$.

**Proceso isotérmico reversible:** $\Delta S = \dfrac{Q_{\mathrm{rev}}}{T}$.

**Gas ideal** con $C_V$ constante:
$$\Delta S = n C_V \ln\frac{T_2}{T_1} + n R \ln\frac{V_2}{V_1}$$

**Boltzmann** (microestados equiprobables): $S = k_B \ln \Omega$, con $k_B = 1.380649\times10^{-23}\ \mathrm{J/K}$ (valor exacto en el SI).

**Gibbs:** $S = -k_B \sum_i p_i \ln p_i$.`,
    examples: r`- **Fusión de hielo:** 1 kg de hielo a 273.15 K con calor latente $L_f \approx 334\ \mathrm{kJ/kg}$. La fusión a presión constante en equilibrio es reversible: $\Delta S \approx 334\,000 / 273.15 \approx 1.22\times10^{3}\ \mathrm{J/K}$.
- **Expansión libre de un gas ideal:** 1 mol duplica su volumen en el vacío. $Q = 0$, pero $\Delta S = nR\ln 2 \approx 5.76\ \mathrm{J/K} > 0$. Es el ejemplo clásico de que $Q/T$ con el calor real no da el cambio de entropía en un proceso irreversible.`,
    observations:
      'Usar siempre temperatura absoluta (kelvin). Cuidado con los signos: Q > 0 significa calor que entra al sistema.',
    relatedIds: ['c-entropia-shannon', 'c-energia', 'c-probabilidad'],
  },
  {
    id: 'c-entropia-shannon',
    title: 'Entropía (teoría de la información)',
    discipline: 'Información',
    tags: ['shannon', 'información', 'probabilidad'],
    summary:
      'Medida de la incertidumbre promedio de una variable aleatoria discreta, definida por Shannon (1948). En base 2 se mide en bits.',
    explanation: r`La entropía de Shannon $H(X)$ cuantifica cuánta incertidumbre hay, en promedio, sobre el resultado de una variable aleatoria $X$. Equivalentemente, es la cantidad media de información que aporta conocer el resultado.

Es la cota inferior para la longitud media de un código sin pérdidas (teorema de codificación de fuente): no se puede comprimir, en promedio, por debajo de $H$ bits por símbolo.

**Relación con la termodinámica:** la entropía de Gibbs es $k_B \ln 2$ veces la entropía de Shannon (en bits) de la distribución de probabilidad sobre los microestados. La correspondencia solo tiene sentido cuando la distribución describe microestados físicos de un sistema; la entropía de Shannon de un texto o una moneda **no** es una entropía termodinámica. El principio de Landauer conecta ambas: borrar un bit disipa al menos $k_B T \ln 2$ de energía.`,
    formalism: r`$$H(X) = -\sum_{i=1}^{n} p_i \log_2 p_i \quad [\text{bits}]$$

Con la convención $0 \log 0 = 0$. Con logaritmo natural la unidad es el *nat* ($1\ \text{nat} = 1/\ln 2 \approx 1.4427$ bits).

Propiedades:
- $0 \le H(X) \le \log_2 n$.
- $H$ es máxima para la distribución uniforme y nula cuando un resultado es seguro.`,
    examples: r`- Moneda justa: $H = 1$ bit.
- Dado de 6 caras justo: $H = \log_2 6 \approx 2.585$ bits.
- Moneda cargada con $p = 0.9$: $H \approx 0.469$ bits.
- Landauer a 300 K: $k_B T \ln 2 \approx 2.87\times10^{-21}$ J por bit borrado.`,
    observations: 'Probá distribuciones en Workbench → Entropía → Shannon.',
    relatedIds: ['c-entropia-termo', 'c-probabilidad'],
  },
  {
    id: 'c-newton',
    title: 'Leyes de Newton',
    discipline: 'Física',
    tags: ['mecánica', 'dinámica', 'fuerza'],
    summary:
      'Tres leyes que relacionan las fuerzas con el movimiento de los cuerpos en mecánica clásica, válidas en sistemas de referencia inerciales.',
    explanation: r`1. **Inercia:** un cuerpo sobre el que la fuerza neta es nula mantiene su velocidad constante (en reposo o MRU). Esta ley define, en la práctica, qué es un sistema de referencia inercial.
2. **Ley fundamental:** la fuerza neta es igual a la tasa de cambio del momento lineal. Con masa constante, $F = ma$.
3. **Acción y reacción:** si A ejerce una fuerza sobre B, B ejerce sobre A una fuerza de igual módulo y sentido opuesto. Las dos fuerzas actúan sobre **cuerpos distintos**, por eso no se cancelan entre sí.

Son válidas para velocidades mucho menores que la de la luz y escalas donde los efectos cuánticos son despreciables.`,
    formalism: r`$$\sum \vec F = \frac{d\vec p}{dt} \;\overset{m\,\text{cte}}{=}\; m\vec a, \qquad \vec F_{AB} = -\vec F_{BA}$$

Unidad: $1\ \mathrm{N} = 1\ \mathrm{kg\,m/s^2}$. Peso cerca de la superficie terrestre: $P = mg$, con $g \approx 9.81\ \mathrm{m/s^2}$ (valor estándar $9.80665$).`,
    examples: r`- Una fuerza neta de 10 N sobre una masa de 2 kg produce $a = 5\ \mathrm{m/s^2}$.
- Un libro sobre una mesa: el par acción-reacción del peso es la atracción gravitatoria que el libro ejerce sobre la Tierra, **no** la normal de la mesa.`,
    observations: '',
    relatedIds: ['c-momento', 'c-energia', 'c-vectores', 'c-derivadas-integrales'],
  },
  {
    id: 'c-energia',
    title: 'Conservación de la energía',
    discipline: 'Física',
    tags: ['energía', 'trabajo', 'termodinámica', 'mecánica'],
    summary:
      'En un sistema aislado la energía total se mantiene constante: puede transformarse entre formas, pero no crearse ni destruirse.',
    explanation: r`La energía se presenta en varias formas: cinética, potencial (gravitatoria, elástica, eléctrica), interna, química, radiante. La ley de conservación dice que la suma total en un sistema aislado no cambia.

En mecánica, si solo actúan fuerzas **conservativas**, se conserva la energía mecánica $K + U$. Las fuerzas no conservativas (rozamiento) transforman energía mecánica en energía interna; la energía total sigue conservándose.

El **primer principio de la termodinámica** es la misma ley aplicada a sistemas con intercambio de calor y trabajo.`,
    formalism: r`Energía cinética: $K = \tfrac12 m v^2$. Potencial gravitatoria cerca de la superficie: $U = mgh$.

Teorema trabajo-energía: $W_{\text{neto}} = \Delta K$.

Primer principio (convención: $W$ = trabajo realizado **por** el sistema):
$$\Delta U = Q - W$$
(Algunos textos usan $\Delta U = Q + W$ con $W$ realizado **sobre** el sistema.)`,
    examples: r`- Caída libre desde 5 m sin rozamiento: $mgh = \tfrac12 mv^2 \Rightarrow v = \sqrt{2gh} \approx 9.90\ \mathrm{m/s}$.
- Una resistencia transforma energía eléctrica en energía interna (efecto Joule): $P = I^2 R$.`,
    observations: 'Verificar siempre la convención de signos del libro que estés usando.',
    relatedIds: ['c-newton', 'c-momento', 'c-entropia-termo', 'c-ohm'],
  },
  {
    id: 'c-momento',
    title: 'Momento lineal',
    discipline: 'Física',
    tags: ['mecánica', 'colisiones', 'conservación'],
    summary:
      'Producto de la masa por la velocidad de un cuerpo. Se conserva en un sistema cuando la fuerza externa neta es nula.',
    explanation: r`El momento lineal (o cantidad de movimiento) es una magnitud **vectorial**. La segunda ley de Newton, en su forma general, dice que la fuerza neta es la derivada temporal del momento.

Si la fuerza externa neta sobre un sistema es cero, su momento total se conserva. Esto es especialmente útil en colisiones: el momento se conserva siempre (si las fuerzas externas son despreciables durante el choque), pero la energía cinética solo se conserva en choques **elásticos**.`,
    formalism: r`$$\vec p = m\vec v, \qquad \vec F_{\text{neta}} = \frac{d\vec p}{dt}, \qquad \vec J = \int \vec F\,dt = \Delta \vec p$$

Unidad: $\mathrm{kg\,m/s} = \mathrm{N\,s}$. A velocidades relativistas: $\vec p = \gamma m \vec v$.`,
    examples: r`- Choque perfectamente inelástico: un auto de 1000 kg a 20 m/s choca y queda unido a otro de 1500 kg en reposo. $v_f = \dfrac{1000\cdot 20}{2500} = 8\ \mathrm{m/s}$. La energía cinética **no** se conserva.`,
    observations: '',
    relatedIds: ['c-newton', 'c-energia', 'c-vectores'],
  },
  {
    id: 'c-funciones-limites',
    title: 'Funciones y límites',
    discipline: 'Matemática',
    tags: ['análisis', 'cálculo', 'continuidad'],
    summary:
      'Una función asigna a cada elemento de un dominio un único elemento del codominio. El límite describe el comportamiento de f(x) cuando x se acerca a un punto.',
    explanation: r`Una **función** $f: A \to B$ asigna a cada $x \in A$ exactamente un $f(x) \in B$. El dominio y el codominio son parte de la definición.

El **límite** formaliza la idea de "acercarse": $f(x)$ puede hacerse tan cercano a $L$ como se quiera tomando $x$ suficientemente cerca de $a$ (sin ser igual a $a$). El valor $f(a)$ ni siquiera necesita existir.

Una función es **continua** en $a$ si el límite existe y coincide con $f(a)$.`,
    formalism: r`Definición $\varepsilon$-$\delta$:
$$\lim_{x\to a} f(x) = L \iff \forall \varepsilon>0\ \exists \delta>0:\ 0<|x-a|<\delta \Rightarrow |f(x)-L|<\varepsilon$$

El límite existe si y solo si existen los límites laterales y son iguales.`,
    examples: r`- $\displaystyle\lim_{x\to1}\frac{x^2-1}{x-1} = \lim_{x\to1}(x+1) = 2$ (aunque la expresión no está definida en $x=1$).
- $\displaystyle\lim_{x\to0}\frac{\sin x}{x} = 1$ (con $x$ en radianes).
- $f(x) = 1/x$ no tiene límite en 0: los laterales son $+\infty$ y $-\infty$.`,
    observations: '',
    relatedIds: ['c-derivadas-integrales'],
  },
  {
    id: 'c-derivadas-integrales',
    title: 'Derivadas e integrales',
    discipline: 'Matemática',
    tags: ['análisis', 'cálculo'],
    summary:
      'La derivada mide la tasa de cambio instantánea; la integral definida acumula cantidades. El teorema fundamental del cálculo las vincula.',
    explanation: r`La **derivada** de $f$ en $x$ es la pendiente de la recta tangente: el límite del cociente incremental. Físicamente: velocidad como derivada de la posición, corriente en un capacitor como $C\,dv/dt$.

La **integral definida** es el límite de sumas de Riemann; representa área con signo o acumulación (desplazamiento a partir de la velocidad, carga a partir de la corriente).

El **teorema fundamental del cálculo** establece que derivar e integrar son operaciones inversas (bajo hipótesis de continuidad).`,
    formalism: r`$$f'(x) = \lim_{h\to0}\frac{f(x+h)-f(x)}{h}$$

Reglas: $(fg)' = f'g + fg'$, $(f\circ g)' = (f'\circ g)\,g'$, $(x^n)' = n x^{n-1}$.

TFC: si $f$ es continua en $[a,b]$ y $F' = f$, entonces
$$\int_a^b f(x)\,dx = F(b) - F(a)$$`,
    examples: r`- $\dfrac{d}{dx}x^3 = 3x^2$
- $\displaystyle\int_0^1 x^2\,dx = \frac{1}{3}$
- $\dfrac{d}{dx}\sin x = \cos x$ (en radianes)`,
    observations: '',
    relatedIds: ['c-funciones-limites', 'c-newton'],
  },
  {
    id: 'c-vectores',
    title: 'Vectores',
    discipline: 'Matemática',
    tags: ['álgebra lineal', 'geometría'],
    summary:
      'Elementos de un espacio vectorial; en física, magnitudes con módulo, dirección y sentido. Se operan con suma, producto por escalar, producto escalar y vectorial.',
    explanation: r`En $\mathbb{R}^n$ un vector es una n-upla de números. Geométricamente (en 2D y 3D) representa un desplazamiento con **módulo**, dirección y sentido.

- El **producto escalar** devuelve un número y mide cuánto "apuntan en la misma dirección" dos vectores. Si es 0 (y ambos son no nulos) son ortogonales.
- El **producto vectorial** (solo en $\mathbb{R}^3$) devuelve un vector perpendicular a ambos, con módulo igual al área del paralelogramo que forman. No es conmutativo: $\vec a\times\vec b = -\vec b\times\vec a$.`,
    formalism: r`$$|\vec a| = \sqrt{\sum a_i^2}, \qquad \hat a = \frac{\vec a}{|\vec a|}$$
$$\vec a\cdot\vec b = \sum a_i b_i = |\vec a||\vec b|\cos\theta$$
$$\vec a\times\vec b = (a_2b_3-a_3b_2,\ a_3b_1-a_1b_3,\ a_1b_2-a_2b_1), \quad |\vec a\times\vec b| = |\vec a||\vec b|\sin\theta$$`,
    examples: r`Con $\vec a=(1,2,3)$ y $\vec b=(4,5,6)$: $\vec a\cdot\vec b = 32$, $\vec a\times\vec b = (-3,6,-3)$, $|\vec a| = \sqrt{14}\approx3.742$.`,
    observations: 'Calculadora en Workbench → Matemática → Vectores.',
    relatedIds: ['c-newton', 'c-momento', 'c-complejos'],
  },
  {
    id: 'c-complejos',
    title: 'Números complejos',
    discipline: 'Matemática',
    tags: ['álgebra', 'fasores', 'electrónica'],
    summary:
      'Números de la forma a + bi con i² = −1. Permiten resolver cualquier ecuación polinómica y son la herramienta estándar para analizar circuitos en régimen sinusoidal.',
    explanation: r`Un complejo $z = a + bi$ tiene parte real $a$ y parte imaginaria $b$. Se representa como un punto (o vector) en el plano complejo.

La **forma polar** expresa $z$ por su módulo $|z|$ y su argumento $\theta$. Multiplicar complejos multiplica los módulos y suma los argumentos, lo que hace muy cómodo trabajar con rotaciones y señales sinusoidales.

En electrónica se suele escribir $j$ en lugar de $i$ (porque $i$ denota corriente). La impedancia de un capacitor es $Z_C = \dfrac{1}{j\omega C}$.`,
    formalism: r`$$|z| = \sqrt{a^2+b^2}, \quad \bar z = a - bi, \quad z\bar z = |z|^2$$
Fórmula de Euler: $e^{i\theta} = \cos\theta + i\sin\theta$, por lo que $z = |z|e^{i\theta}$.

Identidad de Euler: $e^{i\pi} + 1 = 0$.`,
    examples: r`- $(2+3i)(1-i) = 5 + i$
- $|3+4i| = 5$
- $\sqrt{-4} = 2i$ (raíz principal). La calculadora científica de NEXUS admite complejos: probá sqrt(-4) o (2+3i)*(1-i).`,
    observations: '',
    relatedIds: ['c-vectores', 'c-ohm'],
  },
  {
    id: 'c-probabilidad',
    title: 'Probabilidad',
    discipline: 'Matemática',
    tags: ['estadística', 'azar'],
    summary:
      'Medida normalizada de la posibilidad de los eventos, axiomatizada por Kolmogorov. Base de la estadística, la teoría de la información y la física estadística.',
    explanation: r`Un **espacio de probabilidad** consta de un espacio muestral $\Omega$, una colección de eventos y una medida $P$ que asigna a cada evento un número entre 0 y 1.

La **probabilidad condicional** $P(A\mid B)$ actualiza la probabilidad de $A$ sabiendo que ocurrió $B$. Dos eventos son **independientes** si conocer uno no cambia la probabilidad del otro.

El **teorema de Bayes** permite invertir condicionales y es la base de la inferencia bayesiana.`,
    formalism: r`Axiomas: $P(A)\ge0$, $P(\Omega)=1$, aditividad para eventos disjuntos.

$$P(A\cup B) = P(A)+P(B)-P(A\cap B)$$
$$P(A\mid B) = \frac{P(A\cap B)}{P(B)}, \qquad P(A\mid B) = \frac{P(B\mid A)P(A)}{P(B)}$$

Independencia: $P(A\cap B) = P(A)P(B)$. Valor esperado discreto: $E[X] = \sum_i x_i p_i$.`,
    examples: r`- Probabilidad de que la suma de dos dados sea 7: $6/36 = 1/6$.
- Valor esperado de un dado justo: $3.5$.`,
    observations: '',
    relatedIds: ['c-entropia-shannon', 'c-entropia-termo'],
  },
  {
    id: 'c-notacion-cientifica',
    title: 'Notación científica',
    discipline: 'Matemática',
    tags: ['cifras significativas', 'prefijos SI', 'medición'],
    summary:
      'Forma de escribir números como a × 10ⁿ con 1 ≤ |a| < 10. La notación de ingeniería usa exponentes múltiplos de 3, alineados con los prefijos del SI.',
    explanation: r`La notación científica hace explícito el **orden de magnitud** y las **cifras significativas** de un número.

La **notación de ingeniería** restringe el exponente a múltiplos de 3, lo que permite leer directamente el prefijo SI: $10^{-3}$ = mili (m), $10^{-6}$ = micro (µ), $10^{-9}$ = nano (n), $10^{3}$ = kilo (k), $10^{6}$ = mega (M).

Al multiplicar o dividir, el resultado no debería tener más cifras significativas que el dato menos preciso.`,
    formalism: r`$$x = a\times10^{n}, \quad 1\le|a|<10,\ n\in\mathbb{Z}$$
$(a\times10^m)(b\times10^n) = ab\times10^{m+n}$`,
    examples: r`- $0.000470\ \mathrm{F} = 4.70\times10^{-4}\ \mathrm{F} = 470\ \mu\mathrm{F}$ (tres cifras significativas).
- Velocidad de la luz: $c = 299\,792\,458\ \mathrm{m/s} \approx 3.00\times10^{8}\ \mathrm{m/s}$ (valor exacto por definición).
- Constante de Avogadro: $N_A = 6.02214076\times10^{23}\ \mathrm{mol^{-1}}$ (exacta en el SI desde 2019).`,
    observations: 'Herramienta en Workbench → Matemática → Notación.',
    relatedIds: ['c-atomo'],
  },
  {
    id: 'c-atomo',
    title: 'Estructura atómica',
    discipline: 'Química',
    tags: ['átomo', 'núcleo', 'electrones', 'química'],
    summary:
      'Un átomo está formado por un núcleo muy pequeño y denso (protones y neutrones) rodeado de electrones descritos por orbitales cuánticos.',
    explanation: r`El **número atómico** $Z$ (cantidad de protones) identifica al elemento. El **número másico** $A$ es la cantidad total de nucleones (protones + neutrones). Átomos del mismo elemento con distinto número de neutrones son **isótopos**.

El núcleo concentra casi toda la masa, pero ocupa una fracción ínfima del volumen: un átomo mide del orden de $10^{-10}$ m y un núcleo del orden de $10^{-15}$–$10^{-14}$ m.

Los electrones no siguen órbitas definidas: se describen mediante **orbitales**, caracterizados por números cuánticos $n$, $\ell$, $m_\ell$, $m_s$. El principio de exclusión de Pauli impide que dos electrones de un átomo compartan los cuatro. El modelo de Bohr es una aproximación histórica útil para el hidrógeno, pero no describe correctamente átomos multielectrónicos.`,
    formalism: r`Notación: $\,^{A}_{Z}\mathrm{X}$, con $N = A - Z$ neutrones.

Carga elemental: $e = 1.602176634\times10^{-19}\ \mathrm{C}$ (exacta). Masas aproximadas: $m_p \approx 1.6726\times10^{-27}$ kg, $m_n \approx 1.6749\times10^{-27}$ kg, $m_e \approx 9.109\times10^{-31}$ kg.

Niveles del hidrógeno (modelo de Bohr / Schrödinger): $E_n \approx -\dfrac{13.6\ \mathrm{eV}}{n^2}$.`,
    examples: r`- Carbono-12: $Z = 6$, $A = 12$, $N = 6$. Carbono-14: $N = 8$.
- Configuración electrónica del oxígeno ($Z=8$): $1s^2\,2s^2\,2p^4$.`,
    observations: '',
    relatedIds: ['c-particulas', 'c-notacion-cientifica'],
  },
  {
    id: 'c-particulas',
    title: 'Quarks y partículas elementales',
    discipline: 'Física',
    tags: ['modelo estándar', 'física de partículas'],
    summary:
      'El Modelo Estándar clasifica las partículas elementales conocidas en fermiones (quarks y leptones) y bosones (portadores de fuerzas y el Higgs).',
    explanation: r`**Fermiones** (constituyen la materia), en tres generaciones:
- Quarks: up, down, charm, strange, top, bottom.
- Leptones: electrón, muón, tau y sus neutrinos.

**Bosones de gauge** (median interacciones): fotón (electromagnética), gluones (fuerte), $W^\pm$ y $Z$ (débil). Además, el **bosón de Higgs**, asociado al mecanismo que da masa a las partículas elementales.

Los quarks tienen **carga de color** y están confinados: no se observan aislados, sino en hadrones. Los **bariones** tienen tres quarks (protón $uud$, neutrón $udd$) y los **mesones** un quark y un antiquark.

Límites del modelo: no incluye la gravedad, y en su forma mínima no explica la masa de los neutrinos (que sí existe, por las oscilaciones observadas) ni la materia oscura.`,
    formalism: r`Cargas eléctricas (en unidades de $e$): $u, c, t$: $+\tfrac23$; $d, s, b$: $-\tfrac13$.

Protón: $\tfrac23+\tfrac23-\tfrac13 = +1$. Neutrón: $\tfrac23-\tfrac13-\tfrac13 = 0$.`,
    examples: r`- En la desintegración beta menos, un quark $d$ de un neutrón se convierte en $u$ emitiendo un $W^-$ virtual, que decae en un electrón y un antineutrino electrónico: $n \to p + e^- + \bar\nu_e$.`,
    observations: '',
    relatedIds: ['c-atomo'],
  },
  {
    id: 'c-ohm',
    title: 'Ley de Ohm',
    discipline: 'Electrónica',
    tags: ['circuitos', 'resistencia', 'electrónica'],
    summary:
      'En un conductor óhmico la corriente es proporcional a la tensión aplicada: V = I·R.',
    explanation: r`La ley de Ohm es una relación **empírica** válida para materiales óhmicos (resistores, conductores metálicos a temperatura constante). No es una ley universal: diodos, transistores o lámparas incandescentes no la cumplen con $R$ constante.

La potencia disipada en un elemento es $P = VI$; en una resistencia puede escribirse también como $I^2R$ o $V^2/R$.`,
    formalism: r`$$V = IR, \qquad P = VI = I^2R = \frac{V^2}{R}$$
Unidades: $1\ \Omega = 1\ \mathrm{V/A}$, $1\ \mathrm{W} = 1\ \mathrm{V\,A}$.`,
    examples: r`- Una resistencia de 1 kΩ con 5 V: $I = 5\ \mathrm{mA}$, $P = 25\ \mathrm{mW}$.`,
    observations: '',
    relatedIds: ['c-energia', 'c-complejos'],
  },
]
