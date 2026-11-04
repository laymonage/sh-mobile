// Keeps the player's chosen soundfont in this browser. Soundfonts are megabytes, so
// they go in IndexedDB rather than local storage. Everything here fails quietly: the
// game just asks again next time.
import { withStore } from './browser-database.mjs';

const STORE = 'soundfonts';
const KEY = 'current';

export async function storeSoundFont(name, bytes) {
  try {
    await withStore(STORE, 'readwrite', (store) => store.put({ name, bytes }, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadStoredSoundFont() {
  try {
    return (await withStore(STORE, 'readonly', (store) => store.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteStoredSoundFont() {
  try {
    await withStore(STORE, 'readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing else to do: it's gone or was never there.
  }
}
