// Keeps the Internet Archive's JAR in this browser, so that it's downloaded only once.
// A copy is kept with the hash it was checked against, so a new pin ignores an old copy.
// Everything here fails quietly: the game just downloads it again next time.
import { withStore } from './browser-database.mjs';

const STORE = 'jars';
const KEY = 'archive';

export async function storeArchiveJar(integrity, bytes) {
  try {
    await withStore(STORE, 'readwrite', (store) => store.put({ integrity, bytes }, KEY));
  } catch {
    // It still works until the page is closed.
  }
}

export async function loadStoredArchiveJar(integrity) {
  try {
    const stored = await withStore(STORE, 'readonly', (store) => store.get(KEY));
    return stored?.integrity === integrity ? stored.bytes : null;
  } catch {
    return null;
  }
}

export async function deleteStoredArchiveJar() {
  try {
    await withStore(STORE, 'readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing else to do: it's gone or was never there.
  }
}
