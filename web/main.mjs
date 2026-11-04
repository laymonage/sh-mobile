import { MENU } from './engine/game.mjs';
import { createGame } from './engine/mobile2.mjs';
import { GameClock } from './engine/clock.mjs';
import { ARCHIVE_JARS, inspectJar } from './engine/jar.mjs';
import { SoundFont } from './engine/soundfont.mjs';
import { SoundPlayer } from './audio.mjs';
import { deleteStoredArchiveJar, loadStoredArchiveJar, storeArchiveJar } from './jar-store.mjs';
import { deleteStoredSoundFont, loadStoredSoundFont, storeSoundFont } from './soundfont-store.mjs';
import { Renderer } from './renderer.mjs';
import { fitText } from './fit-text.mjs';

const TICK_MS = 60;
const MAX_TICKS_PER_FRAME = 5;
const LOAD_CONFIRM_MS = 3000;
const PANEL_SHAPE_RATIO = 0.27;
// The three rows of buttons, the gaps between them, and the panel's padding.
const STRIP_PANEL_HEIGHT = '105px';
// By the keys' positions, so that they sit the same way on a French or German keyboard.
const DIRECTIONS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};
const HOTSPOT_KEYS = { KeyE: 'hotspot-next', KeyQ: 'hotspot-previous' };
const WALKS = { up: 'forward', down: 'back', left: 'left', right: 'right' };
const MENU_ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const archiveButtons = [...document.querySelectorAll('[data-archive]')];
const message = document.getElementById('message');
const canvas = document.getElementById('game');
const saveButton = document.getElementById('save');
const loadButton = document.getElementById('load');
const soundButton = document.getElementById('sound');

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function showMessage(text, kind = '') {
  message.textContent = text;
  message.className = kind;
}

// Starting afresh lets go of the game and its sound. Without the dev server's link to a
// build, this is the page with the choice of games.
function returnToStartPage() {
  const url = new URL(location.href);
  url.searchParams.delete('jar');
  location.assign(url);
}

async function start(bytes) {
  showMessage('Loading...');
  const inspection = await inspectJar(bytes);
  if (inspection.status === 'rejected') {
    showMessage(inspection.message, 'error');
    return;
  }
  showMessage(inspection.message, inspection.status === 'warning' ? 'warning' : '');

  const audio = new SoundPlayer(inspection.data);
  const clock = new GameClock();
  clock.setHidden(document.hidden);
  document.addEventListener('visibilitychange', () => clock.setHidden(document.hidden));
  const game = createGame(inspection.data, {
    roomSize: inspection.roomSize,
    roomHeight: inspection.roomHeight,
    storage: browserStorage(),
    audio,
    now: () => clock.now(),
    onQuit: returnToStartPage,
  });
  const renderer = new Renderer(canvas, game);
  layOutPage(game);
  await renderer.loadImages(inspection.data);
  showPanelArt(game);
  document.body.classList.add('playing');
  setUpSaving(game);
  setUpSound(audio);
  await setUpSoundFont(audio);
  game.showStartup();
  // Lets the browser pane and tests inspect and step a running game.
  window.game = game;
  window.renderer = renderer;
  run(game, renderer);
}

// Keeps the room's shape, and leaves space for the panel under it. The first game's panel
// is a shape of its own, in proportion to the page's width, and Mobile 2's is a set height.
function layOutPage(game) {
  const page = document.documentElement.style;
  const { PANEL_ART_IS_STRIP } = game.constructor;
  const roomRatio = game.frameHeight / game.frameWidth;
  page.setProperty('--game-aspect', String(game.frameWidth / game.frameHeight));
  page.setProperty('--page-ratio', String(PANEL_ART_IS_STRIP ? roomRatio : roomRatio + PANEL_SHAPE_RATIO));
  page.setProperty('--panel-height', PANEL_ART_IS_STRIP ? STRIP_PANEL_HEIGHT : '0px');
  document.body.classList.toggle('strip-panel', PANEL_ART_IS_STRIP);
}

// Rusted steel from the JAR, behind the page's controls.
function showPanelArt(game) {
  const art = game.data.files.get(game.constructor.PANEL_ART);
  if (!art) return;
  const url = URL.createObjectURL(new Blob([art], { type: 'image/png' }));
  document.getElementById('panel').style.backgroundImage = `url(${url})`;
}

function setUpSaving(game) {
  saveButton.addEventListener('click', () => game.canSave() && game.saveGame());

  // Loading discards progress, so it takes a second click to confirm.
  let confirmTimer = null;
  const resetLoadButton = () => {
    clearTimeout(confirmTimer);
    confirmTimer = null;
    loadButton.textContent = 'Load';
  };
  loadButton.addEventListener('click', () => {
    if (confirmTimer === null) {
      loadButton.textContent = 'Discard and load?';
      confirmTimer = setTimeout(resetLoadButton, LOAD_CONFIRM_MS);
      return;
    }
    resetLoadButton();
    game.loadGame();
  });
}

// The game's own menus can also turn sound on or off, so this follows them.
function showSoundState(audio) {
  const label = `Sound: ${audio.enabled ? 'on' : 'off'}`;
  if (soundButton.textContent === label) return;
  soundButton.textContent = label;
  soundButton.setAttribute('aria-pressed', String(audio.enabled));
}

function setUpSound(audio) {
  const volume = document.getElementById('volume');
  volume.value = Math.round(audio.volume * 100);
  volume.addEventListener('input', () => audio.setVolume(volume.valueAsNumber / 100));
  volume.addEventListener('change', () => {
    audio.play('sh_shot');
    volume.blur();
  });
  soundButton.addEventListener('click', () => {
    audio.setEnabled(!audio.enabled);
    if (audio.enabled) audio.play('sh_shot');
  });
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => audio.unlock());
  document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));
  window.audio = audio;
}

// Soundfonts have their own licenses, so players bring their own. The choice is
// kept in this browser, and is never uploaded.
async function setUpSoundFont(audio) {
  const chooseButton = document.getElementById('soundfont');
  const removeButton = document.getElementById('soundfont-remove');
  const getLink = document.getElementById('soundfont-get');
  const fileInput = document.getElementById('soundfont-file');
  const show = (name) => {
    chooseButton.textContent = name ?? 'Soundfont';
    chooseButton.title = name ? `Soundfont: ${name}` : 'Choose a soundfont';
    removeButton.hidden = !name;
    getLink.hidden = Boolean(name);
  };
  const use = async (name, bytes) => {
    await audio.setSoundFont(new SoundFont(bytes));
    show(name);
  };

  chooseButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      showMessage('Loading soundfont...');
      await use(file.name, bytes);
    } catch {
      showMessage(`${file.name} isn't a usable SoundFont 2 file.`, 'error');
      return;
    }
    showMessage('');
    if (!(await storeSoundFont(file.name, bytes)))
      showMessage("This soundfont will work until you leave, but this browser couldn't keep it.", 'warning');
  });
  removeButton.addEventListener('click', async () => {
    await audio.setSoundFont(null);
    show(null);
    await deleteStoredSoundFont();
  });

  const devName = new URLSearchParams(location.search).get('soundfont');
  if (devName) {
    const response = await fetch(`/dev-soundfont/${encodeURIComponent(devName)}`);
    if (response.ok) {
      await use(devName, new Uint8Array(await response.arrayBuffer()));
      return;
    }
  }
  const stored = devName ? null : await loadStoredSoundFont();
  try {
    if (stored) {
      await use(stored.name, stored.bytes);
      return;
    }
  } catch {
    await deleteStoredSoundFont();
  }
  await audio.setSoundFont(null);
}

// Captures the mouse while the player aims, if the setting is on. A browser only allows
// this soon after a click or key press, and lets the player end it with Esc. Then it
// stays free until they click the room.
function setUpMouseLock(game) {
  let declined = false;
  let requesting = false;
  const request = () => {
    requesting = true;
    Promise.resolve(canvas.requestPointerLock())
      .catch(() => {
        declined = true;
      })
      .finally(() => {
        requesting = false;
      });
  };
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (game.pointerLocked && !locked && game.wantsMouseLock) declined = true;
    game.pointerLocked = locked;
  });
  document.addEventListener('pointerlockerror', () => {
    declined = true;
    requesting = false;
  });
  return {
    clicked() {
      declined = false;
      if (game.wantsMouseLock && !game.pointerLocked && !requesting) request();
    },
    sync() {
      if (!game.wantsMouseLock) {
        declined = false;
        if (game.pointerLocked) document.exitPointerLock();
      } else if (!game.pointerLocked && !declined && !requesting && (navigator.userActivation?.isActive ?? true)) {
        request();
      }
    },
  };
}

function run(game, renderer) {
  const toRoom = (event) => {
    const box = canvas.getBoundingClientRect();
    return [
      ((event.clientX - box.left) / box.width) * game.frameWidth - game.viewOffsetX,
      ((event.clientY - box.top) / box.height) * game.frameHeight - game.viewOffsetY,
    ];
  };
  const syncMouseLock = setUpMouseLock(game);
  canvas.addEventListener('pointermove', (event) => {
    if (game.pointerLocked) {
      const box = canvas.getBoundingClientRect();
      game.movePointerBy(
        (event.movementX / box.width) * game.frameWidth,
        (event.movementY / box.height) * game.frameHeight,
      );
      return;
    }
    game.aimWithMouse();
    game.moveCursor(...toRoom(event));
    if (game.stroke) game.continueStroke(game.cursorX, game.cursorY);
  });
  canvas.addEventListener('pointerdown', (event) => {
    syncMouseLock.clicked();
    if (!game.pointerLocked) {
      game.moveCursor(...toRoom(event));
      renderer.updateHoveredRow();
    }
    if (event.button === 0 && !event.ctrlKey && game.wantsStroke()) {
      game.startStroke(game.cursorX, game.cursorY);
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    // On a Mac, Control-click is also a right-click.
    if (event.button === 2 || event.ctrlKey) game.pressSoftKey('right');
    else game.click();
    event.preventDefault();
  });
  canvas.addEventListener('pointerup', () => game.stroke && game.endStroke());
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  for (const button of document.querySelectorAll('#actions button')) {
    button.addEventListener('click', () => {
      if (button.dataset.key) game.pressKey(button.dataset.key);
      button.blur();
    });
  }
  const softButtons = { left: document.getElementById('soft-left'), right: document.getElementById('soft-right') };
  new ResizeObserver(() => Object.values(softButtons).forEach(fitText)).observe(document.getElementById('panel'));
  for (const [side, button] of Object.entries(softButtons)) {
    button.addEventListener('click', () => {
      game.pressSoftKey(side);
      button.blur();
    });
  }
  window.addEventListener('keydown', (event) => {
    // Esc belongs to the browser while the mouse is captured: it lets the mouse go.
    if (event.key === 'Escape' && game.pointerLocked) return;
    if (event.key === 'Escape' || /^[0-9]$/.test(event.key)) game.pressKey(event.key);
    if (event.key.toLowerCase() === 'm' && game.softKeys().left?.action === 'map') game.pressKey('map');
    if (event.key.toLowerCase() === 'i') game.pressKey('inventory');
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const direction = DIRECTIONS[event.code];
    const confirming = event.key === 'Enter' || event.key === ' ';
    // A page control that has the focus keeps these keys, as Tab's users expect.
    if ((direction || confirming) && event.target.closest?.('button, a, input, label')) return;
    const inMenu = game.mainMenu || game.popups.length || game.menus.length;
    if (direction) {
      game.holdDirection(direction, true);
      if (inMenu) game.pressKey(MENU_ARROWS[direction]);
      else if (!game.isAiming() && !event.repeat) game.pressKey(`move-${WALKS[direction]}`);
      event.preventDefault();
    }
    if (confirming) {
      if (!event.repeat) game.pressKey('Enter');
      event.preventDefault();
    }
    if (HOTSPOT_KEYS[event.code] && !inMenu) game.pressKey(HOTSPOT_KEYS[event.code]);
  });
  window.addEventListener('keyup', (event) => {
    if (DIRECTIONS[event.code]) game.holdDirection(DIRECTIONS[event.code], false);
  });
  // A key let go while the page isn't looking would otherwise stay held.
  window.addEventListener('blur', () => game.releaseDirections());
  document.addEventListener('visibilitychange', () => game.releaseDirections());

  canvas.addEventListener(
    'wheel',
    (event) => {
      if (game.mainMenu?.current?.kind !== 'text' && game.menus.at(-1)?.id !== MENU.SAY) return;
      game.pressKey(event.deltaY > 0 ? 'ArrowDown' : 'ArrowUp');
      event.preventDefault();
    },
    { passive: false },
  );

  let last = performance.now();
  let pending = 0;
  const frame = (time) => {
    pending += time - last;
    last = time;
    let ticks = 0;
    while (pending >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
      game.tick();
      pending -= TICK_MS;
      ticks++;
    }
    if (pending > TICK_MS) pending = 0;
    renderer.draw();
    syncMouseLock.sync();
    document.body.classList.toggle('in-menu', Boolean(game.mainMenu));
    document.documentElement.lang = game.language;
    if (game.audio) showSoundState(game.audio);
    const keys = game.softKeys();
    for (const [side, button] of Object.entries(softButtons)) {
      button.hidden = !keys[side];
      if (keys[side] && button.textContent !== keys[side].label) {
        button.textContent = keys[side].label;
        fitText(button);
      }
    }
    saveButton.disabled = !game.canSave();
    loadButton.disabled = !game.hasSave();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function startFromFile(file) {
  if (file) await start(new Uint8Array(await file.arrayBuffer()));
}

// The copy kept from an earlier download, if it can still be read as a game.
async function storedArchiveJar(jar) {
  const bytes = await loadStoredArchiveJar(jar);
  if (!bytes) return null;
  try {
    if ((await inspectJar(bytes)).status === 'ok') return bytes;
  } catch {
    // It's damaged, so it's replaced by a new download.
  }
  await deleteStoredArchiveJar(jar);
  return null;
}

function setArchiveButtonsDisabled(disabled) {
  for (const button of archiveButtons) button.disabled = disabled;
}

async function startFromArchive(jar) {
  setArchiveButtonsDisabled(true);
  const stored = await storedArchiveJar(jar);
  if (stored) {
    await start(stored);
    return;
  }
  showMessage('Downloading from the Internet Archive...');
  let bytes;
  try {
    const response = await fetch(jar.url, { integrity: jar.integrity });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
    await storeArchiveJar(jar, bytes);
  } catch {
    showMessage("Couldn't download the game from the Internet Archive. Try again, or choose a JAR.", 'error');
    setArchiveButtonsDisabled(false);
    return;
  }
  await start(bytes);
}

for (const button of archiveButtons) {
  button.addEventListener('click', () => startFromArchive(ARCHIVE_JARS[button.dataset.archive]));
}
fileInput.addEventListener('change', () => startFromFile(fileInput.files[0]));
drop.addEventListener('dragover', (event) => {
  event.preventDefault();
  drop.classList.add('dragging');
});
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('dragging');
  startFromFile(event.dataTransfer.files[0]);
});

// `npm run play` serves pinned builds at /dev-jar/, for testing without a file picker.
const devJar = new URLSearchParams(location.search).get('jar');
if (devJar) {
  const response = await fetch(`/dev-jar/${encodeURIComponent(devJar)}`);
  if (response.ok) await start(new Uint8Array(await response.arrayBuffer()));
  else showMessage(`Couldn't load ${devJar} from the dev server.`, 'error');
}
