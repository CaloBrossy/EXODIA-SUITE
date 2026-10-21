import Dexie from 'dexie'

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'StorageError'
  }
}

export function describeStorageError(e: unknown): string {
  if (e instanceof StorageError) return e.message
  if (e instanceof Dexie.QuotaExceededError || (e as { name?: string })?.name === 'QuotaExceededError') {
    return 'No hay espacio de almacenamiento disponible en el dispositivo.'
  }
  if (e instanceof Dexie.ConstraintError) return 'Conflicto de datos: ya existe un registro con ese identificador.'
  if (e instanceof Dexie.DatabaseClosedError || e instanceof Dexie.OpenFailedError) {
    return 'No se pudo abrir la base de datos local (¿navegación privada o almacenamiento bloqueado?).'
  }
  if (e instanceof Error) return e.message
  return 'Error desconocido de almacenamiento.'
}

/** Ejecuta una operación de persistencia normalizando el error. */
export async function guard<T>(what: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (e) {
    if (e instanceof StorageError) throw e
    throw new StorageError(`${what}: ${describeStorageError(e)}`, e)
  }
}
