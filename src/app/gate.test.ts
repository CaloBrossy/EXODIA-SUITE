import { describe, expect, it } from 'vitest'
import { rootDestination, safeReturn } from './gate'

describe('puerta de la landing', () => {
  it('manda al centro si ya entraste o hay sesión', () => {
    expect(rootDestination({ session: false, entered: false })).toBe('landing')
    expect(rootDestination({ session: true, entered: false })).toBe('/app')
    expect(rootDestination({ session: false, entered: true })).toBe('/app')
  })
  it('rechaza retornos externos', () => {
    expect(safeReturn('/settings')).toBe('/settings')
    expect(safeReturn('https://evil.test')).toBe('/app')
    expect(safeReturn('//evil.test')).toBe('/app')
    expect(safeReturn('/%2F%2Fevil.test')).toBe('/app')
    expect(safeReturn('/%09/evil')).toBe('/app')
    expect(safeReturn('/\\evil.test')).toBe('/app')
    expect(safeReturn(null)).toBe('/app')
  })
})