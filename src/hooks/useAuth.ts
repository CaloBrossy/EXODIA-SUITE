import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { StorageError } from '@/services/errors'
import { reconcileSession } from '@/services/sync'

interface AuthApi {
  configured: boolean
  restoring: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = supabase !== null
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(configured)

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setRestoring(false)
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && next) void reconcileSession(next.user.id)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const api = useMemo<AuthApi>(() => {
    const ready = () => {
      if (!supabase) throw new StorageError('Supabase no está configurado.')
      return supabase
    }
    return {
      configured,
      restoring,
      session,
      async signIn(email, password) {
        const { error } = await ready().auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new StorageError(error.message, error)
      },
      async signUp(email, password) {
        const { data, error } = await ready().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${location.origin}/login` },
        })
        if (error) throw new StorageError(error.message, error)
        return { needsConfirm: !data.session }
      },
      async signOut() {
        const { error } = await ready().auth.signOut()
        if (error) throw new StorageError(error.message, error)
      },
    }
  }, [configured, restoring, session])

  return createElement(Ctx.Provider, { value: api }, children)
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider ausente')
  return v
}
