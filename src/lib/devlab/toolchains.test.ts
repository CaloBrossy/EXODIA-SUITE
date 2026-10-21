/**
 * Verificación de los traductores con compiladores e intérpretes reales.
 * No corre con `npm test`; se ejecuta con `npm run verify:devlab` y requiere las herramientas en el PATH:
 * python, node, javac/java, gcc, g++, dotnet, go, rustc, php y sqlite3.
 */
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { CODE_LANGS, generateCode, type CodeLang } from './emit/code'
import { allSamples } from './problems'
import type { TestCase } from './types'

const run = promisify(execFile)
const ENABLED = import.meta.env.MODE === 'toolchains'

async function sh(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  try {
    const r = await run(cmd, args, { cwd, env: { ...process.env, ...env }, timeout: 120_000, maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32' && cmd === 'npx' })
    return { ok: true, out: r.stdout.toString(), err: r.stderr.toString() }
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string; message: string }
    return { ok: false, out: x.stdout ?? '', err: `${x.stderr ?? ''}\n${x.message}` }
  }
}

function compare(output: string, tests: TestCase[]): string[] {
  const lines = output.replace(/\r/g, '').trim().split('\n')
  const problems: string[] = []
  if (lines.length !== tests.length) problems.push(`se esperaban ${tests.length} líneas y hubo ${lines.length}`)
  tests.forEach((t, i) => {
    const line = lines[i] ?? ''
    const got = line.slice(line.indexOf(' => ') + 4).trim()
    if ('error' in t.expect) {
      if (!got.toLowerCase().startsWith('error:') || got.slice(6).trim().toLowerCase() !== t.expect.error.toLowerCase()) problems.push(`línea ${i + 1}: esperaba error "${t.expect.error}", obtuvo "${got}"`)
      return
    }
    const v = t.expect.value
    if (typeof v === 'number') {
      const n = Number(got)
      const ok = Number.isFinite(n) && Math.abs(n - v) <= 1e-9 * Math.max(1, Math.abs(v))
      if (!ok) problems.push(`línea ${i + 1}: esperaba ${v}, obtuvo "${got}"`)
    } else if (typeof v === 'boolean') {
      if (got.toLowerCase() !== String(v)) problems.push(`línea ${i + 1}: esperaba ${v}, obtuvo "${got}"`)
    } else if (got !== String(v)) problems.push(`línea ${i + 1}: esperaba "${String(v)}", obtuvo "${got}"`)
  })
  return problems
}

const samples = allSamples().filter((s) => s.solution.status === 'ok' && s.solution.program)

async function runLang(lang: CodeLang, root: string): Promise<string[]> {
  const failures: string[] = []
  const dir = join(root, lang)
  mkdirSync(dir, { recursive: true })
  let csproj = ''
  if (lang === 'csharp') {
    csproj = join(dir, 'proj')
    const r = await sh('dotnet', ['new', 'console', '-o', csproj, '--force'], dir)
    if (!r.ok) return [`dotnet new: ${r.err}`]
    writeFileSync(
      join(csproj, 'proj.csproj'),
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>',
    )
  }
  const tsFiles: string[] = []
  for (const [i, s] of samples.entries()) {
    const sol = s.solution
    const g = generateCode(lang, sol.program!, sol.tests)
    const name = `${s.kind}/${s.strategy}: "${s.text}"`
    const sub = join(dir, String(i))
    mkdirSync(sub, { recursive: true })
    const file = join(sub, g.fileName)
    writeFileSync(file, g.code)
    let res: { ok: boolean; out: string; err: string }
    switch (lang) {
      case 'python':
        res = await sh('python', [file], sub, { PYTHONUTF8: '1' })
        break
      case 'javascript':
        res = await sh('node', [file], sub)
        break
      case 'typescript':
        tsFiles.push(file)
        res = await sh('node', ['--no-warnings', file], sub)
        break
      case 'java': {
        const c = await sh('javac', ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', sub, file], sub)
        res = c.ok ? await sh('java', ['-Dsun.stdout.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-cp', sub, g.fileName.replace('.java', '')], sub) : c
        break
      }
      case 'c': {
        const exe = join(sub, 'a.exe')
        const c = await sh('gcc', ['-std=c11', '-Wall', '-Wextra', '-pedantic', '-Werror', file, '-o', exe, '-lm'], sub)
        res = c.ok ? await sh(exe, [], sub) : c
        break
      }
      case 'cpp': {
        const exe = join(sub, 'a.exe')
        const c = await sh('g++', ['-std=c++17', '-Wall', '-Wextra', '-pedantic', '-Werror', file, '-o', exe], sub)
        res = c.ok ? await sh(exe, [], sub) : c
        break
      }
      case 'csharp': {
        for (const f of readdirSync(csproj)) if (f.endsWith('.cs')) rmSync(join(csproj, f))
        writeFileSync(join(csproj, g.fileName), g.code)
        const c = await sh('dotnet', ['build', '-nologo', '-v', 'q', '-clp:NoSummary'], csproj)
        res = c.ok ? await sh('dotnet', [join(csproj, 'bin', 'Debug', 'net8.0', 'proj.dll')], csproj) : c
        break
      }
      case 'go': {
        res = await sh('go', ['run', file], sub)
        const f = await sh('gofmt', ['-l', file], sub)
        if (f.ok && f.out.trim()) failures.push(`${name}: gofmt reporta formato no canónico`)
        break
      }
      case 'rust': {
        const exe = join(sub, 'a.exe')
        const c = await sh('rustc', ['--edition', '2021', '-D', 'warnings', '-o', exe, file], sub)
        res = c.ok ? await sh(exe, [], sub) : c
        break
      }
      case 'php': {
        const l = await sh('php', ['-l', file], sub)
        res = l.ok ? await sh('php', [file], sub) : l
        break
      }
    }
    if (!res.ok) {
      failures.push(`${name}: ${res.err.slice(0, 1500)}\n--- código ---\n${g.code}`)
      continue
    }
    const diff = compare(res.out, sol.tests)
    if (diff.length) failures.push(`${name}: ${diff.join('; ')}\n--- salida ---\n${res.out}`)
  }
  if (lang === 'typescript' && tsFiles.length) {
    const c = await sh('node', [join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--skipLibCheck', '--types', 'node', '--moduleDetection', 'force', '--target', 'es2022', '--lib', 'es2022,dom', ...tsFiles], dir)
    if (!c.ok) failures.push(`tsc: ${c.out}${c.err}`.slice(0, 4000))
  }
  return failures
}

async function runSql(root: string): Promise<string[]> {
  const failures: string[] = []
  const dir = join(root, 'sql')
  mkdirSync(dir, { recursive: true })
  for (const [i, s] of samples.entries()) {
    const sql = s.solution.sql
    if (!sql) continue
    const file = join(dir, `${i}.sql`)
    writeFileSync(file, sql.code)
    const r = await sh('sqlite3', [':memory:', `.read ${file.replace(/\\/g, '/')}`], dir)
    if (!r.ok) {
      failures.push(`${s.text}: ${r.err}`)
      continue
    }
    const out = r.out.replace(/\r/g, '').trim()
    const v = sql.expected
    const got = typeof v === 'string' && v.includes('\n') ? out : (out.split('\n').pop()?.trim() ?? '')
    const ok = typeof v === 'number' ? Math.abs(Number(got) - v) <= 1e-9 * Math.max(1, Math.abs(v)) && got !== '' : got === String(v)
    if (!ok) failures.push(`${s.text}: esperaba ${String(v)}, obtuvo "${got}"\n${sql.code}`)
  }
  return failures
}

describe.skipIf(!ENABLED)('Dev Lab: traducciones compiladas y ejecutadas', () => {
  const root = ENABLED ? mkdtempSync(join(tmpdir(), 'devlab-')) : ''
  const report = join(tmpdir(), 'devlab-report')
  const check = (name: string, failures: string[]) => {
    mkdirSync(report, { recursive: true })
    writeFileSync(join(report, `${name}.txt`), failures.join('\n\n==========\n\n'))
    expect(failures.length, `${failures.length} fallos; detalle en ${join(report, `${name}.txt`)}`).toBe(0)
  }
  it('hay muestras para verificar', () => {
    expect(samples.length).toBeGreaterThan(5)
  })
  for (const lang of CODE_LANGS) {
    it(`${lang}: compila, ejecuta y coincide con los resultados esperados`, async () => {
      check(lang, await runLang(lang, root))
    }, 1_200_000)
  }
  it('sql: las consultas devuelven el resultado esperado en SQLite', async () => {
    check('sql', await runSql(root))
  }, 300_000)
})
