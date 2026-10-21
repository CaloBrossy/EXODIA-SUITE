import { features, type Feature, type Program } from './ir'
import type { CodeLang } from './emit/code'

export type LangId = CodeLang | 'sql'

export interface LangInfo {
  id: LangId
  label: string
  /** Cómo ejecutar el archivo generado en una computadora con la herramienta instalada. */
  run: string
  typing: string
  /** Explicación de cómo se expresa cada construcción de la IR en este lenguaje. */
  constructs: Partial<Record<Feature, string>>
  pitfalls: string[]
}

export const LANGS: Record<LangId, LangInfo> = {
  python: {
    id: 'python',
    label: 'Python',
    run: 'python archivo.py',
    typing: 'Dinámico; las anotaciones de tipo (int, float, list[float]) documentan pero no se verifican al ejecutar.',
    constructs: {
      for: 'range(a, b + 1): el límite superior de range es exclusivo, por eso se suma 1.',
      each: 'for x in lista recorre los elementos directamente.',
      while: 'while condición: igual que MIENTRAS.',
      idiv: '// es la división entera (redondea hacia −∞).',
      mod: '% devuelve un resto con el signo del divisor: -7 % 2 == 1.',
      floatDiv: '/ siempre devuelve float, incluso entre enteros.',
      fallible: 'Los errores se señalan con raise ValueError(...) y se capturan con try/except.',
      math: 'Las funciones matemáticas están en el módulo math (math.sqrt, math.pi).',
      pow: '** es la potencia.',
      recursion: 'Python no optimiza la recursión de cola; el límite por defecto es unas 1000 llamadas.',
      index: 'lista[i] con i desde 0; un índice negativo cuenta desde el final (cuidado).',
      str: 'Los textos son str; se escriben entre comillas simples o dobles.',
    },
    pitfalls: ['La indentación es parte de la sintaxis: mezclar tabs y espacios rompe el programa.', 'Los enteros no tienen límite de tamaño, a diferencia de casi todos los otros lenguajes de la lista.'],
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    run: 'node archivo.js',
    typing: 'Dinámico; todos los números son de punto flotante de 64 bits (enteros exactos hasta 2^53).',
    constructs: {
      for: 'for (let i = a; i <= b; i++): el contador se declara con let porque cambia.',
      each: 'for (const x of lista): of recorre valores; in recorrería índices como texto.',
      idiv: 'No hay división entera: Math.trunc(a / b) descarta los decimales.',
      mod: '% conserva el signo del dividendo: -7 % 2 === -1.',
      fallible: 'throw new RangeError(...) y try/catch.',
      math: 'Math.sqrt, Math.PI, Math.log (logaritmo natural).',
      pow: '** es la potencia.',
      str: 'Textos entre comillas; se comparan con ===.',
      bool: '=== compara sin conversiones de tipo; == convierte y sorprende (0 == "" es true).',
    },
    pitfalls: ['const impide reasignar la variable, no modificar el contenido de un arreglo.', 'Sin tipos, pasar "5" en lugar de 5 no da error: "5" + 1 es "51".'],
  },
  typescript: {
    id: 'typescript',
    label: 'TypeScript',
    run: 'npx tsx archivo.ts  (o node archivo.ts en Node 22.6+)',
    typing: 'Estático sobre JavaScript: el compilador revisa los tipos y luego los borra.',
    constructs: {
      for: 'Igual que JavaScript; el tipo de i se infiere como number.',
      each: 'for (const x of lista) con lista: number[] o readonly number[].',
      idiv: 'Math.trunc(a / b): number no distingue enteros de reales.',
      fallible: 'throw new RangeError(...); el tipo de retorno no declara los errores posibles.',
      list: 'readonly number[] documenta que la función no modifica la lista.',
      str: 'El tipo string.',
    },
    pitfalls: ['Los tipos no existen al ejecutar: no validan datos que vienen de afuera.', 'number cubre enteros y reales: 7 / 2 es 3.5.'],
  },
  java: {
    id: 'java',
    label: 'Java',
    run: 'java Archivo.java  (Java 11+; el nombre del archivo debe coincidir con la clase)',
    typing: 'Estático y nominal; long es entero de 64 bits y double real de 64 bits.',
    constructs: {
      for: 'for (long i = a; i <= b; i++).',
      each: 'for (double x : lista).',
      index: 'Los índices de arreglo son int: hace falta convertir (int) un long.',
      idiv: '/ entre enteros ya es división entera (trunca hacia 0).',
      toFloat: '(double) convierte antes de dividir; sin eso, 7 / 2 da 3.',
      fallible: 'throw new IllegalArgumentException(...), excepción no verificada.',
      math: 'Math.sqrt, Math.PI.',
      str: 'String; se compara con .equals(), nunca con ==.',
      helper: 'Las funciones auxiliares son métodos private static.',
    },
    pitfalls: ['Todo vive dentro de una clase.', 'long desborda en silencio pasado 9.2 × 10^18.'],
  },
  c: {
    id: 'c',
    label: 'C',
    run: 'gcc -std=c11 -Wall -o programa archivo.c -lm && ./programa',
    typing: 'Estático y débil; long long y double. No hay excepciones ni longitud de arreglos.',
    constructs: {
      list: 'Un arreglo se pasa como puntero y una longitud aparte (x, x_len): C no la guarda.',
      fallible: 'Sin excepciones: la función devuelve bool (éxito) y escribe el resultado en un puntero de salida.',
      idiv: '/ entre enteros trunca hacia 0.',
      toFloat: '(double) antes de dividir.',
      math: '<math.h>; hay que enlazar con -lm. M_PI no es estándar: se define si falta.',
      str: 'Los textos son const char * (punteros a caracteres).',
      bool: '<stdbool.h> aporta bool, true y false.',
      each: 'No hay PARA CADA: se recorre con un índice.',
    },
    pitfalls: ['Leer fuera del arreglo no da error: devuelve basura o rompe el programa.', 'printf necesita el formato correcto (%lld, %g); uno equivocado imprime basura.'],
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    run: 'g++ -std=c++17 -Wall -o programa archivo.cpp && ./programa',
    typing: 'Estático; std::vector conoce su tamaño y std::string maneja textos.',
    constructs: {
      list: 'const std::vector<double>& evita copiar la lista y promete no modificarla.',
      each: 'for (const double x : lista).',
      fallible: 'throw std::invalid_argument(...) y try/catch.',
      index: 'lista[i] no verifica límites; lista.at(i) sí.',
      math: '<cmath>: std::sqrt, std::pow.',
      toFloat: 'static_cast<double>(x).',
    },
    pitfalls: ['size() devuelve un entero sin signo: size() - 1 con un vector vacío da un número enorme.', 'Comparar enteros con y sin signo genera advertencias por buenas razones.'],
  },
  csharp: {
    id: 'csharp',
    label: 'C#',
    run: 'dotnet run  (dentro de un proyecto de consola)',
    typing: 'Estático; long, double, string y arreglos con .Length.',
    constructs: {
      fallible: 'throw new ArgumentException(...) y try/catch.',
      each: 'foreach (double x in lista).',
      math: 'Math.Sqrt, Math.PI (métodos en PascalCase).',
      toFloat: '(double)x.',
      str: 'string; == compara contenido.',
    },
    pitfalls: ['La cultura del sistema puede imprimir 2,5 en lugar de 2.5: el programa fija InvariantCulture.', 'Palabras reservadas como base se usan como nombre con @: @base.'],
  },
  go: {
    id: 'go',
    label: 'Go',
    run: 'go run archivo.go',
    typing: 'Estático; int64, float64 y slices ([]float64). No hay conversiones implícitas.',
    constructs: {
      fallible: 'Sin excepciones: la función devuelve (resultado, error) y quien llama revisa if err != nil.',
      each: 'for _, x := range lista: range da índice y valor; _ descarta el índice.',
      while: 'No existe while: se escribe for condición { }.',
      toFloat: 'float64(x): mezclar int64 y float64 es error de compilación.',
      math: 'Paquete math: math.Sqrt, math.Pi.',
      idiv: '/ entre enteros trunca hacia 0.',
    },
    pitfalls: ['Una variable o import sin usar es error de compilación.', 'gofmt define el formato: no se discute.', 'Los mensajes de error van en minúscula y sin punto final.'],
  },
  rust: {
    id: 'rust',
    label: 'Rust',
    run: 'rustc archivo.rs && ./archivo',
    typing: 'Estático y estricto; i64, f64, slices &[f64]. Las variables son inmutables salvo let mut.',
    constructs: {
      fallible: 'Result<T, String>: Ok(valor) o Err(mensaje). El operador ? propaga errores.',
      each: 'for &x in lista recorre copiando cada elemento.',
      index: 'lista[i] exige i de tipo usize; fuera de rango el programa se detiene (panic).',
      toFloat: 'x as f64.',
      math: 'Los métodos son del número: x.sqrt(), std::f64::consts::PI.',
      while: 'while condición { }.',
    },
    pitfalls: ['La última expresión sin ; es el valor de retorno.', 'El desborde de enteros detiene el programa en modo debug.'],
  },
  php: {
    id: 'php',
    label: 'PHP',
    run: 'php archivo.php',
    typing: 'Dinámico; declare(strict_types=1) hace que los tipos declarados se respeten.',
    constructs: {
      each: 'foreach ($lista as $x).',
      idiv: 'intdiv($a, $b).',
      fallible: 'throw new InvalidArgumentException(...) y try/catch.',
      str: 'Los textos se concatenan con . (punto), no con +.',
      bool: '=== compara valor y tipo; == convierte.',
      list: 'Los arreglos (array) son mapas ordenados; count() da la longitud.',
    },
    pitfalls: ['Las variables llevan $.', 'Sin strict_types, "5" se convierte a 5 en silencio.'],
  },
  sql: {
    id: 'sql',
    label: 'SQL (SQLite)',
    run: 'sqlite3 :memory: ".read archivo.sql"',
    typing: 'Tipado por columna, flexible en SQLite (INTEGER, REAL, TEXT).',
    constructs: {},
    pitfalls: ['SQL es declarativo: se describe el resultado, no el recorrido.', 'NULL no es 0: cualquier operación con NULL da NULL; COALESCE elige un valor por defecto.'],
  },
}

const FEATURE_LABEL: Partial<Record<Feature, string>> = {
  for: 'Bucle con contador',
  each: 'Recorrido de lista',
  while: 'Bucle condicional',
  idiv: 'División entera',
  mod: 'Resto',
  floatDiv: 'División real',
  toFloat: 'Conversión a real',
  fallible: 'Errores',
  math: 'Funciones matemáticas',
  pow: 'Potencia',
  recursion: 'Recursión',
  index: 'Acceso por índice',
  list: 'Listas',
  str: 'Textos',
  bool: 'Booleanos',
  helper: 'Funciones auxiliares',
}

/** Construcciones que el programa usa, explicadas para el lenguaje elegido. */
export function explainConstructs(lang: LangId, p: Program): { label: string; text: string }[] {
  const info = LANGS[lang]
  const used = features(p)
  return [...used].flatMap((f) => {
    const text = info.constructs[f]
    return text && FEATURE_LABEL[f] ? [{ label: FEATURE_LABEL[f]!, text }] : []
  })
}

/** Diferencias concretas entre el pseudocódigo y el código del lenguaje. */
export function pseudoDifferences(lang: CodeLang, p: Program): string[] {
  const used = features(p)
  const out: string[] = []
  if (used.has('for')) out.push(lang === 'python' ? 'PARA i DESDE a HASTA b incluye b; range(a, b + 1) lo excluye, por eso el +1.' : 'PARA i DESDE a HASTA b incluye b: el código usa <=.')
  if (used.has('index')) out.push('El pseudocódigo y el código cuentan posiciones desde 0.')
  if (used.has('fallible')) out.push(lang === 'c' ? 'ERROR "…" se traduce en devolver false y un mensaje por puntero.' : lang === 'go' ? 'ERROR "…" se traduce en devolver un error como segundo resultado.' : lang === 'rust' ? 'ERROR "…" se traduce en Err(...); DEVOLVER x en Ok(x).' : 'ERROR "…" se traduce en lanzar una excepción.')
  if (used.has('idiv')) out.push(lang === 'python' ? 'DIV se escribe //.' : lang === 'javascript' || lang === 'typescript' ? 'DIV no existe: Math.trunc(a / b).' : lang === 'php' ? 'DIV se escribe intdiv(a, b).' : 'DIV se escribe / porque ambos operandos son enteros.')
  if (used.has('toFloat')) out.push('REAL(x) es una conversión explícita de entero a real.')
  if (lang === 'c' && used.has('list')) out.push('LONGITUD(lista) se pasa como parámetro aparte (lista_len).')
  out.push('Las pruebas al final del archivo no son parte del algoritmo: llaman a la función con los casos de la etapa Pruebas.')
  return out
}
