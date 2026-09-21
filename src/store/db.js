/**
 * Storage on the judge's own device.
 *
 * IndexedDB rather than localStorage: a full competition is a few thousand
 * marks, localStorage caps out around 5MB and blocks the screen while it
 * writes. A judge tapping through a 40 item inspection should never wait.
 *
 * Written against the raw API rather than a wrapper library. It is about
 * eighty lines and it is the one thing that must not lose a mark.
 */

const DB_NAME = 'markingprogress'
const DB_VERSION = 1

export const STORES = {
  COMPETITION: 'competition',
  MARKS: 'marks',
  META: 'meta',
}

let dbPromise = null

export function openDb() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB, so marks cannot be stored safely'))
      return
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains(STORES.COMPETITION)) {
        db.createObjectStore(STORES.COMPETITION, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORES.MARKS)) {
        const marks = db.createObjectStore(STORES.MARKS, { keyPath: 'id' })
        // Finding what still needs sending is the commonest query.
        marks.createIndex('sent', 'sent')
        marks.createIndex('team', 'teamId')
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  return dbPromise
}

function run(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        let result
        try {
          result = fn(store)
        } catch (err) {
          reject(err)
          return
        }
        // Resolve on transaction completion, not on request success, so a
        // write is only reported as done once it is actually committed.
        //
        // Unwrapping is an explicit type check rather than `result?.result ??
        // result`: a lookup that finds nothing has `.result === undefined`,
        // and `??` would fall through and hand back the request object
        // itself, which is truthy. That reads downstream as "found it".
        tx.oncomplete = () => {
          const isRequest =
            typeof IDBRequest !== 'undefined' && result instanceof IDBRequest
          resolve(isRequest ? result.result : result)
        }
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value))

export const putMany = (store, values) =>
  run(store, 'readwrite', (s) => {
    for (const v of values) s.put(v)
    return values.length
  })

export const get = (store, key) => run(store, 'readonly', (s) => s.get(key))

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll())

export const remove = (store, key) =>
  run(store, 'readwrite', (s) => s.delete(key))

export const clear = (store) => run(store, 'readwrite', (s) => s.clear())

/** Everything not yet confirmed by the database. */
export function getUnsent() {
  return run(STORES.MARKS, 'readonly', (s) => s.index('sent').getAll(0))
}

/** Wipe the lot. Used by the reset button while there is no backend. */
export async function resetEverything() {
  await clear(STORES.MARKS)
  await clear(STORES.COMPETITION)
  await clear(STORES.META)
}
