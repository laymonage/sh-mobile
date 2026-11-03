import { Game } from './engine/game.mjs';
import { inspectJar } from './engine/jar.mjs';
import { Renderer } from './renderer.mjs';

const TICK_MS = 60;
const MAX_TICKS_PER_FRAME = 5;

const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');
const message = document.getElementById('message');
const canvas = document.getElementById('game');

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

  const game = new Game(inspection.data, { roomSize: inspection.roomSize });
  const renderer = new Renderer(canvas, game);
  await renderer.loadImages(inspection.data);
  game.startNewGame();
  document.body.classList.add('playing');
  // Lets the browser pane and tests inspect and step a running game.
  window.game = game;
  window.renderer = renderer;
  run(game, renderer);
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
