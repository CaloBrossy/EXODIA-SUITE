import { useSyncExternalStore } from 'react'
import { readConflict, subscribeConflict } from '@/services/sync'

export function useSyncConflict(): boolean {
  return useSyncExternalStore(subscribeConflict, readConflict)
}
