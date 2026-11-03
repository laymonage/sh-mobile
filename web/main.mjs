import { Game } from './engine/game.mjs';
import { inspectJar } from './engine/jar.mjs';
import { Renderer } from './renderer.mjs';

const TICK_MS = 60;
const MAX_TICKS_PER_FRAME = 5;
const LOAD_CONFIRM_MS = 3000;

const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const message = document.getElementById('message');
const canvas = document.getElementById('game');
const saveButton = document.getElementById('save');
const loadButton = document.getElementById('load');
const continueButton = document.getElementById('continue');
const newGameButton = document.getElementById('new-game');

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

async function start(bytes) {
  showMessage('Loading...');
  const inspection = await inspectJar(bytes);
  if (inspection.status === 'rejected') {
    showMessage(inspection.message, 'error');
    return;
  }
  showMessage(inspection.message, inspection.status === 'warning' ? 'warning' : '');

  const game = new Game(inspection.data, { roomSize: inspection.roomSize, storage: browserStorage() });
  const renderer = new Renderer(canvas, game);
  await renderer.loadImages(inspection.data);
  document.body.classList.add('playing');
  setUpSaving(game);
  if (game.hasSave()) offerStart(game);
  else game.startNewGame();
  // Lets the browser pane and tests inspect and step a running game.
  window.game = game;
  window.renderer = renderer;
  run(game, renderer);
}

// The page's stand-in for the original's main menu.
function offerStart(game) {
  continueButton.hidden = !game.hasSave();
  document.body.classList.add('choosing');
}

function setUpSaving(game) {
  const begin = (start) => {
    start();
    document.body.classList.remove('choosing');
  };
  continueButton.addEventListener('click', () => begin(() => game.loadGame()));
  newGameButton.addEventListener('click', () => begin(() => game.startNewGame()));
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
      loadButton.textContent = 'Discard progress and load?';
      confirmTimer = setTimeout(resetLoadButton, LOAD_CONFIRM_MS);
      return;
    }
    resetLoadButton();
    game.loadGame();
  });
}

function run(game, renderer) {
  const toRoom = (event) => {
    const box = canvas.getBoundingClientRect();
    return [
      ((event.clientX - box.left) / box.width) * game.roomWidth,
      ((event.clientY - box.top) / box.height) * game.roomHeight,
    ];
  };
  canvas.addEventListener('pointermove', (event) => game.moveCursor(...toRoom(event)));
  canvas.addEventListener('pointerdown', (event) => {
    game.moveCursor(...toRoom(event));
    renderer.updateHoveredRow();
    game.click();
    event.preventDefault();
  });
  for (const button of document.querySelectorAll('#actions button')) {
    button.addEventListener('click', () => {
      game.pressKey(button.dataset.key);
      button.blur();
    });
  }
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || /^[0-9]$/.test(event.key)) game.pressKey(event.key);
  });

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
    if (game.ended && !document.body.classList.contains('choosing')) offerStart(game);
    saveButton.disabled = !game.canSave();
    loadButton.disabled = !game.hasSave();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function startFromFile(file) {
  if (file) await start(new Uint8Array(await file.arrayBuffer()));
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
