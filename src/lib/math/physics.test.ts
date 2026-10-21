import { describe, expect, it } from 'vitest'
import {
  collision1D,
  energyConservation,
  equivalentResistance,
  hydrogenTransition,
  idealGasLaw,
  inclinedPlane,
  mruv,
  ohm,
  PhysicsInputError,
  projectile,
} from './physics'
import { migrateConceptV2, migrateFormulaV2 } from '@/db/migrations'

describe('cinemática', () => {
  it('MRUV', () => {
    expect(mruv(0, 10, 2, 5)).toEqual({ x: 75, v: 20 })
    expect(() => mruv(0, 1, 1, -1)).toThrow(PhysicsInputError)
  })
  it('tiro oblicuo a 45° desde el suelo: alcance v²/g', () => {
    const r = projectile(20, 45, 0, 9.8)
    expect(r.range).toBeCloseTo(400 / 9.8, 9)
    expect(r.hMax).toBeCloseTo(100 / 9.8, 9)
    expect(r.impactSpeed).toBeCloseTo(20, 9)
  })
  it('tiro horizontal desde altura', () => {
    const r = projectile(5, 0, 19.6, 9.8)
    expect(r.tFlight).toBeCloseTo(2, 12)
    expect(r.range).toBeCloseTo(10, 12)
  })
})

describe('dinámica', () => {
  it('plano inclinado: reposo si tanθ ≤ μs', () => {
    const r = inclinedPlane(5, 20, 0.4, 0.3, 10)
    expect(r.moves).toBe(false)
    expect(r.a).toBe(0)
    expect(r.friction).toBeCloseTo(r.parallel, 12)
  })
  it('plano inclinado: desliza con a = g(senθ − μk cosθ)', () => {
    const r = inclinedPlane(5, 30, 0.4, 0.3, 10)
    expect(r.moves).toBe(true)
    expect(r.a).toBeCloseTo(10 * (0.5 - 0.3 * Math.cos(Math.PI / 6)), 12)
  })
  it('rechaza μk > μs', () => expect(() => inclinedPlane(1, 30, 0.2, 0.3)).toThrow(PhysicsInputError))
})

describe('energía y choques', () => {
  it('caída libre de 10 m: v = √(2gh)', () => {
    expect(energyConservation(2, 0, 10, 0, 9.8).v2).toBeCloseTo(Math.sqrt(196), 12)
    expect(() => energyConservation(1, 0, 0, 5)).toThrow(PhysicsInputError)
  })
  it('choque elástico de masas iguales intercambia velocidades', () => {
    const r = collision1D(1, 3, 1, 0, 1)
    expect(r.u1).toBeCloseTo(0, 12)
    expect(r.u2).toBeCloseTo(3, 12)
    expect(r.kLost).toBeCloseTo(0, 12)
  })
  it('choque perfectamente inelástico conserva p y pierde energía', () => {
    const r = collision1D(2, 3, 1, 0, 0)
    expect(r.u1).toBeCloseTo(2, 12)
    expect(r.u2).toBeCloseTo(2, 12)
    expect(r.kLost).toBeCloseTo(9 - 6, 12)
  })
})

describe('circuitos y gases', () => {
  it('resistencias equivalentes', () => {
    expect(equivalentResistance([100, 220, 330], 'series')).toBe(650)
    expect(equivalentResistance([100, 100], 'parallel')).toBeCloseTo(50, 12)
    expect(() => equivalentResistance([100, 0], 'parallel')).toThrow(PhysicsInputError)
  })
  it('ley de Ohm despeja el valor faltante', () => {
    expect(ohm(12, NaN, 4)).toEqual({ V: 12, I: 3, R: 4, P: 36 })
    expect(ohm(NaN, 2, 5).V).toBe(10)
    expect(() => ohm(12, 3, 4)).toThrow(PhysicsInputError)
  })
  it('volumen molar a 0 °C y 1 atm ≈ 22.41 L', () => {
    const r = idealGasLaw({ P: 101325, V: NaN, n: 1, T: 273.15 }, 'V')
    expect(r.V * 1000).toBeCloseTo(22.414, 3)
  })
})

describe('hidrógeno', () => {
  it('Hα (3 → 2) ≈ 656.5 nm, visible, serie de Balmer', () => {
    const r = hydrogenTransition(2, 3)
    expect(r.lambdaNm).toBeCloseTo(656.47, 1)
    expect(r.series).toBe('Balmer')
    expect(r.region).toBe('visible')
  })
  it('Lyman α ≈ 121.6 nm', () => expect(hydrogenTransition(1, 2).lambdaNm).toBeCloseTo(121.57, 1))
  it('rechaza niveles inválidos', () => expect(() => hydrogenTransition(3, 2)).toThrow(PhysicsInputError))
})

describe('migración v2', () => {
  it('reubica las rutas de herramientas', () => {
    expect(migrateFormulaV2({ id: 'f-shannon', toolPath: '/workbench/entropy' }).toolPath).toBe('/workbench/math?t=shannon')
    expect(migrateFormulaV2({ id: 'f-entropia-isotermica', toolPath: '/workbench/entropy' }).toolPath).toBe('/workbench/physics?t=entropy')
  })
  it('no pisa observaciones editadas por el usuario', () => {
    expect(migrateConceptV2({ id: 'c-ohm', seed: true, observations: 'mía' }).observations).toBe('mía')
    expect(migrateConceptV2({ id: 'c-ohm', seed: true, observations: '' }).observations).toContain('Física')
  })
})
