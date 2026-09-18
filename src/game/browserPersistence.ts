export type BrowserObjectStore = {
  get<T>(key: IDBValidKey): Promise<T | undefined>
  put<T>(key: IDBValidKey, value: T): Promise<void>
  delete(key: IDBValidKey): Promise<void>
}

export function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22
  }
  return error instanceof Error && /quota/i.test(error.name + error.message)
}

/**
 * Small IndexedDB adapter shared by browser-owned data. Callers retain their
 * existing database/store names so no migration or storage key changes.
 */
export function createBrowserObjectStore(
  databaseName: string,
  version: number,
  storeName: string,
  unavailableMessage = 'IndexedDB nicht verfügbar',
): BrowserObjectStore {
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error(unavailableMessage))
      return
    }
    const request = indexedDB.open(databaseName, version)
    request.onerror = () => reject(request.error ?? new Error(unavailableMessage))
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })

  const request = <T>(
    run: (store: IDBObjectStore) => IDBRequest<T>,
    mode: IDBTransactionMode,
  ): Promise<T> => open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const operation = run(tx.objectStore(storeName))
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB-Zugriff fehlgeschlagen'))
    operation.onsuccess = () => resolve(operation.result)
    tx.oncomplete = () => db.close()
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'))
    }
  }))

  return {
    get: <T>(key: IDBValidKey) => request<T | undefined>((store) => store.get(key), 'readonly'),
    put: <T>(key: IDBValidKey, value: T) =>
      request<IDBValidKey>((store) => store.put(value, key), 'readwrite').then(() => undefined),
    delete: (key: IDBValidKey) =>
      request<undefined>((store) => store.delete(key), 'readwrite').then(() => undefined),
  }
}
