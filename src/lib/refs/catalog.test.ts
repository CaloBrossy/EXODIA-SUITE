import { describe, expect, it } from 'vitest'
import { E12, E96, ELEMENTS, decode4 } from './catalog'

describe('referencias', () => {
  it('tiene el hierro y decodifica 4 bandas', () => {
    const fe = ELEMENTS.find((e) => e.name === 'Hierro')
    expect(fe).toMatchObject({ z: 26, sym: 'Fe', state: 'sólido' })
    expect(decode4(1, 0, 2, 5)).toMatchObject({ value: 1000, tol: 5 })
    expect(E12).toHaveLength(12)
    expect(E96).toHaveLength(96)
  })
})
