import { describe, expect, it } from 'vitest'
import { authErrorMessage, authLockRemaining, clearAuthFailures, noteAuthFailure, readOAuthReturn, rememberOAuthReturn, signupPasswordIssue } from './authPolicy'

describe('política de cuenta', () => {
  it('pide una contraseña de registro más larga', () => {
    expect(signupPasswordIssue('corta1')).toMatch(/10/)
    expect(signupPasswordIssue('sololetras')).toMatch(/números/)
    expect(signupPasswordIssue('estudio2026')).toBeNull()
  })

  it('no repite el mensaje crudo del servidor', () => {
    expect(authErrorMessage('Invalid login credentials', 'login')).toBe('Email o contraseña incorrectos.')
    expect(authErrorMessage('User already registered', 'register')).toMatch(/Si ya la tenías/)
    expect(authErrorMessage('database timeout at internal host', 'login')).toBe('No se pudo completar. Revisá los datos e intentá de nuevo.')
    expect(authErrorMessage('Unsupported provider: provider is not enabled', 'login')).toMatch(/no están habilitados/)
  })

  it('bloquea tras cinco fallos', () => {
    clearAuthFailures()
    const now = 1_000_000
    for (let i = 0; i < 4; i++) noteAuthFailure(now)
    expect(authLockRemaining(now)).toBe(0)
    noteAuthFailure(now)
    expect(authLockRemaining(now)).toBe(60_000)
    clearAuthFailures()
    expect(authLockRemaining(now)).toBe(0)
  })

  it('guarda y consume el retorno del acceso externo', () => {
    rememberOAuthReturn('/settings')
    expect(readOAuthReturn()).toBe('/settings')
    expect(readOAuthReturn()).toBeNull()
  })
})
