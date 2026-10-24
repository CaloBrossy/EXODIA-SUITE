import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { CloudDownload, CloudUpload, Download, LogOut, Upload } from 'lucide-react'
import { db, SCHEMA_VERSION, TABLE_NAMES, type TableName } from '@/db/db'
import { downloadJson, exportData, importData, parseBackup, type Backup, type ImportMode } from '@/services/backup'
import { pullRemoteToLocal, pushLocalToSupabase, replaceLocalWithRemote } from '@/services/sync'
import { useAuth } from '@/hooks/useAuth'
import { useSyncConflict } from '@/hooks/useSyncConflict'
import { useFx, useTheme } from '@/hooks/misc'
import { useFeedback } from '@/components/feedback'
import { Button, ButtonLink, ErrorText, Kbd, PageHeader, Panel, Tabs } from '@/components/ui'

const TABLE_LABEL: Record<TableName, string> = {
  notes: 'Notas',
  concepts: 'Conceptos',
  formulas: 'Fórmulas',
  questions: 'Preguntas',
  calculations: 'Cálculos',
  tasks: 'Tareas',
  subjects: 'Materias',
  sessions: 'Sesiones',
  sketches: 'Pizarras',
  tools: 'Herramientas',
  kv: 'Configuración',
  devProblems: 'Problemas de programación',
}

function CloudSync() {
  const { fail, notify, confirm } = useFeedback()
  const { configured, session, signOut } = useAuth()
  const conflict = useSyncConflict()
  const [busy, setBusy] = useState(false)

  const run = async (op: () => Promise<number | Record<string, number>>, ok: string) => {
    setBusy(true)
    try {
      const result = await op()
      const n = typeof result === 'number' ? result : Object.values(result).reduce((a, b) => a + b, 0)
      notify(`${ok} (${n} filas).`, 'ok')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return <p className="text-sm text-muted">Supabase no está configurado. El laboratorio local y la exportación JSON siguen funcionando.</p>
  }
  if (!session) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted">Para subir o bajar una copia hace falta una cuenta. Los datos de este dispositivo no se envían solos.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/login?returnTo=/settings" variant="primary">Entrar</ButtonLink>
          <ButtonLink to="/register?returnTo=/settings">Crear cuenta</ButtonLink>
        </div>
      </div>
    )
  }

  const useCloud = async () => {
    const ok = await confirm({
      title: '¿Reemplazar este dispositivo con la nube?',
      body: 'Se borra lo que hay en este navegador y queda la copia de la cuenta actual. Si la nube está vacía, no se toca nada. Exportá un JSON antes si querés conservar lo local.',
      confirmLabel: 'Usar la nube',
      danger: true,
    })
    if (ok) await run(replaceLocalWithRemote, 'Dispositivo reemplazado')
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">Sesión: <span className="text-fg">{session.user.email ?? session.user.id}</span></p>
      {conflict && (
        <p className="text-muted">Este dispositivo tiene datos de otra cuenta. No se subieron solos. Elegí si copiás la nube hacia acá o subís este dispositivo a la cuenta actual.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void run(pushLocalToSupabase, 'Subida lista')}><CloudUpload size={15} /> Subir este dispositivo</Button>
        <Button disabled={busy} onClick={() => void run(() => pullRemoteToLocal('merge'), 'Bajada lista')}><CloudDownload size={15} /> Bajar cambios</Button>
        {conflict && <Button variant="danger" disabled={busy} onClick={() => void useCloud()}>Usar la nube</Button>}
        <Button disabled={busy} onClick={() => void signOut().catch(fail)}><LogOut size={15} /> Salir</Button>
      </div>
      <p className="text-xs text-muted">Bajar fusiona por fecha: gana la versión más nueva y no borra filas que solo existen acá. <Link to="/welcome" className="text-accent">Volver a la landing</Link></p>
    </div>
  )
}

function StorageInfo() {
  const [est, setEst] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null)
  const { notify } = useFeedback()
  const refresh = async () => {
    const e = navigator.storage?.estimate ? await navigator.storage.estimate() : {}
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : undefined
    setEst({ usage: e.usage, quota: e.quota, persisted })
  }
  useEffect(() => void refresh(), [])
  const mb = (b?: number) => (b === undefined ? '—' : `${(b / 1024 / 1024).toFixed(1)} MB`)
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Uso: {mb(est?.usage)} de {mb(est?.quota)} disponibles.</p>
      <p>
        Almacenamiento persistente: {est?.persisted === undefined ? 'no disponible en este navegador' : est.persisted ? 'sí (el navegador no lo borrará automáticamente)' : 'no (el navegador podría liberar espacio bajo presión)'}
      </p>
      {est?.persisted === false && (
        <Button
          size="sm"
          className="self-start"
          onClick={async () => {
            const ok = await navigator.storage.persist()
            notify(ok ? 'Almacenamiento marcado como persistente.' : 'El navegador rechazó la solicitud (suele concederse al instalar la PWA o con uso frecuente).', ok ? 'ok' : 'info')
            void refresh()
          }}
        >
          Solicitar almacenamiento persistente
        </Button>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme()
  const { fx, setFx } = useFx()
  const { fail, notify, confirm } = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ backup: Backup; counts: Record<TableName, number>; name: string } | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [error, setError] = useState('')
  const counts = useLiveQuery(async () => Object.fromEntries(await Promise.all(TABLE_NAMES.map(async (t) => [t, await db.table(t).count()] as const))) as Record<TableName, number>, [])

  const doExport = async () => {
    try {
      const data = await exportData()
      downloadJson(data, `exodia-${new Date().toISOString().slice(0, 10)}.json`)
      notify('Exportación descargada.', 'ok')
    } catch (e) {
      fail(e)
    }
  }

  const onFile = async (file: File) => {
    setError('')
    setPending(null)
    if (file.size > 200 * 1024 * 1024) return setError('El archivo es demasiado grande (máx. 200 MB).')
    const r = parseBackup(await file.text())
    if (!r.ok) return setError(r.error)
    setPending({ backup: r.backup, counts: r.counts, name: file.name })
  }

  const doImport = async () => {
    if (!pending) return
    const ok = await confirm({
      title: mode === 'replace' ? '¿Reemplazar TODOS los datos?' : '¿Fusionar los datos importados?',
      body:
        mode === 'replace'
          ? 'Se borrarán todas las notas, conceptos, tareas, pizarras y demás datos actuales y se reemplazarán por los del archivo. Recomendación: exportá primero una copia.'
          : 'Se agregarán los registros nuevos. Los registros con el mismo identificador serán sobrescritos por la versión del archivo.',
      confirmLabel: mode === 'replace' ? 'Reemplazar todo' : 'Fusionar',
      danger: true,
    })
    if (!ok) return
    try {
      await importData(pending.backup, mode)
      setPending(null)
      notify('Importación completada.', 'ok')
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 md:p-6">
      <PageHeader title="Datos y ajustes" subtitle="Todos tus datos viven en este dispositivo (IndexedDB). Nada se envía a terceros." />
      <Panel title="Tus datos">
        <div className="flex flex-col gap-4">
          {counts && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {TABLE_NAMES.map((t) => (
                <div key={t} className="flex justify-between border-b border-line py-0.5"><dt className="text-muted">{TABLE_LABEL[t]}</dt><dd className="font-mono tabular">{counts[t]}</dd></div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={doExport}><Download size={15} /> Exportar a JSON</Button>
            <Button onClick={() => fileRef.current?.click()}><Upload size={15} /> Importar JSON…</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
          </div>
          <ErrorText>{error}</ErrorText>
          {pending && (
            <div className="flex flex-col gap-3 rounded-md border border-line p-3">
              <p className="text-sm">
                <strong>{pending.name}</strong> — exportado el {new Date(pending.backup.exportedAt).toLocaleString('es-AR')} (esquema v{pending.backup.schemaVersion}). Validación correcta.
              </p>
              <p className="text-xs text-muted">{TABLE_NAMES.filter((t) => pending.counts[t]).map((t) => `${TABLE_LABEL[t]}: ${pending.counts[t]}`).join(' · ')}</p>
              <Tabs value={mode} onChange={setMode} items={[{ id: 'merge', label: 'Fusionar con lo actual' }, { id: 'replace', label: 'Reemplazar todo' }]} />
              <div className="flex gap-2">
                <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={doImport}>Importar</Button>
                <Button onClick={() => setPending(null)}>Cancelar</Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted">Formato: JSON con versión de esquema (actual: v{SCHEMA_VERSION}). La importación valida cada registro antes de escribir y se aplica en una única transacción: si algo falla, no se modifica nada.</p>
        </div>
      </Panel>
      <Panel title="Supabase">
        <CloudSync />
      </Panel>
      <Panel title="Almacenamiento"><StorageInfo /></Panel>
      <Panel title="Apariencia">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-16">Tema</span>
            <Tabs value={theme} onChange={(v) => v !== theme && toggle()} items={[{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Oscuro' }]} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16">Efectos</span>
            <Tabs value={fx} onChange={setFx} items={[{ id: 'full', label: 'Completos' }, { id: 'lite', label: 'Reducidos' }]} />
          </div>
          <p className="text-xs text-muted">«Reducidos» desactiva el desenfoque del vidrio, el fondo animado y la inclinación 3D: recomendado en equipos lentos o con batería baja. Si el sistema pide reducir el movimiento, las animaciones se desactivan solas.</p>
        </div>
      </Panel>
      <Panel title="Atajos de teclado">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          <li><Kbd>Ctrl K</Kbd> Buscar en todo EXODIA</li>
          <li><Kbd>Alt N</Kbd> Nueva nota</li>
          <li><Kbd>Alt 1…8</Kbd> Ir a cada módulo</li>
          <li><Kbd>Ctrl B</Kbd> / <Kbd>Ctrl I</Kbd> Negrita / cursiva en notas</li>
          <li><Kbd>Ctrl S</Kbd> Guardar nota inmediatamente</li>
          <li><Kbd>Enter</Kbd> / <Kbd>↑</Kbd> Calcular / historial (calculadora)</li>
          <li><Kbd>P</Kbd> / <Kbd>E</Kbd> Lápiz / borrador (pizarra)</li>
          <li><Kbd>Ctrl Z</Kbd> / <Kbd>Ctrl Shift Z</Kbd> Deshacer / rehacer (pizarra)</li>
        </ul>
      </Panel>
    </div>
  )
}
