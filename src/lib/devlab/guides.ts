import type { LangId } from './languages'

/** oficial: guía o documentación del lenguaje. comunidad: convención ampliamente aceptada. proyecto: preferencia de EXODIA. */
export type GuideSource = 'oficial' | 'comunidad' | 'proyecto'

export const GUIDE_CATEGORIES = [
  { id: 'nombres', label: 'Nombres' },
  { id: 'formato', label: 'Formato' },
  { id: 'variables', label: 'Variables y tipos' },
  { id: 'funciones', label: 'Funciones' },
  { id: 'errores', label: 'Errores' },
  { id: 'colecciones', label: 'Colecciones' },
  { id: 'comentarios', label: 'Comentarios' },
  { id: 'legibilidad', label: 'Legibilidad' },
  { id: 'principiante', label: 'Errores de principiante' },
  { id: 'particular', label: 'Particularidades' },
] as const
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]['id']

export interface GuideEntry {
  lang: LangId
  cat: GuideCategory
  title: string
  text: string
  source: GuideSource
  /** Documento de referencia, para que el usuario lo busque. */
  ref?: string
  /** Funciona, pero es difícil de leer o mantener. */
  works?: string
  /** Versión recomendada. */
  better?: string
}

export const GUIDE_REFS: Record<LangId, string> = {
  python: 'PEP 8 y PEP 257',
  javascript: 'MDN Web Docs; guías de estilo de Google y Airbnb',
  typescript: 'TypeScript Handbook; guía de estilo de Google para TypeScript',
  java: 'Oracle Code Conventions; Google Java Style Guide',
  c: 'ISO C11; SEI CERT C Coding Standard',
  cpp: 'C++ Core Guidelines (Stroustrup y Sutter)',
  csharp: 'Convenciones de código de C# (Microsoft Learn)',
  go: 'Effective Go; Go Code Review Comments; gofmt',
  rust: 'Rust API Guidelines; rustfmt; Clippy',
  php: 'PSR-1 y PSR-12 (PHP-FIG)',
  sql: 'sqlstyle.guide (Simon Holywell); documentación de SQLite',
}

const E = (lang: LangId, cat: GuideCategory, source: GuideSource, title: string, text: string, extra: Partial<GuideEntry> = {}): GuideEntry => ({ lang, cat, source, title, text, ...extra })

export const GUIDES: GuideEntry[] = [
  // ---------------- Python ----------------
  E('python', 'nombres', 'oficial', 'snake_case para funciones y variables', 'Funciones, variables y módulos en minúscula con guiones bajos; clases en CapWords; constantes en MAYÚSCULAS.', { ref: 'PEP 8 · Naming Conventions', works: 'def CalcularPromedio(L):\n    S = 0', better: 'def calcular_promedio(valores):\n    total = 0' }),
  E('python', 'formato', 'oficial', '4 espacios por nivel', 'Indentación de 4 espacios, nunca tabs mezclados. Líneas de hasta 79 caracteres (muchos proyectos aceptan 88 o 100). Dos líneas en blanco entre funciones de nivel superior.', { ref: 'PEP 8 · Code Lay-out' }),
  E('python', 'formato', 'comunidad', 'Formateador automático', 'Black o Ruff format eliminan las discusiones de estilo: se ejecutan y listo.'),
  E('python', 'variables', 'oficial', 'Anotaciones de tipo', 'def area(radio: float) -> float documenta el contrato. Python no las verifica al ejecutar; herramientas como mypy sí.', { ref: 'PEP 484' }),
  E('python', 'funciones', 'oficial', 'Docstrings', 'Cada función pública lleva una cadena de documentación con triple comilla: primera línea breve en imperativo o descriptiva, luego detalles.', { ref: 'PEP 257', better: 'def area(radio: float) -> float:\n    """Calcula el área de un círculo."""' }),
  E('python', 'funciones', 'comunidad', 'Argumentos mutables por defecto', 'Un valor por defecto se evalúa una sola vez: una lista por defecto se comparte entre llamadas.', { works: 'def agregar(x, lista=[]):\n    lista.append(x)\n    return lista', better: 'def agregar(x, lista=None):\n    if lista is None:\n        lista = []\n    lista.append(x)\n    return lista' }),
  E('python', 'errores', 'oficial', 'Excepciones específicas', 'Lanzar ValueError, TypeError, etc. y capturar solo lo que se sabe manejar. Un except: vacío oculta errores reales.', { works: 'try:\n    x = int(texto)\nexcept:\n    x = 0', better: 'try:\n    x = int(texto)\nexcept ValueError:\n    x = 0' }),
  E('python', 'colecciones', 'comunidad', 'Recorrer sin índices', 'for x in lista es más claro que for i in range(len(lista)); si hace falta el índice, enumerate.', { works: 'for i in range(len(notas)):\n    print(notas[i])', better: 'for nota in notas:\n    print(nota)' }),
  E('python', 'colecciones', 'comunidad', 'Comprensiones con moderación', '[x * 2 for x in xs] es idiomático; una comprensión con dos for y un if anidado suele leerse mejor como bucle.'),
  E('python', 'comentarios', 'oficial', 'Comentarios que explican el porqué', 'Comentarios en oraciones completas; no repetir lo que el código ya dice.', { ref: 'PEP 8 · Comments', works: 'x = x + 1  # suma 1 a x', better: 'x = x + 1  # compensa el índice que empieza en 0' }),
  E('python', 'legibilidad', 'oficial', 'Comparar con None usando is', 'is None / is not None, nunca == None.', { ref: 'PEP 8 · Programming Recommendations' }),
  E('python', 'principiante', 'comunidad', 'Confundir = con ==', '= asigna; == compara. En un if, Python da error de sintaxis si se usa =, lo cual ayuda.'),
  E('python', 'principiante', 'comunidad', 'Esperar que / dé entero', 'En Python 3, 7 / 2 es 3.5. Para la división entera se usa //.'),
  E('python', 'particular', 'oficial', 'Enteros sin límite', 'int crece lo necesario: factorial(100) es exacto. En C, Java o Go se desbordaría.'),
  E('python', 'particular', 'proyecto', 'Pruebas al final del archivo', 'El código generado ejecuta las pruebas bajo if __name__ == "__main__": para que el archivo pueda importarse sin efectos.'),

  // ---------------- JavaScript ----------------
  E('javascript', 'nombres', 'comunidad', 'camelCase', 'Variables y funciones en camelCase, clases en PascalCase, constantes globales en MAYÚSCULAS.', { works: 'function calcular_area(B, H) {}', better: 'function calcularArea(base, altura) {}' }),
  E('javascript', 'variables', 'comunidad', 'const por defecto, let si cambia, nunca var', 'var tiene alcance de función y se "eleva"; let y const tienen alcance de bloque.', { works: 'var total = 0\nfor (var i = 0; i < n; i++) total += i', better: 'let total = 0\nfor (let i = 0; i < n; i++) total += i' }),
  E('javascript', 'variables', 'oficial', 'Igualdad estricta', '=== y !== no convierten tipos. == aplica reglas de conversión difíciles de recordar.', { ref: 'MDN · Equality comparisons' }),
  E('javascript', 'formato', 'comunidad', 'Prettier', 'Un formateador automático (Prettier) fija comillas, punto y coma y ancho de línea. Lo importante es que todo el proyecto use el mismo.'),
  E('javascript', 'funciones', 'comunidad', 'Funciones pequeñas y puras', 'Una función que recibe datos y devuelve un resultado, sin modificar variables externas, es fácil de probar.'),
  E('javascript', 'funciones', 'oficial', 'JSDoc', '/** ... */ con @param y @returns documenta y permite que el editor muestre los tipos.', { ref: 'jsdoc.app' }),
  E('javascript', 'errores', 'oficial', 'Lanzar objetos Error', 'throw new RangeError("mensaje"), nunca throw "mensaje": un Error conserva la pila de llamadas.', { works: 'throw "dato inválido"', better: 'throw new RangeError("dato inválido")' }),
  E('javascript', 'colecciones', 'comunidad', 'Métodos de arreglo', 'map, filter y reduce expresan la intención; un for...of es igual de válido cuando hay lógica con varias ramas.'),
  E('javascript', 'principiante', 'comunidad', 'for...in en arreglos', 'for...in recorre claves (como texto) y propiedades heredadas; para valores se usa for...of.'),
  E('javascript', 'principiante', 'comunidad', 'Sumar textos', '"2" + 2 es "22". Convertir explícitamente con Number(texto) antes de operar.'),
  E('javascript', 'particular', 'oficial', 'Un solo tipo numérico', 'number es punto flotante de 64 bits: 0.1 + 0.2 !== 0.3 y los enteros son exactos solo hasta 2^53 − 1.', { ref: 'MDN · Number.MAX_SAFE_INTEGER' }),

  // ---------------- TypeScript ----------------
  E('typescript', 'nombres', 'oficial', 'Convenciones de JavaScript', 'camelCase para valores, PascalCase para tipos e interfaces. No se usa el prefijo I en interfaces.', { ref: 'Google TypeScript Style Guide' }),
  E('typescript', 'variables', 'oficial', 'Evitar any', 'any desactiva el chequeo. unknown obliga a comprobar el tipo antes de usar el valor.', { works: 'function f(x: any) { return x.length }', better: 'function f(x: unknown) {\n  return typeof x === "string" ? x.length : 0\n}' }),
  E('typescript', 'variables', 'comunidad', 'Dejar que el compilador infiera', 'const total = 0 ya es number; anotar tipos en parámetros y retornos públicos, no en cada variable local.'),
  E('typescript', 'funciones', 'comunidad', 'Tipos de retorno explícitos en funciones exportadas', 'Fijan el contrato: un cambio accidental en la implementación produce un error en lugar de cambiar el tipo en silencio.'),
  E('typescript', 'colecciones', 'oficial', 'readonly', 'readonly number[] impide modificar la lista recibida; documenta y protege.', { ref: 'TypeScript Handbook · Object Types' }),
  E('typescript', 'errores', 'comunidad', 'Errores como valores', 'Para errores esperables, devolver una unión { ok: true; value } | { ok: false; error } hace que el compilador obligue a manejarlos.'),
  E('typescript', 'formato', 'proyecto', 'strict siempre activo', 'EXODIA compila con strict y noUncheckedIndexedAccess: lista[i] puede ser undefined y hay que contemplarlo.'),
  E('typescript', 'principiante', 'comunidad', 'Creer que los tipos validan datos', 'Los tipos desaparecen al compilar. Datos de un formulario o de un archivo se validan en tiempo de ejecución (por ejemplo con Zod).'),
  E('typescript', 'particular', 'oficial', 'Tipado estructural', 'Dos tipos con la misma forma son compatibles aunque tengan distinto nombre.'),

  // ---------------- Java ----------------
  E('java', 'nombres', 'oficial', 'camelCase y PascalCase', 'Clases en PascalCase, métodos y variables en camelCase, constantes static final en MAYÚSCULAS_CON_GUIONES.', { ref: 'Google Java Style · 5 Naming', works: 'public static double Area_Circulo(double R)', better: 'public static double areaCirculo(double radio)' }),
  E('java', 'formato', 'oficial', 'Llaves estilo K&R', 'La llave de apertura en la misma línea; siempre llaves aunque el bloque tenga una sola instrucción. Google usa 2 espacios; muchos proyectos, 4.', { ref: 'Google Java Style · 4.1' }),
  E('java', 'variables', 'comunidad', 'Tipos primitivos para cálculos', 'long y double son valores; Long y Double son objetos que pueden ser null y se comparan con equals.'),
  E('java', 'variables', 'oficial', 'var con criterio', 'var (Java 10+) infiere el tipo local; usarlo cuando el tipo es obvio por el lado derecho.'),
  E('java', 'funciones', 'oficial', 'Javadoc', '/** ... */ con @param, @return y @throws en métodos públicos.', { ref: 'How to Write Doc Comments for the Javadoc Tool' }),
  E('java', 'errores', 'comunidad', 'Excepciones no verificadas para argumentos inválidos', 'IllegalArgumentException para datos incorrectos del llamador; no capturar Exception de forma genérica.', { works: 'try { ... } catch (Exception e) { }', better: 'try { ... } catch (IllegalArgumentException e) {\n    System.err.println(e.getMessage());\n}' }),
  E('java', 'colecciones', 'comunidad', 'Interfaces en las firmas', 'Recibir List<Double> en lugar de ArrayList<Double> permite pasar cualquier implementación.'),
  E('java', 'principiante', 'comunidad', 'Comparar String con ==', '== compara referencias; .equals() compara contenido.', { works: 'if (clase == "par")', better: 'if (clase.equals("par"))' }),
  E('java', 'principiante', 'comunidad', 'División entera accidental', '1 / 2 es 0 porque ambos son enteros. Convertir uno: (double) a / b.'),
  E('java', 'particular', 'oficial', 'Un archivo por clase pública', 'El archivo debe llamarse como la clase pública que contiene.'),

  // ---------------- C ----------------
  E('c', 'nombres', 'comunidad', 'snake_case', 'Funciones y variables en snake_case; macros y constantes del preprocesador en MAYÚSCULAS.', { works: 'double AreaCirculo(double R);', better: 'double area_circulo(double radio);' }),
  E('c', 'formato', 'comunidad', 'Llaves siempre', 'Usar llaves incluso en bloques de una línea evita errores al agregar instrucciones después.', { works: 'if (x < 0)\n    x = -x;\n    contador++;', better: 'if (x < 0) {\n    x = -x;\n}\ncontador++;' }),
  E('c', 'variables', 'oficial', 'Tipos de ancho fijo', '<stdint.h> ofrece int64_t, uint8_t, etc. cuando el tamaño importa; long varía entre plataformas (32 bits en Windows).'),
  E('c', 'variables', 'comunidad', 'Inicializar siempre', 'Una variable local sin inicializar contiene basura; leerla es comportamiento indefinido.', { ref: 'SEI CERT C · EXP33-C' }),
  E('c', 'funciones', 'comunidad', 'const en punteros de entrada', 'const double *valores promete que la función no modifica los datos.'),
  E('c', 'errores', 'comunidad', 'Códigos de retorno', 'C no tiene excepciones: devolver un código (bool o int) y el resultado por un puntero de salida. Quien llama debe revisar el código.'),
  E('c', 'colecciones', 'oficial', 'Los arreglos no conocen su tamaño', 'Al pasar un arreglo a una función se convierte en puntero: hay que pasar la longitud aparte.', { ref: 'ISO C11 §6.3.2.1' }),
  E('c', 'principiante', 'comunidad', 'Salirse del arreglo', 'for (i = 0; i <= n; i++) lee una posición de más. El compilador no lo detecta.'),
  E('c', 'principiante', 'comunidad', 'Formato de printf incorrecto', '%d para long long imprime basura; usar %lld. Compilar con -Wall avisa.'),
  E('c', 'particular', 'oficial', 'Comportamiento indefinido', 'El desborde de enteros con signo, leer fuera de un arreglo o usar memoria liberada no tienen resultado definido: el programa puede hacer cualquier cosa.', { ref: 'SEI CERT C · INT32-C' }),

  // ---------------- C++ ----------------
  E('cpp', 'nombres', 'comunidad', 'Sin un estándar único', 'La biblioteca estándar usa snake_case; Google usa PascalCase para funciones. Lo importante es la consistencia dentro del proyecto.', { ref: 'C++ Core Guidelines · NL' }),
  E('cpp', 'variables', 'oficial', 'const por defecto', 'Declarar const lo que no cambia; el compilador impide modificaciones accidentales.', { ref: 'C++ Core Guidelines · Con.1' }),
  E('cpp', 'variables', 'oficial', 'Inicialización con llaves', 'int x{5} evita conversiones con pérdida: double d = 2.7; int n{d}; no compila.', { ref: 'C++ Core Guidelines · ES.23' }),
  E('cpp', 'funciones', 'oficial', 'Pasar por referencia constante', 'Objetos grandes como std::vector se reciben como const std::vector<double>& para no copiarlos.', { ref: 'C++ Core Guidelines · F.16', works: 'double suma(std::vector<double> v)', better: 'double suma(const std::vector<double>& v)' }),
  E('cpp', 'errores', 'oficial', 'Excepciones para errores', 'throw std::invalid_argument(...); capturar por referencia: catch (const std::exception& e).', { ref: 'C++ Core Guidelines · E.15' }),
  E('cpp', 'colecciones', 'oficial', 'std::vector antes que arreglos crudos', 'vector conoce su tamaño, libera su memoria y se puede recorrer con for de rango.', { ref: 'C++ Core Guidelines · SL.con.2' }),
  E('cpp', 'principiante', 'comunidad', 'using namespace std en encabezados', 'Contamina el espacio de nombres de todo el que incluya el archivo. Escribir std:: es explícito.'),
  E('cpp', 'principiante', 'comunidad', 'size() - 1 con vector vacío', 'size() es sin signo: 0 - 1 da un número enorme y el bucle se sale de rango.'),
  E('cpp', 'particular', 'oficial', 'RAII', 'Los recursos se liberan cuando el objeto sale de alcance; casi nunca hace falta new/delete.', { ref: 'C++ Core Guidelines · R.1' }),

  // ---------------- C# ----------------
  E('csharp', 'nombres', 'oficial', 'PascalCase para miembros públicos', 'Métodos, propiedades y clases en PascalCase; parámetros y locales en camelCase; campos privados con _camelCase.', { ref: 'Microsoft Learn · C# identifier names', works: 'public static double areaCirculo(double Radio)', better: 'public static double AreaCirculo(double radio)' }),
  E('csharp', 'formato', 'oficial', 'Llaves en línea propia (Allman)', 'La convención de Microsoft pone cada llave en su propia línea, con 4 espacios.', { ref: 'Microsoft Learn · C# coding conventions' }),
  E('csharp', 'variables', 'oficial', 'var cuando el tipo es evidente', 'var lista = new List<double>(); para tipos simples como int, preferir el nombre explícito.'),
  E('csharp', 'funciones', 'oficial', 'Comentarios XML', '/// <summary>, <param> y <returns> generan documentación e IntelliSense.'),
  E('csharp', 'errores', 'oficial', 'Excepciones de argumentos', 'ArgumentException, ArgumentNullException y ArgumentOutOfRangeException para datos inválidos.', { ref: '.NET · Best practices for exceptions' }),
  E('csharp', 'colecciones', 'comunidad', 'List<T> y LINQ', 'valores.Max() o valores.Average() existen en LINQ; implementarlos a mano sirve para aprender el algoritmo.'),
  E('csharp', 'principiante', 'comunidad', 'Cultura del sistema', 'double.Parse("2.5") falla en sistemas en español, que esperan coma. Usar CultureInfo.InvariantCulture para datos.'),
  E('csharp', 'particular', 'oficial', 'Identificadores con @', 'Una palabra reservada puede usarse como nombre anteponiendo @ (@base, @class).'),

  // ---------------- Go ----------------
  E('go', 'nombres', 'oficial', 'La mayúscula exporta', 'Un nombre que empieza con mayúscula es público fuera del paquete. Se usa MixedCaps, nunca guiones bajos.', { ref: 'Effective Go · Names', works: 'func area_circulo(r float64) float64', better: 'func areaCirculo(radio float64) float64' }),
  E('go', 'nombres', 'oficial', 'Nombres cortos en alcances cortos', 'i, v o err están bien en un bucle o bloque pequeño; cuanto más lejos se usa, más descriptivo el nombre.', { ref: 'Go Code Review Comments · Variable Names' }),
  E('go', 'formato', 'oficial', 'gofmt no se negocia', 'El formato lo decide gofmt: tabs, espacios y alineación. Todo el código Go del mundo se ve igual.'),
  E('go', 'errores', 'oficial', 'Errores como valores', 'Las funciones que fallan devuelven (valor, error). Revisar err inmediatamente; no ignorarlo con _.', { ref: 'Effective Go · Errors', works: 'r, _ := dividir(a, b)', better: 'r, err := dividir(a, b)\nif err != nil {\n\treturn err\n}' }),
  E('go', 'errores', 'oficial', 'Mensajes en minúscula', 'Los mensajes de error no empiezan con mayúscula ni terminan en punto, porque se suelen concatenar.', { ref: 'Go Code Review Comments · Error Strings' }),
  E('go', 'colecciones', 'oficial', 'Slices', '[]float64 es una vista sobre un arreglo; len() da la longitud. range devuelve índice y valor.'),
  E('go', 'variables', 'oficial', 'Sin conversiones implícitas', 'int64 + float64 no compila: hay que convertir con float64(x).'),
  E('go', 'principiante', 'comunidad', 'Variables o imports sin usar', 'Son error de compilación, no advertencia. Ayuda a mantener el código limpio.'),
  E('go', 'particular', 'oficial', 'Un solo bucle', 'for cubre los tres casos: con contador, condicional (como while) e infinito.'),

  // ---------------- Rust ----------------
  E('rust', 'nombres', 'oficial', 'snake_case y UpperCamelCase', 'Funciones y variables en snake_case; tipos y traits en UpperCamelCase; constantes en SCREAMING_SNAKE_CASE.', { ref: 'Rust API Guidelines · C-CASE', works: 'fn areaCirculo(R: f64) -> f64', better: 'fn area_circulo(radio: f64) -> f64' }),
  E('rust', 'formato', 'oficial', 'rustfmt', 'cargo fmt aplica el formato estándar; cargo clippy sugiere código más idiomático.'),
  E('rust', 'variables', 'oficial', 'Inmutable por defecto', 'let x = 5 no puede cambiar; let mut x lo permite. Usar mut solo cuando hace falta.'),
  E('rust', 'funciones', 'oficial', 'La última expresión es el retorno', 'Una expresión final sin ; es el valor devuelto; return se reserva para salidas anticipadas.', { works: 'fn doble(x: i64) -> i64 {\n    return x * 2;\n}', better: 'fn doble(x: i64) -> i64 {\n    x * 2\n}' }),
  E('rust', 'errores', 'oficial', 'Result y el operador ?', 'Errores recuperables con Result<T, E>; ? propaga el error. unwrap() detiene el programa: evitarlo fuera de prototipos.', { ref: 'The Rust Book · cap. 9' }),
  E('rust', 'colecciones', 'oficial', 'Recibir slices', '&[f64] acepta tanto un Vec<f64> como un arreglo, sin tomar posesión.', { ref: 'Rust API Guidelines · C-CALLER-CONTROL' }),
  E('rust', 'principiante', 'comunidad', 'Pelear con el préstamo', 'Una referencia mutable excluye a las demás. Si el compilador se queja, suele indicar un diseño con estado compartido confuso.'),
  E('rust', 'particular', 'oficial', 'Los índices son usize', 'Indexar con un i64 exige convertir (as usize); un índice fuera de rango detiene el programa en vez de leer basura.'),

  // ---------------- PHP ----------------
  E('php', 'nombres', 'oficial', 'camelCase en métodos', 'PSR-1: clases en StudlyCaps, métodos en camelCase, constantes en MAYÚSCULAS.', { ref: 'PSR-1', works: 'function Area_Circulo($R)', better: 'function areaCirculo(float $radio): float' }),
  E('php', 'formato', 'oficial', 'PSR-12', '4 espacios; llave de funciones y clases en línea propia; llave de control (if, for) en la misma línea.', { ref: 'PSR-12' }),
  E('php', 'variables', 'oficial', 'strict_types', 'declare(strict_types=1); al inicio hace que los tipos declarados se respeten en lugar de convertir en silencio.'),
  E('php', 'funciones', 'comunidad', 'Tipos en parámetros y retorno', 'function promedio(array $valores): float documenta y valida.'),
  E('php', 'errores', 'oficial', 'Excepciones', 'throw new InvalidArgumentException(...); evitar el operador @ que silencia errores.'),
  E('php', 'colecciones', 'oficial', 'array es un mapa ordenado', 'Las listas son arrays con claves 0, 1, 2…; count() da la longitud.'),
  E('php', 'principiante', 'comunidad', 'Concatenar con +', 'En PHP los textos se unen con . (punto): "a" + "b" intenta sumar números.'),
  E('php', 'principiante', 'comunidad', '== entre tipos distintos', '"abc" == 0 era true antes de PHP 8. Usar === siempre.'),
  E('php', 'particular', 'oficial', 'División', '/ devuelve float si no es exacta; intdiv() para división entera.'),

  // ---------------- SQL ----------------
  E('sql', 'nombres', 'comunidad', 'snake_case y singular o plural consistente', 'Tablas y columnas en minúscula con guiones bajos. Evitar palabras reservadas como nombres (order, group).', { ref: 'sqlstyle.guide · Naming conventions' }),
  E('sql', 'formato', 'comunidad', 'Palabras clave en mayúscula', 'SELECT, FROM, WHERE en mayúscula y una cláusula por línea facilitan la lectura.', { works: 'select avg(valor) from valores where valor>0', better: 'SELECT AVG(valor) AS promedio\nFROM valores\nWHERE valor > 0;' }),
  E('sql', 'variables', 'oficial', 'Tipado flexible de SQLite', 'SQLite guarda el tipo por valor; la columna solo sugiere una afinidad (INTEGER, REAL, TEXT).', { ref: 'SQLite · Datatypes In SQLite' }),
  E('sql', 'funciones', 'oficial', 'Funciones de agregación', 'COUNT, SUM, AVG, MIN y MAX resumen muchas filas en un valor. SUM y AVG de una tabla vacía dan NULL.'),
  E('sql', 'errores', 'comunidad', 'Consultas parametrizadas', 'Nunca concatenar texto del usuario en una consulta: usar parámetros (?, :nombre). Previene la inyección SQL.'),
  E('sql', 'colecciones', 'comunidad', 'Pensar en conjuntos', 'Una consulta describe qué filas se quieren, no cómo recorrerlas. Un bucle fila por fila suele ser señal de que falta un JOIN o un GROUP BY.'),
  E('sql', 'comentarios', 'oficial', 'Comentarios', '-- hasta el fin de línea, /* */ para bloques.'),
  E('sql', 'principiante', 'comunidad', 'Comparar con NULL usando =', 'valor = NULL nunca es verdadero; se usa IS NULL.', { works: "WHERE nota = NULL", better: 'WHERE nota IS NULL' }),
  E('sql', 'particular', 'oficial', 'El orden no está garantizado', 'Sin ORDER BY, el orden de las filas puede cambiar entre ejecuciones.'),

  // ---------------- Generales (proyecto) ----------------
  ...(['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php'] as const).flatMap((lang) => [
    E(lang, 'legibilidad', 'proyecto', 'Nombres del dominio', 'En Dev Lab los nombres salen del problema (radio, nota, objetivo), no de letras sueltas, salvo índices de bucle o fórmulas conocidas.'),
    E(lang, 'comentarios', 'proyecto', 'Comentarios ligados al algoritmo', 'Los comentarios del código generado repiten las notas de la etapa Algoritmo, para poder seguir la correspondencia.'),
  ]),
]
