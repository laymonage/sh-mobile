// The Help pages and the first tutorial line describe a phone's keypad. This rewrites
// the parts about keys for a mouse and keyboard, and keeps everything else in the JAR's
// own words: the headings, the conditions in brackets and the page about the icons.
// Some JARs hold fan translations under another language's name, so each text is
// matched by its wording. A translation not listed here keeps its original text.

const GAMEPLAY_TEXT = 61;
const CONTROLS_SECTIONS = {
  moveCursor: 63,
  openMenu: 64,
  closeMenu: 65,
  weapon: 137,
  menuSelection: 66,
  select: 138,
  pause: 67,
  map: 170,
  inventory: 171,
};
const TUTORIAL_INTERACT_TEXT = Number.parseInt('j4', 36);

const placeholder = (name) => `<JAVA_APP_INK_${name}>`;
const MOVE_KEYS = [placeholder('UP'), placeholder('DOWN'), placeholder('LEFT'), placeholder('RIGHT')].join(' / ');
const MENU_KEYS = `${placeholder('UP')} / ${placeholder('DOWN')}`;
const FIRE_KEY = `${placeholder('FIRE')} (${placeholder('NUM5')})`;
const INVENTORY_KEYS = /\*.*#/;

const WEB_HELP = [
  {
    original: /softkey/i,
    interact: 'Click, or use the buttons under the screen, to interact with menus or message window.',
    mouse: 'Mouse',
    click: 'Click / Enter',
    aim: 'Aim:\nMouse / W / A / S / D / Arrow keys',
    cycle: 'Next / previous object:\nE / Q',
    back: 'Right click / Esc',
    menu: 'Mouse / Up / Down',
    select: 'Click / Enter / Space',
    walk: 'Walk:\nW / A / S / D / Arrow keys (or click an arrow)',
    scroll: 'Scroll text:\nMouse wheel / Up / Down',
  },
  {
    original: /touches de sélection/i,
    interact: "Cliquer ou utiliser les boutons sous l'écran pour interagir avec les menus ou la fenêtre des messages.",
    mouse: 'Souris',
    click: 'Clic / Entrée',
    back: 'Clic droit / Échap',
    aim: 'Viser\u00a0:\nSouris / W / A / S / D / Touches fléchées',
    cycle: 'Objet suivant / précédent\u00a0:\nE / Q',
    menu: 'Souris / Haut / Bas',
    select: 'Clic / Entrée / Espace',
    walk: 'Marcher :\nW / A / S / D / Touches fléchées (ou cliquer sur une flèche)',
    scroll: 'Faire défiler le texte :\nMolette / Haut / Bas',
  },
  {
    original: /Auswahltasten/i,
    interact: 'Mit einem Klick oder den Schaltflächen unter dem Bildschirm kannst du Menüs oder Infofelder benutzen.',
    mouse: 'Maus',
    click: 'Klick / Eingabetaste',
    aim: 'Zielen:\nMaus / W / A / S / D / Pfeiltasten',
    cycle: 'Nächstes / vorheriges Objekt:\nE / Q',
    back: 'Rechtsklick / Esc',
    menu: 'Maus / Hoch / Runter',
    select: 'Klick / Eingabetaste / Leertaste',
    walk: 'Gehen:\nW / A / S / D / Pfeiltasten (oder auf einen Pfeil klicken)',
    scroll: 'Text scrollen:\nMausrad / Hoch / Runter',
  },
  {
    original: /tasti funzione/i,
    interact: 'Fai clic o usa i pulsanti sotto lo schermo per interagire con i menu o con la finestra dei messaggi.',
    mouse: 'Mouse',
    click: 'Clic / Invio',
    back: 'Clic destro / Esc',
    aim: 'Mirare:\nMouse / W / A / S / D / Tasti freccia',
    cycle: 'Oggetto successivo / precedente:\nE / Q',
    menu: 'Mouse / Su / Giù',
    select: 'Clic / Invio / Spazio',
    walk: 'Camminare:\nW / A / S / D / Tasti freccia (o fai clic su una freccia)',
    scroll: 'Scorrere il testo:\nRotellina / Su / Giù',
  },
  {
    original: /teclas de selección/i,
    interact: 'Haz clic o utiliza los botones bajo la pantalla para usar los menús o la ventana de mensajes.',
    mouse: 'Ratón',
    click: 'Clic / Intro',
    back: 'Clic derecho / Esc',
    aim: 'Apuntar:\nRatón / W / A / S / D / Teclas de flecha',
    cycle: 'Objeto siguiente / anterior:\nE / Q',
    menu: 'Ratón / Arriba / Abajo',
    select: 'Clic / Intro / Espacio',
    walk: 'Caminar:\nW / A / S / D / Teclas de flecha (o haz clic en una flecha)',
    scroll: 'Desplazar el texto:\nRueda del ratón / Arriba / Abajo',
  },
  {
    original: /teclas de menu/i,
    interact: 'Clica ou usa os botões por baixo do ecrã para interagir com os menus ou a janela de mensagens.',
    mouse: 'Rato',
    click: 'Clique / Enter',
    aim: 'Apontar:\nRato / W / A / S / D / Teclas de seta',
    cycle: 'Objeto seguinte / anterior:\nE / Q',
    back: 'Clique direito / Esc',
    menu: 'Rato / Cima / Baixo',
    select: 'Clique / Enter / Espaço',
    walk: 'Andar:\nW / A / S / D / Teclas de seta (ou clica numa seta)',
    scroll: 'Percorrer o texto:\nRoda do rato / Cima / Baixo',
  },
];

const helpFor = (text) => WEB_HELP.find(({ original }) => original.test(text));

// The first paragraph is the only one about keys that a web player doesn't have.
function gameplayParagraphs(game) {
  return game.engineText(GAMEPLAY_TEXT).split('\n\n');
}

export function gameplayText(game) {
  const [first, ...rest] = gameplayParagraphs(game);
  const help = helpFor(first);
  return [help?.interact ?? first, ...rest].join('\n\n');
}

export function controlsText(game) {
  const help = helpFor(gameplayParagraphs(game)[0]);
  if (!help) return originalControlsText(game);
  const section = (name, keys, replacement) => game.engineText(CONTROLS_SECTIONS[name]).replace(keys, replacement);
  return [
    section('moveCursor', MOVE_KEYS, help.mouse),
    help.cycle,
    help.aim,
    section('openMenu', FIRE_KEY, help.click),
    section('closeMenu', placeholder('SOFTKEY_B'), help.back),
    help.walk,
    section('weapon', placeholder('NUM1'), '1'),
    section('menuSelection', MENU_KEYS, help.menu),
    help.scroll,
    section('select', FIRE_KEY, help.select),
    section('pause', placeholder('SOFTKEY_B'), help.back),
    section('map', placeholder('SOFTKEY_A'), 'M'),
    section('inventory', INVENTORY_KEYS, 'I'),
  ].join('\n\n');
}

// In the order ExtBase replaces them, because some of the replacements hold more of these.
const CONTROL_NAMES = [
  ['UP', 70],
  ['DOWN', 71],
  ['LEFT', 72],
  ['RIGHT', 73],
  ['NUM2', 141],
  ['NUM8', 145],
  ['NUM4', 142],
  ['NUM6', 144],
  ['FIRE', 139],
  ['NUM5', 143],
  ['SOFTKEY_B', 69],
  ['NUM1', 140],
  ['SOFTKEY_A', 68],
];

function originalControlsText(game) {
  let text = Object.values(CONTROLS_SECTIONS)
    .map((index) => game.engineText(index))
    .join('\n\n');
  for (const [name, index] of CONTROL_NAMES) text = text.replaceAll(placeholder(name), game.engineText(index));
  return text;
}

// The tutorial's first line is in the scripts' text rather than the engine's.
export function adaptTutorialText(gameTexts) {
  const line = gameTexts[TUTORIAL_INTERACT_TEXT];
  const help = line === undefined ? null : helpFor(line);
  if (help) gameTexts[TUTORIAL_INTERACT_TEXT] = help.interact;
  return gameTexts;
}
