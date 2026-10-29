import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authErrorMessage, authLockRemaining, clearAuthFailures, normalizeEmail, noteAuthFailure, rememberOAuthReturn, signupPasswordIssue } from '@/lib/authPolicy'
import { StorageError } from '@/services/errors'
import { bindAccountSync, reconcileSession } from '@/services/sync'

interface AuthApi {
  configured: boolean
  restoring: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>
  signInWithProvider: (provider: 'google' | 'github', returnTo: string) => Promise<void>
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
      bindAccountSync(next?.user.id ?? null)
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
        const wait = authLockRemaining()
        if (wait > 0) throw new StorageError(`Demasiados intentos. Esperá ${Math.ceil(wait / 1000)} s.`)
        const { error } = await ready().auth.signInWithPassword({ email: normalizeEmail(email), password })
        if (error) {
          noteAuthFailure()
          throw new StorageError(authErrorMessage(error.message, 'login'), error)
        }
        clearAuthFailures()
      },
      async signUp(email, password) {
        const wait = authLockRemaining()
        if (wait > 0) throw new StorageError(`Demasiados intentos. Esperá ${Math.ceil(wait / 1000)} s.`)
        const weak = signupPasswordIssue(password)
        if (weak) throw new StorageError(weak)
        const { data, error } = await ready().auth.signUp({
          email: normalizeEmail(email),
          password,
          options: { emailRedirectTo: `${location.origin}/login` },
        })
        if (error) {
          noteAuthFailure()
          throw new StorageError(authErrorMessage(error.message, 'register'), error)
        }
        clearAuthFailures()
        return { needsConfirm: !data.session }
      },
      async signInWithProvider(provider, returnTo) {
        const wait = authLockRemaining()
        if (wait > 0) throw new StorageError(`Demasiados intentos. Esperá ${Math.ceil(wait / 1000)} s.`)
        rememberOAuthReturn(returnTo)
        const { error } = await ready().auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${location.origin}/login`,
            ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
          },
        })
        if (error) {
          noteAuthFailure()
          throw new StorageError(authErrorMessage(error.message, 'login'), error)
        }
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
