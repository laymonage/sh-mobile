// Keeps the player's chosen soundfont in this browser. Soundfonts are megabytes, so
// they go in IndexedDB rather than local storage. Everything here fails quietly: the
// game just asks again next time.
const DATABASE = 'silent-hill-mobile';
const STORE = 'soundfonts';
const KEY = 'current';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function storeSoundFont(name, bytes) {
  try {
    await withStore('readwrite', (store) => store.put({ name, bytes }, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadStoredSoundFont() {
  try {
    return (await withStore('readonly', (store) => store.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteStoredSoundFont() {
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing else to do: it's gone or was never there.
  }
}
