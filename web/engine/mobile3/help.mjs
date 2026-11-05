// Mobile 3's Controls page and its puzzles' instructions describe a phone: its keypad, or a
// touch screen. This rewrites them for a mouse and keyboard, as help-text.mjs does for the first
// game, and keeps everything else in the JAR's own words: the list of the main menu's rows that
// ends the Controls page, and the riddle that starts the bottles' instructions. The translations
// are this port's own. A line that doesn't read as expected, as a fan translation might not, keeps
// its original text.

// By puzzle number. Keypad and touch builds take their instructions from different lines.
const PUZZLES = [null, 'phone', 'papers', 'clock', 'safe', 'bottles', 'pearls'];
// The port's own setting, as the other two games word it.
export const MOUSE_RECOIL_LABELS = {
  English: 'Mouse recoil: ',
  Français: 'Recul souris : ',
  Deutsch: 'Maus-Rückstoß: ',
  Italiano: 'Rinculo mouse: ',
  Español: 'Retroceso ratón: ',
  Português: 'Recuo rato: ',
};

// Every language's instructions name the phone's keys, or say to touch the screen.
const PHONE_KEYS = /RSK|LSK|funz|Auswahltaste|Soft-Taste|Touch|Berühr|Tocca|Toca|\b5\b/;
// The safe's and the bottles' instructions start with words in quotes, and then explain the keys.
const RIDDLE = /^"[^"]*"\.?/;
const STARTS_WITH_RIDDLE = new Set(['safe', 'bottles']);

const HELP = {
  English: {
    menuList: 'Play Game - ',
    controls: [
      'Move the cursor:\nMouse',
      "Select, interact, fire, or press a puzzle's buttons:\nClick / Enter / Space",
      'Back, leave a puzzle, or open the pause menu:\nRight click / Esc',
      'The left button under the screen, for the map, dialogue, menus, and confirming or turning things in puzzles:\nC',
      'Walk:\nW or the up arrow walks forward, A and D or the left and right arrows turn, and S or the down arrow turns back or leaves a room. Clicking the middle, the sides or the bottom of the screen does the same.',
      'Next / previous thing to click:\nE / Q',
      'Aim, or move the cursor in a puzzle:\nMouse / W / A / S / D / Arrow keys',
      'Change weapon:\n1',
      'Use a health pack or medipack:\n3',
      'Inventory:\nI',
      'Map, once you have it:\nM. Change floors with A and D, the left and right arrows, or the arrows on the map.',
      'Menus:\nMouse / Up / Down',
      'Long text:\nClick or Enter to read on',
      'Numbers on the phone and the safe:\n0 to 9',
      'Equip a weapon:\nOpen the inventory, choose the weapon, and equip it.',
      'Reload:\nOutside fights, open the inventory and use the bullets. In a fight, an empty weapon reloads by itself, which takes longer for the bigger guns.',
    ],
    targets:
      'Targets:\nIn a fight, a green ring sometimes appears. Click it for a sure hit. A red ring on the monster is a critical hit, twice as hard.',
    phone: '"Click a button, or type its number. Right click or press Esc to leave."',
    papers:
      '"Click a paper to pick it up, and move it with the mouse or W, A, S and D. Press C to turn it, and click or right click to put it down. Right click or press Esc to leave."',
    clock:
      '"Click the buttons, or hold them down. The left one turns time back and the right one forward, as A and D do. Press C to confirm, and right click or press Esc to leave."',
    safe: 'Click the buttons to change the number and the dial to move to the next one, or type the numbers. Press C to confirm, and right click or press Esc to leave.',
    bottles:
      'Click a bottle to choose it, then click another to fill it. Clicking the chosen bottle again lets it go. Right click or press Esc to leave.',
    pearls:
      'Put the pearls from your inventory into the cavities: click a cavity to choose a pearl for it. Press C to confirm, and right click or press Esc to leave.',
  },
  Français: {
    menuList: 'Jouer - ',
    controls: [
      'Déplacer le curseur :\nSouris',
      "Choisir, interagir, tirer ou appuyer sur les boutons d'une énigme :\nClic / Entrée / Espace",
      'Retour, quitter une énigme ou ouvrir le menu Pause :\nClic droit / Échap',
      "Le bouton gauche sous l'écran, pour le plan, les dialogues, les menus, et pour valider ou tourner dans les énigmes :\nC",
      "Marcher :\nW ou la flèche haut fait avancer, A et D ou les flèches gauche et droite font pivoter, et S ou la flèche bas fait demi-tour ou quitter une pièce. Cliquer au milieu, sur les côtés ou en bas de l'écran fait de même.",
      'Objet suivant / précédent :\nE / Q',
      'Viser, ou déplacer le curseur dans une énigme :\nSouris / W / A / S / D / Touches fléchées',
      "Changer d'arme :\n1",
      'Utiliser une trousse de soins ou un medipack :\n3',
      'Inventaire :\nI',
      "Plan, une fois trouvé :\nM. Changez d'étage avec A et D, les flèches gauche et droite, ou les flèches du plan.",
      'Menus :\nSouris / Haut / Bas',
      'Texte long :\nClic ou Entrée pour continuer',
      'Chiffres du téléphone et du coffre :\n0 à 9',
      "Prendre une arme :\nOuvrez l'inventaire, choisissez l'arme et équipez-la.",
      "Recharger :\nHors combat, ouvrez l'inventaire et utilisez les balles. En combat, une arme vide se recharge seule, plus lentement pour les grosses armes.",
    ],
    targets:
      'Cibles :\nPendant un combat, un cercle vert apparaît parfois. Cliquez dessus pour toucher à coup sûr. Un cercle rouge sur le monstre donne un coup critique, deux fois plus fort.',
    phone: '"Clique sur un bouton ou tape son chiffre. Clic droit ou Échap pour sortir."',
    papers:
      '"Clique sur un papier pour le prendre, et déplace-le avec la souris ou W, A, S et D. Appuie sur C pour le tourner, et clique ou fais un clic droit pour le poser. Clic droit ou Échap pour sortir."',
    clock:
      '"Clique sur les boutons ou maintiens-les enfoncés. Celui de gauche fait reculer le temps et celui de droite le fait avancer, comme A et D. Appuie sur C pour valider, et fais un clic droit ou appuie sur Échap pour sortir."',
    safe: 'Cliquez sur les boutons pour changer le chiffre et sur le cadran pour passer au suivant, ou tapez les chiffres. Appuyez sur C pour valider, et faites un clic droit ou appuyez sur Échap pour quitter.',
    bottles:
      'Cliquez sur une bouteille pour la choisir, puis sur une autre pour la remplir. Cliquer de nouveau sur la bouteille choisie la relâche. Clic droit ou Échap pour quitter.',
    pearls:
      'Placez les perles de votre inventaire dans les cavités : cliquez sur une cavité pour choisir sa perle. Appuyez sur C pour valider, et faites un clic droit ou appuyez sur Échap pour quitter.',
  },
  Deutsch: {
    menuList: 'Spielen - ',
    controls: [
      'Cursor bewegen:\nMaus',
      'Auswählen, benutzen, feuern oder die Tasten eines Rätsels drücken:\nKlick / Eingabetaste / Leertaste',
      'Zurück, ein Rätsel verlassen oder das Pausenmenü öffnen:\nRechtsklick / Esc',
      'Die linke Schaltfläche unter dem Bildschirm, für die Karte, Dialoge, Menüs und zum Bestätigen oder Drehen in Rätseln:\nC',
      'Laufen:\nMit W oder der Pfeiltaste nach oben laufen Sie vorwärts, A und D oder die Pfeiltasten nach links und rechts drehen Sie, und S oder die Pfeiltaste nach unten dreht Sie um oder verlässt einen Raum. Ein Klick in die Mitte, an die Seiten oder unten auf den Bildschirm tut dasselbe.',
      'Nächstes / vorheriges anklickbares Objekt:\nE / Q',
      'Zielen oder den Cursor in einem Rätsel bewegen:\nMaus / W / A / S / D / Pfeiltasten',
      'Waffe wechseln:\n1',
      'Erste-Hilfe-Kasten oder Medipack verwenden:\n3',
      'Inventar:\nI',
      'Karte, sobald Sie sie haben:\nM. Mit A und D, den Pfeiltasten nach links und rechts oder den Pfeilen auf der Karte wechseln Sie das Stockwerk.',
      'Menüs:\nMaus / Nach oben / Nach unten',
      'Langer Text:\nKlick oder Eingabetaste zum Weiterlesen',
      'Ziffern am Telefon und am Safe:\n0 bis 9',
      'Waffe ausrüsten:\nÖffnen Sie das Inventar, wählen Sie die Waffe und rüsten Sie sie aus.',
      'Nachladen:\nAußerhalb von Kämpfen öffnen Sie das Inventar und verwenden die Munition. Im Kampf lädt eine leere Waffe von selbst nach, bei größeren Waffen dauert es länger.',
    ],
    targets:
      'Ziele:\nIm Kampf erscheint manchmal ein grüner Ring. Klicken Sie darauf für einen sicheren Treffer. Ein roter Ring auf dem Monster ist ein kritischer Treffer, doppelt so stark.',
    phone: '"Klicke auf eine Taste oder tippe ihre Ziffer. Rechtsklick oder Esc zum Beenden."',
    papers:
      '"Klicke auf ein Papierstück, um es aufzunehmen, und bewege es mit der Maus oder W, A, S und D. Drücke C, um es zu drehen, und klicke oder rechtsklicke, um es abzulegen. Rechtsklick oder Esc zum Beenden."',
    clock:
      '"Klicke auf die Tasten oder halte sie gedrückt. Die linke dreht die Zeit zurück, die rechte vor, wie A und D. Drücke C zum Bestätigen und Rechtsklick oder Esc zum Beenden."',
    safe: 'Klicke auf die Tasten, um die Ziffer zu ändern, und auf die Wählscheibe, um zur nächsten zu gehen, oder tippe die Ziffern. Drücke C zum Bestätigen und Rechtsklick oder Esc zum Beenden.',
    bottles:
      'Klicke auf eine Flasche, um sie zu wählen, und dann auf eine andere, um sie zu füllen. Ein weiterer Klick auf die gewählte Flasche hebt die Auswahl auf. Rechtsklick oder Esc zum Beenden.',
    pearls:
      'Setze die Perlen aus deinem Inventar in die Hohlräume: Klicke auf einen Hohlraum, um eine Perle dafür zu wählen. Drücke C zum Bestätigen und Rechtsklick oder Esc zum Beenden.',
  },
  Italiano: {
    menuList: 'Gioca - ',
    controls: [
      'Spostare il cursore:\nMouse',
      'Scegliere, interagire, sparare o premere i pulsanti di un enigma:\nClic / Invio / Spazio',
      'Indietro, uscire da un enigma o aprire il menu di pausa:\nClic destro / Esc',
      'Il pulsante sinistro sotto lo schermo, per la mappa, i dialoghi, i menu e per confermare o ruotare negli enigmi:\nC',
      'Camminare:\nW o la freccia su fa avanzare, A e D o le frecce sinistra e destra fanno girare, e S o la freccia giù fa tornare indietro o uscire da una stanza. Fare clic al centro, ai lati o in basso sullo schermo fa lo stesso.',
      'Oggetto successivo / precedente:\nE / Q',
      'Mirare, o spostare il cursore in un enigma:\nMouse / W / A / S / D / Tasti freccia',
      'Cambiare arma:\n1',
      'Usare un kit di pronto soccorso o un medipack:\n3',
      'Inventario:\nI',
      'Mappa, una volta trovata:\nM. Si cambia piano con A e D, le frecce sinistra e destra o le frecce sulla mappa.',
      'Menu:\nMouse / Su / Giù',
      'Testo lungo:\nClic o Invio per proseguire',
      'Numeri del telefono e della cassaforte:\n0-9',
      "Equipaggiare un'arma:\nAprire l'inventario, scegliere l'arma ed equipaggiarla.",
      "Ricaricare:\nFuori dai combattimenti, aprire l'inventario e usare i proiettili. In combattimento, un'arma scarica si ricarica da sola, e per le armi più grosse ci vuole di più.",
    ],
    targets:
      'Bersagli:\nIn combattimento a volte appare un cerchio verde. Facendo clic su di esso il colpo va a segno di sicuro. Un cerchio rosso sul mostro dà un colpo critico, due volte più forte.',
    phone: '"Fai clic su un pulsante o digita il suo numero. Clic destro o Esc per uscire."',
    papers:
      '"Fai clic su un foglio per prenderlo e spostalo con il mouse o con W, A, S e D. Premi C per ruotarlo, e fai clic o clic destro per posarlo. Clic destro o Esc per uscire."',
    clock:
      '"Fai clic sui pulsanti o tienili premuti. Quello sinistro fa scorrere il tempo all\'indietro e quello destro in avanti, come A e D. Premi C per confermare, e clic destro o Esc per uscire."',
    safe: 'Fai clic sui pulsanti per cambiare la cifra e sulla manopola per passare alla successiva, oppure digita le cifre. Premi C per confermare, e clic destro o Esc per uscire.',
    bottles:
      "Fai clic su una bottiglia per sceglierla, poi su un'altra per riempirla. Facendo di nuovo clic sulla bottiglia scelta la lasci. Clic destro o Esc per uscire.",
    pearls:
      'Metti le perle del tuo inventario nelle cavità: fai clic su una cavità per scegliere la perla da metterci. Premi C per confermare, e clic destro o Esc per uscire.',
  },
  Español: {
    menuList: 'Jugar - ',
    controls: [
      'Mover el cursor:\nRatón',
      'Elegir, interactuar, disparar o pulsar los botones de un acertijo:\nClic / Intro / Espacio',
      'Volver, salir de un acertijo o abrir el menú de pausa:\nClic derecho / Esc',
      'El botón izquierdo bajo la pantalla, para el mapa, los diálogos, los menús y para confirmar o girar en los acertijos:\nC',
      'Caminar:\nW o la flecha arriba te hace avanzar, A y D o las flechas izquierda y derecha te hacen girar, y S o la flecha abajo te hace dar la vuelta o salir de una habitación. Hacer clic en el centro, en los lados o abajo en la pantalla hace lo mismo.',
      'Objeto siguiente / anterior:\nE / Q',
      'Apuntar, o mover el cursor en un acertijo:\nRatón / W / A / S / D / Teclas de flecha',
      'Cambiar de arma:\n1',
      'Usar un botiquín o un medipack:\n3',
      'Inventario:\nI',
      'Mapa, cuando lo tengas:\nM. Cambia de planta con A y D, las flechas izquierda y derecha o las flechas del mapa.',
      'Menús:\nRatón / Arriba / Abajo',
      'Texto largo:\nClic o Intro para seguir leyendo',
      'Números del teléfono y de la caja fuerte:\n0 a 9',
      'Equipar un arma:\nAbre el inventario, elige el arma y equípala.',
      'Recargar:\nFuera de los combates, abre el inventario y usa las balas. En un combate, un arma vacía se recarga sola, y las armas más grandes tardan más.',
    ],
    targets:
      'Dianas:\nEn un combate aparece a veces un círculo verde. Haz clic en él para acertar seguro. Un círculo rojo sobre el monstruo da un golpe crítico, el doble de fuerte.',
    phone: '"Haz clic en un botón o escribe su número. Clic derecho o Esc para salir."',
    papers:
      '"Haz clic en un papel para cogerlo y muévelo con el ratón o con W, A, S y D. Pulsa C para girarlo, y haz clic o clic derecho para soltarlo. Clic derecho o Esc para salir."',
    clock:
      '"Haz clic en los botones o mantenlos pulsados. El izquierdo retrasa el tiempo y el derecho lo adelanta, como A y D. Pulsa C para confirmar, y clic derecho o Esc para salir."',
    safe: 'Haz clic en los botones para cambiar el número y en el dial para pasar al siguiente, o escribe los números. Pulsa C para confirmar, y clic derecho o Esc para salir.',
    bottles:
      'Haz clic en una botella para elegirla y luego en otra para llenarla. Al hacer clic de nuevo en la botella elegida, se suelta. Clic derecho o Esc para salir.',
    pearls:
      'Pon las perlas de tu inventario en las cavidades: haz clic en una cavidad para elegir su perla. Pulsa C para confirmar, y clic derecho o Esc para salir.',
  },
  Português: {
    menuList: 'Jogar - ',
    controls: [
      'Mover o cursor:\nRato',
      'Escolher, interagir, disparar ou premir os botões de um enigma:\nClique / Enter / Espaço',
      'Voltar, sair de um enigma ou abrir o menu de pausa:\nClique direito / Esc',
      'O botão esquerdo por baixo do ecrã, para o mapa, os diálogos, os menus e para confirmar ou rodar nos enigmas:\nC',
      'Andar:\nW ou a seta para cima faz avançar, A e D ou as setas esquerda e direita fazem rodar, e S ou a seta para baixo faz voltar para trás ou sair de uma sala. Clicar no meio, nos lados ou em baixo no ecrã faz o mesmo.',
      'Objeto seguinte / anterior:\nE / Q',
      'Apontar, ou mover o cursor num enigma:\nRato / W / A / S / D / Teclas de seta',
      'Mudar de arma:\n1',
      'Usar um kit de primeiros socorros ou um medipack:\n3',
      'Inventário:\nI',
      'Mapa, depois de o encontrares:\nM. Muda de piso com A e D, as setas esquerda e direita ou as setas do mapa.',
      'Menus:\nRato / Cima / Baixo',
      'Texto longo:\nClique ou Enter para continuar a ler',
      'Números do telefone e do cofre:\n0 a 9',
      'Equipar uma arma:\nAbre o inventário, escolhe a arma e equipa-a.',
      'Recarregar:\nFora dos combates, abre o inventário e usa as balas. Num combate, uma arma vazia recarrega sozinha, e as armas maiores demoram mais.',
    ],
    targets:
      'Alvos:\nNum combate aparece por vezes um círculo verde. Clica nele para acertar de certeza. Um círculo vermelho sobre o monstro dá um golpe crítico, duas vezes mais forte.',
    phone: '"Clica num botão ou escreve o seu número. Clique direito ou Esc para sair."',
    papers:
      '"Clica num papel para o pegar e desloca-o com o rato ou com W, A, S e D. Prime C para o rodar, e clica ou faz clique direito para o pousar. Clique direito ou Esc para sair."',
    clock:
      '"Clica nos botões ou mantém-nos premidos. O da esquerda recua o tempo e o da direita avança-o, tal como A e D. Prime C para confirmar, e clique direito ou Esc para sair."',
    safe: 'Clica nos botões para mudar o número e no mostrador para passar ao seguinte, ou escreve os números. Prime C para confirmar, e clique direito ou Esc para sair.',
    bottles:
      'Clica numa garrafa para a escolher e depois noutra para a encher. Clicar de novo na garrafa escolhida larga-a. Clique direito ou Esc para sair.',
    pearls:
      'Põe as pérolas do teu inventário nas cavidades: clica numa cavidade para escolher a sua pérola. Prime C para confirmar, e clique direito ou Esc para sair.',
  },
};

// The Controls page, ending with the JAR's own list of the main menu's rows.
export function controlsText(game, original) {
  const help = HELP[game.languageName];
  const menuList = help ? original.indexOf(help.menuList) : -1;
  if (menuList < 0) return original;
  const sections = [...help.controls];
  if (game.data.hardCoded.targets) sections.push(help.targets);
  return [...sections, original.slice(menuList).trim()].join('\n\n');
}

// A puzzle's instructions, from a line of the language file.
export function puzzleText(game, line, number) {
  const original = game.lines[line];
  const help = HELP[game.languageName];
  const name = PUZZLES[number];
  if (!help || !name) return original;
  if (!STARTS_WITH_RIDDLE.has(name)) return PHONE_KEYS.test(original) ? help[name] : original;
  // The keypad builds' safe has the riddle alone.
  const riddle = RIDDLE.exec(original);
  if (!riddle || !PHONE_KEYS.test(original.slice(riddle[0].length))) return original;
  return `${riddle[0]} ${help[name]}`;
}
