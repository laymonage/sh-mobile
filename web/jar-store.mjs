// Keeps the Internet Archive's JAR in this browser, so that it's downloaded only once.
// A copy is kept with the hash it was checked against, so a new pin ignores an old copy.
// Everything here fails quietly: the game just downloads it again next time.
import { withStore } from './browser-database.mjs';

const STORE = 'jars';

export async function storeArchiveJar({ storageKey, integrity }, bytes) {
  try {
    await withStore(STORE, 'readwrite', (store) => store.put({ integrity, bytes }, storageKey));
  } catch {
    // It still works until the page is closed.
  }
}

export async function loadStoredArchiveJar({ storageKey, integrity }) {
  try {
    const stored = await withStore(STORE, 'readonly', (store) => store.get(storageKey));
    return stored?.integrity === integrity ? stored.bytes : null;
  } catch {
    return null;
  }
}

export async function deleteStoredArchiveJar({ storageKey }) {
  try {
    await withStore(STORE, 'readwrite', (store) => store.delete(storageKey));
  } catch {
    // Nothing else to do: it's gone or was never there.
  }
}
