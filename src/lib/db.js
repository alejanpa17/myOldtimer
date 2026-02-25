const DB_NAME = "myoldtimer-db";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

let dbPromise = null;

function openDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function withStore(mode, callback) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        callback(store, resolve, reject);
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function dbGet(key, fallback = null) {
  return withStore("readonly", (store, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : fallback);
    };
    request.onerror = () => reject(request.error);
  });
}

export function dbSet(key, value) {
  return withStore("readwrite", (store, resolve, reject) => {
    const request = store.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

export function dbDelete(key) {
  return withStore("readwrite", (store, resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}
