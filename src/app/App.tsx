import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { db } from '@/db/db'
import { describeStorageError } from '@/services/errors'
import { FeedbackProvider } from '@/components/feedback'
import { CosmicBackground } from '@/components/CosmicBackground'
import { Loading } from '@/components/ui'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { enteredOps, rootDestination } from './gate'
import { Layout } from './Layout'

const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'))
const NotebookPage = lazy(() => import('@/features/notebook/NotebookPage'))
const KnowledgeList = lazy(() => import('@/features/knowledge/KnowledgeList'))
const ConceptView = lazy(() => import('@/features/knowledge/ConceptView'))
const ConceptEditor = lazy(() => import('@/features/knowledge/ConceptEditor'))
const Workbench = lazy(() => import('@/features/workbench/Workbench'))
const FocusPage = lazy(() => import('@/features/focus/FocusPage'))
const SketchPage = lazy(() => import('@/features/sketch/SketchPage'))
const ToolShelf = lazy(() => import('@/features/tools/ToolShelf'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'))
const ReviewPage = lazy(() => import('@/features/review/ReviewPage'))
const ExercisesPage = lazy(() => import('@/features/exercises/ExercisesPage'))
const MistakesPage = lazy(() => import('@/features/exercises/MistakesPage'))
const LibraryPage = lazy(() => import('@/features/library/LibraryPage'))
const LandingPage = lazy(() => import('@/features/landing/LandingPage'))
const AuthPage = lazy(() => import('@/features/auth/AuthPage'))

function StorageGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'opening' | 'ok' | string>('opening')
  useEffect(() => {
    db.open()
      .then(() => setState('ok'))
      .catch((e) => setState(describeStorageError(e)))
  }, [])
  if (state === 'opening') return <p className="p-6 text-sm text-muted">Abriendo la base de datos local…</p>
  if (state !== 'ok')
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="text-lg font-semibold">No se pudo abrir el almacenamiento local</h1>
        <p className="mt-2 text-sm text-muted">{state}</p>
        <p className="mt-2 text-sm text-muted">
          EXODIA guarda todo en IndexedDB. Verificá que el navegador no esté en modo privado estricto y que el sitio tenga permiso para almacenar datos.
        </p>
      </div>
    )
  return <>{children}</>
}

function PublicShell() {
  const { pathname } = useLocation()
  const auth = pathname === '/login' || pathname === '/register'
  useEffect(() => {
    document.documentElement.classList.add('public-doc')
    return () => document.documentElement.classList.remove('public-doc')
  }, [])
  return (
    <>
      {auth && <CosmicBackground />}
      <Suspense fallback={<div className="p-8"><Loading /></div>}>
        <Outlet />
      </Suspense>
    </>
  )
}

function RootGate() {
  const { session, restoring } = useAuth()
  if (restoring) return <p className="relative z-10 p-8 text-sm text-muted">Alineando el observatorio…</p>
  if (rootDestination({ session: !!session, entered: enteredOps() }) === '/app') return <Navigate to="/app" replace />
  return <LandingPage />
}

function OpsRoutes() {
  return (
    <StorageGate>
      <Layout />
    </StorageGate>
  )
}

export function App() {
  return (
    <FeedbackProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicShell />}>
              <Route index element={<RootGate />} />
              <Route path="welcome" element={<LandingPage />} />
              <Route path="login" element={<AuthPage mode="login" />} />
              <Route path="register" element={<AuthPage mode="register" />} />
            </Route>
            <Route element={<OpsRoutes />}>
              <Route path="app" element={<Dashboard />} />
              <Route path="notes" element={<NotebookPage />} />
              <Route path="notes/:id" element={<NotebookPage />} />
              <Route path="knowledge" element={<KnowledgeList />} />
              <Route path="knowledge/new" element={<ConceptEditor />} />
              <Route path="knowledge/:id" element={<ConceptView />} />
              <Route path="knowledge/:id/edit" element={<ConceptEditor />} />
              <Route path="workbench" element={<Navigate to="/workbench/calculator" replace />} />
              <Route path="workbench/:tool" element={<Workbench />} />
              <Route path="workbench/:tool/:id" element={<Workbench />} />
              <Route path="focus" element={<FocusPage />} />
              <Route path="focus/:tab" element={<FocusPage />} />
              <Route path="sketch" element={<SketchPage />} />
              <Route path="sketch/:id" element={<SketchPage />} />
              <Route path="tools" element={<ToolShelf />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="exercises" element={<ExercisesPage />} />
              <Route path="exercises/errores" element={<MistakesPage />} />
              <Route path="library" element={<LibraryPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </FeedbackProvider>
  )
}
