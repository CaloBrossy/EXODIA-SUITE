/**
 * Serializa escrituras asíncronas: cada guardado espera al anterior, de modo que una
 * escritura vieja nunca termina después de una más reciente. Si se encolan varias
 * mientras una está en curso, solo se ejecuta la última (las intermedias se descartan).
 */
export function createSaveQueue<T>(write: (value: T) => Promise<void>) {
  let running: Promise<void> | null = null
  let pending: { value: T } | null = null
  let lastError: unknown = null

  async function drain(): Promise<void> {
    while (pending) {
      const { value } = pending
      pending = null
      try {
        await write(value)
        lastError = null
      } catch (e) {
        lastError = e
        throw e
      }
    }
  }

  return {
    push(value: T): Promise<void> {
      pending = { value }
      if (!running) {
        running = drain().finally(() => {
          running = null
        })
      }
      return running
    },
    /** Espera a que terminen todas las escrituras pendientes. */
    async flush(): Promise<void> {
      while (running) await running.catch(() => undefined)
    },
    get busy() {
      return running !== null
    },
    get error() {
      return lastError
    },
  }
}
