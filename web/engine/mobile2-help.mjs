// Mobile 2's tutorial and Help describe a phone: a keypad in most builds, and the touch
// build's icons in sh2-2015-base. This rewrites the parts about controls for a mouse and
// keyboard, as help-text.mjs does for the first game, and keeps the rest in the JAR's own
// words. Some JARs hold fan translations under another language's name, so each is
// recognized by its wording, and one that isn't listed here keeps its original text.
// The translations are this port's own, and the page's buttons are named in English
// because they stay in English.

// Where the tutorial's lines sit. They're the same in every build.
const TUTORIAL_LINES = { 1: 'interact', 6: 'turn', 7: 'turnKeys', 8: 'forwardKeys', 9: 'weapon', 11: 'firstAid' };
// These go with the touch build's pictures of its icons, which it shows as it says them.
const TOUCH_TUTORIAL_LINES = {
  12: 'walkIcon',
  13: 'cycleIcon',
  14: 'inventoryIcon',
  15: 'firstAidIcon',
  16: 'weaponIcon',
};
const FIRST_LINE = 1;

const HELP = [
  {
    original: /soft keys/i,
    pipe: /equip\/unequip steel pipe/i,
    gun: /equip\/unequip gun/i,
    interact: 'Click, or use the buttons under the screen, to interact with menus and message windows.',
    turn: 'Clicking the left, right or bottom edge of a corridor turns you around.',
    turnKeys: 'A and D or the left and right arrow keys do the same, and S or the down arrow key turns you back.',
    forwardKeys: 'W or the up arrow key walks forward, when you can.',
    weapon: 'Press 1 or the Gun button to enter/exit weapon mode.',
    firstAid: 'Use the first-aid kit to restore health by pressing 3 or the First aid button.',
    walkIcon: 'Walk with W, A, S and D or the arrow keys, or by clicking where you want to go.',
    cycleIcon: 'Press Q or E to move the cursor to the previous or next thing you can click.',
    inventoryIcon: 'Press I or the Inventory button to enter your inventory.',
    firstAidIcon: 'Press 3 or the First aid button to use a first-aid kit.',
    weaponIcon: 'Press 1 or the Gun button to enter combat mode.',
    equipPipe: 'Press 1 or the Gun button to equip/unequip steel pipe',
    equipGun: 'Press 1 or the Gun button to equip/unequip gun.',
    navigation: 'For navigation, click the arrows, or use W, A, S and D or the arrow keys.',
    gunHelp: 'Crosshair/gun, equip and unequip by pressing 1 or the Gun button.',
    controls: [
      'Move cursor:\nMouse',
      'Next / previous object:\nE / Q',
      'Aim:\nMouse / W / A / S / D / Arrow keys',
      'Open context menu:\nClick / Enter (only when the cursor is highlighted)',
      'Close context menu:\nRight click / Esc',
      'Walk and turn:\nW / A / S / D / Arrow keys (or click an arrow or the edge of a corridor)',
      'Equip / unequip weapon:\n1',
      'Use first-aid kit:\n3',
      'Menu selection:\nMouse / Up / Down',
      'Scroll text:\nMouse wheel / Up / Down',
      'Select item / Fire:\nClick / Enter / Space',
      'Open pause menu:\nRight click / Esc',
      'Open Map:\nM (only after you acquire the map)',
      'Open the inventory:\nI',
    ],
    drawing: 'Draw on a puzzle:\nHold the left mouse button and drag',
  },
  {
    original: /touches de sélection/i,
    pipe: /prendre\/lâcher le tuyau/i,
    gun: /prendre\/lâcher le pistolet/i,
    interact: "Cliquez ou utilisez les boutons sous l'écran pour interagir avec les menus et les fenêtres de messages.",
    turn: 'Cliquer sur le bord gauche, droit ou bas d\u2019un couloir vous fait pivoter.',
    turnKeys:
      'A et D ou les touches fléchées gauche et droite font de même, et S ou la flèche bas vous fait faire demi-tour.',
    forwardKeys: 'W ou la flèche haut vous fait avancer, quand c\u2019est possible.',
    weapon: 'Appuyez sur 1 ou sur le bouton Gun pour activer/désactiver le mode Arme.',
    firstAid: 'Utilisez le kit de premiers secours en appuyant sur 3 ou sur le bouton First aid.',
    walkIcon: 'Marchez avec W, A, S et D ou les touches fléchées, ou en cliquant là où vous voulez aller.',
    cycleIcon: 'Appuyez sur Q ou E pour placer le curseur sur l\u2019objet précédent ou suivant.',
    inventoryIcon: 'Appuyez sur I ou sur le bouton Inventory pour ouvrir l\u2019inventaire.',
    firstAidIcon: 'Appuyez sur 3 ou sur le bouton First aid pour utiliser le kit de premiers secours.',
    weaponIcon: 'Appuyez sur 1 ou sur le bouton Gun pour passer en mode Combat.',
    equipPipe: 'Appuyez sur 1 ou sur le bouton Gun pour prendre/lâcher le tuyau en acier',
    equipGun: 'Appuyez sur 1 ou sur le bouton Gun pour prendre/lâcher le pistolet',
    navigation: 'Pour naviguer, cliquez sur les flèches, ou utilisez W, A, S et D ou les touches fléchées.',
    gunHelp: 'Réticule/pistolet, prendre et lâcher en appuyant sur 1 ou sur le bouton Gun.',
    controls: [
      'Déplacer le curseur\u00a0:\nSouris',
      'Objet suivant / précédent\u00a0:\nE / Q',
      'Viser\u00a0:\nSouris / W / A / S / D / Touches fléchées',
      'Ouvrir le menu contextuel\u00a0:\nClic / Entrée (quand le curseur est en surbrillance)',
      'Fermer le menu contextuel\u00a0:\nClic droit / Échap',
      'Marcher et pivoter\u00a0:\nW / A / S / D / Touches fléchées (ou cliquer sur une flèche ou le bord d\u2019un couloir)',
      'Prendre / lâcher l\u2019arme\u00a0:\n1',
      'Utiliser le kit de premiers secours\u00a0:\n3',
      'Sélection dans les menus\u00a0:\nSouris / Haut / Bas',
      'Faire défiler le texte\u00a0:\nMolette / Haut / Bas',
      'Choisir un objet / Tirer\u00a0:\nClic / Entrée / Espace',
      'Ouvrir le menu Pause\u00a0:\nClic droit / Échap',
      'Ouvrir le plan\u00a0:\nM (après l\u2019avoir trouvé)',
      'Ouvrir l\u2019inventaire\u00a0:\nI',
    ],
    drawing: 'Dessiner sur une énigme\u00a0:\nMaintenir le bouton gauche de la souris et glisser',
  },
  {
    original: /Auswahltasten/i,
    pipe: /Stahlrohr auszurüsten/i,
    gun: /Waffe auszurüsten/i,
    interact:
      'Mit einem Klick oder den Schaltflächen unter dem Bildschirm können Sie Menüs und Nachrichtenfenster bedienen.',
    turn: 'Ein Klick auf den linken, rechten oder unteren Rand eines Gangs dreht Sie.',
    turnKeys:
      'A und D oder die Pfeiltasten nach links und rechts tun dasselbe, und S oder die Pfeiltaste nach unten dreht Sie um.',
    forwardKeys: 'Mit W oder der Pfeiltaste nach oben laufen Sie vorwärts, falls dies gerade möglich ist.',
    weapon: 'Drücken Sie 1 oder die Schaltfläche Gun, um den Waffenmodus aufzurufen/zu verlassen.',
    firstAid:
      'Verwenden Sie den Erste-Hilfe-Kasten, um sich zu heilen. Drücken Sie hierzu 3 oder die Schaltfläche First aid.',
    walkIcon: 'Laufen Sie mit W, A, S und D oder den Pfeiltasten, oder klicken Sie dorthin, wohin Sie gehen möchten.',
    cycleIcon: 'Mit Q oder E springt der Cursor zum vorherigen oder nächsten anklickbaren Objekt.',
    inventoryIcon: 'Drücken Sie I oder die Schaltfläche Inventory, um das Inventar aufzurufen.',
    firstAidIcon: 'Drücken Sie 3 oder die Schaltfläche First aid, um den Erste-Hilfe-Kasten zu verwenden.',
    weaponIcon: 'Drücken Sie 1 oder die Schaltfläche Gun, um den Kampfmodus zu aktivieren.',
    equipPipe: 'Drücken Sie 1 oder die Schaltfläche Gun, um das Stahlrohr auszurüsten/abzulegen.',
    equipGun: 'Drücken Sie 1 oder die Schaltfläche Gun, um die Waffe auszurüsten/abzulegen.',
    navigation: 'Zum Navigieren klicken Sie auf die Pfeile oder verwenden W, A, S und D oder die Pfeiltasten.',
    gunHelp: 'Fadenkreuz/Waffe, ausrüsten und ablegen: 1 oder die Schaltfläche Gun drücken.',
    controls: [
      'Cursor bewegen:\nMaus',
      'Nächstes / vorheriges Objekt:\nE / Q',
      'Zielen:\nMaus / W / A / S / D / Pfeiltasten',
      'Kontextmenü öffnen:\nKlick / Eingabetaste (nur wenn der Cursor markiert ist)',
      'Kontextmenü schließen:\nRechtsklick / Esc',
      'Laufen und drehen:\nW / A / S / D / Pfeiltasten (oder auf einen Pfeil oder den Rand eines Gangs klicken)',
      'Waffe ausrüsten / ablegen:\n1',
      'Erste-Hilfe-Kasten verwenden:\n3',
      'Menüauswahl:\nMaus / Nach oben / Nach unten',
      'Text scrollen:\nMausrad / Nach oben / Nach unten',
      'Objekt auswählen / Feuern:\nKlick / Eingabetaste / Leertaste',
      'Pausenmenü öffnen:\nRechtsklick / Esc',
      'Karte öffnen:\nM (erst wenn Sie die Karte haben)',
      'Inventar öffnen:\nI',
    ],
    drawing: 'Auf einem Rätsel zeichnen:\nLinke Maustaste gedrückt halten und ziehen',
  },
  {
    original: /tasti funzione/i,
    pipe: /riporre il tubo/i,
    gun: /riporre la pistola/i,
    interact: 'Fare clic o usare i pulsanti sotto lo schermo per interagire con i menu e le finestre di messaggio.',
    turn: 'Facendo clic sul bordo sinistro, destro o inferiore di un corridoio ci si gira.',
    turnKeys: 'A e D o i tasti freccia sinistra e destra fanno lo stesso, e S o la freccia giù fa tornare indietro.',
    forwardKeys: 'W o la freccia su fa avanzare, ove possibile.',
    weapon: 'Premere 1 o il pulsante Gun per entrare/uscire dalla modalità arma.',
    firstAid: 'Usare il kit di pronto soccorso per recuperare l\u2019energia premendo 3 o il pulsante First aid.',
    walkIcon: 'Camminare con W, A, S e D o i tasti freccia, oppure facendo clic dove si vuole andare.',
    cycleIcon: 'Premere Q o E per portare il cursore sull\u2019oggetto precedente o successivo.',
    inventoryIcon: 'Premere I o il pulsante Inventory per accedere all\u2019inventario.',
    firstAidIcon: 'Premere 3 o il pulsante First aid per usare il kit di pronto soccorso.',
    weaponIcon: 'Premere 1 o il pulsante Gun per accedere alla modalità combattimento.',
    equipPipe: 'Premere 1 o il pulsante Gun per equipaggiare/riporre il tubo d\u2019acciaio',
    equipGun: 'Premere 1 o il pulsante Gun per equipaggiare/riporre la pistola.',
    navigation: 'Per spostarsi, fare clic sulle frecce oppure usare W, A, S e D o i tasti freccia.',
    gunHelp: 'Mirino/pistola, equipaggiare e riporre premendo 1 o il pulsante Gun.',
    controls: [
      'Spostare il cursore:\nMouse',
      'Oggetto successivo / precedente:\nE / Q',
      'Mirare:\nMouse / W / A / S / D / Tasti freccia',
      'Aprire il menu contestuale:\nClic / Invio (solo quando il cursore è evidenziato)',
      'Chiudere il menu contestuale:\nClic destro / Esc',
      'Camminare e girarsi:\nW / A / S / D / Tasti freccia (o fare clic su una freccia o sul bordo di un corridoio)',
      'Equipaggiare / riporre l\u2019arma:\n1',
      'Usare il kit di pronto soccorso:\n3',
      'Selezione nei menu:\nMouse / Su / Giù',
      'Scorrere il testo:\nRotellina / Su / Giù',
      'Scegliere un oggetto / Sparare:\nClic / Invio / Spazio',
      'Aprire il menu di pausa:\nClic destro / Esc',
      'Aprire la mappa:\nM (solo dopo averla trovata)',
      'Aprire l\u2019inventario:\nI',
    ],
    drawing: 'Disegnare su un enigma:\nTenere premuto il tasto sinistro del mouse e trascinare',
  },
  {
    original: /teclas de selección/i,
    pipe: /equipar\/desequipar tubo/i,
    gun: /equipar\/desequipar pistola/i,
    interact: 'Haz clic o usa los botones bajo la pantalla para interactuar con los menús y ventanas de mensaje.',
    turn: 'Al hacer clic en el borde izquierdo, derecho o inferior de un pasillo, te girarás.',
    turnKeys:
      'A y D o las teclas de flecha izquierda y derecha hacen lo mismo, y S o la flecha abajo te hace dar la vuelta.',
    forwardKeys: 'W o la flecha arriba te hace avanzar, cuando sea posible.',
    weapon: 'Pulsa 1 o el botón Gun para entrar/salir del modo arma.',
    firstAid: 'Usa el botiquín para restablecer la salud pulsando 3 o el botón First aid.',
    walkIcon: 'Camina con W, A, S y D o las teclas de flecha, o haciendo clic donde quieras ir.',
    cycleIcon: 'Pulsa Q o E para llevar el cursor al objeto anterior o siguiente.',
    inventoryIcon: 'Pulsa I o el botón Inventory para acceder al inventario.',
    firstAidIcon: 'Pulsa 3 o el botón First aid para usar el botiquín.',
    weaponIcon: 'Pulsa 1 o el botón Gun para entrar en el modo combate.',
    equipPipe: 'Pulsa 1 o el botón Gun para equipar/desequipar tubo de hierro',
    equipGun: 'Pulsa 1 o el botón Gun para equipar/desequipar pistola.',
    navigation: 'Para desplazarte, haz clic en las flechas o usa W, A, S y D o las teclas de flecha.',
    gunHelp: 'Mira/pistola, equipar y desequipar pulsando 1 o el botón Gun.',
    controls: [
      'Mover el cursor:\nRatón',
      'Objeto siguiente / anterior:\nE / Q',
      'Apuntar:\nRatón / W / A / S / D / Teclas de flecha',
      'Abrir el menú contextual:\nClic / Intro (solo con el cursor resaltado)',
      'Cerrar el menú contextual:\nClic derecho / Esc',
      'Caminar y girar:\nW / A / S / D / Teclas de flecha (o clic en una flecha o en el borde de un pasillo)',
      'Equipar / desequipar arma:\n1',
      'Usar el botiquín:\n3',
      'Selección en menús:\nRatón / Arriba / Abajo',
      'Desplazar el texto:\nRueda del ratón / Arriba / Abajo',
      'Elegir objeto / Disparar:\nClic / Intro / Espacio',
      'Abrir el menú de pausa:\nClic derecho / Esc',
      'Abrir el mapa:\nM (solo después de conseguirlo)',
      'Abrir el inventario:\nI',
    ],
    drawing: 'Dibujar en un puzle:\nMantén pulsado el botón izquierdo del ratón y arrastra',
  },
  {
    original: /^Use as teclas/i,
    pipe: /equipar\/desequipar o cano/i,
    gun: /equipar\/desequipar arma/i,
    interact: 'Clique ou use os botões por baixo do ecrã para interagir com os menus e as janelas de mensagens.',
    turn: 'Clicar na margem esquerda, direita ou inferior de um corredor faz-lhe virar.',
    turnKeys:
      'A e D ou as teclas de seta esquerda e direita fazem o mesmo, e S ou a seta para baixo faz-lhe dar meia-volta.',
    forwardKeys: 'W ou a seta para cima faz-lhe andar para a frente, sempre que possível.',
    weapon: 'Prima 1 ou o botão Gun para entrar/sair do modo arma.',
    firstAid: 'Utilize a caixa de primeiros-socorros para restaurar a saúde premindo 3 ou o botão First aid.',
    walkIcon: 'Ande com W, A, S e D ou as teclas de seta, ou clicando para onde quer ir.',
    cycleIcon: 'Prima Q ou E para levar o cursor ao objecto anterior ou seguinte.',
    inventoryIcon: 'Prima I ou o botão Inventory para aceder ao inventário.',
    firstAidIcon: 'Prima 3 ou o botão First aid para usar a caixa de primeiros-socorros.',
    weaponIcon: 'Prima 1 ou o botão Gun para entrar no modo de combate.',
    equipPipe: 'Prima 1 ou o botão Gun para equipar/desequipar o cano de aço',
    equipGun: 'Prima 1 ou o botão Gun para equipar/desequipar arma.',
    navigation: 'Para navegar, clique nas setas ou use W, A, S e D ou as teclas de seta.',
    gunHelp: 'Retículo/arma, equipar e desequipar premindo 1 ou o botão Gun.',
    controls: [
      'Mover o cursor:\nRato',
      'Objecto seguinte / anterior:\nE / Q',
      'Apontar:\nRato / W / A / S / D / Teclas de seta',
      'Abrir o menu de contexto:\nClique / Enter (só com o cursor destacado)',
      'Fechar o menu de contexto:\nClique direito / Esc',
      'Andar e virar:\nW / A / S / D / Teclas de seta (ou clicar numa seta ou na margem de um corredor)',
      'Equipar / desequipar arma:\n1',
      'Usar a caixa de primeiros-socorros:\n3',
      'Selecção nos menus:\nRato / Cima / Baixo',
      'Deslocar o texto:\nRoda do rato / Cima / Baixo',
      'Escolher objecto / Disparar:\nClique / Enter / Espaço',
      'Abrir o menu de pausa:\nClique direito / Esc',
      'Abrir o mapa:\nM (só depois de o obter)',
      'Abrir o inventário:\nI',
    ],
    drawing: 'Desenhar num puzzle:\nMantenha premido o botão esquerdo do rato e arraste',
  },
];

// The wording for a language file, or null for a translation that isn't listed.
export function mobile2HelpFor(gameTexts) {
  const first = gameTexts[FIRST_LINE] ?? '';
  return HELP.find(({ original }) => original.test(first)) ?? null;
}

// The hints about the weapon that the fights give are at different places in each build,
// and the keypad builds word them differently, so they're found by what they're about.
export function adaptMobile2Texts(gameTexts, touchBuild) {
  const help = mobile2HelpFor(gameTexts);
  if (!help) return gameTexts;
  const lines = touchBuild ? { ...TUTORIAL_LINES, ...TOUCH_TUTORIAL_LINES } : TUTORIAL_LINES;
  for (const [index, name] of Object.entries(lines)) gameTexts[index] = help[name];
  return gameTexts.map((text) => {
    if (help.pipe.test(text)) return help.equipPipe;
    return help.gun.test(text) ? help.equipGun : text;
  });
}

// The page's first paragraph is about the phone's keys, and the last three are about
// walking, the weapon and aiming. Spanish has a stray paragraph about a mouth verb that
// this game doesn't have, so they're counted from the end.
export function mobile2GameplayText(original, help) {
  const paragraphs = original.split('\n\n');
  paragraphs[0] = help.interact;
  paragraphs[paragraphs.length - 3] = help.navigation;
  paragraphs[paragraphs.length - 2] = help.gunHelp;
  return paragraphs.join('\n\n');
}

export function mobile2ControlsText(help, touchBuild) {
  return (touchBuild ? [...help.controls, help.drawing] : help.controls).join('\n\n');
}
