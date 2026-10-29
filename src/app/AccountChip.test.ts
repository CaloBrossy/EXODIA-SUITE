import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { accountName } from './AccountChip'

function session(email?: string, meta: Record<string, unknown> = {}): Session {
  return { user: { email, user_metadata: meta } } as Session
}

describe('accountName', () => {
  it('usa el nombre y, si no hay, la parte del correo', () => {
    expect(accountName(session('ana@exodia.test', { full_name: 'Ana' }))).toBe('Ana')
    expect(accountName(session('ana@exodia.test'))).toBe('ana')
    expect(accountName(session())).toBe('usuario')
  })
})
