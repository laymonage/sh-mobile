# Playing the port

`web/` is a browser port of all three games. All three can be played from a new game to the ending, and each has been played that way by hand. It reads your own JAR in the browser and doesn't upload it.

## Starting it

```bash
npm run play
```

Then open <http://localhost:8123/> and drop in a JAR, or download one from the Internet Archive by choosing a game:

| Game | Internet Archive build | Source |
| --- | --- | --- |
| Silent Hill: Mobile | `sh1-2014-base` | [archive.org](https://archive.org/details/j2me-game-glu-silenthill) |
| Silent Hill: Mobile 2 | `sh2-2015-a1`, a keypad build | [archive.org](https://archive.org/details/j2me-game-glu-silenthillmobile2) |
| Silent Hill: Mobile 3 | `sh3-2010-v1.0.20-a`, a keypad build | [archive.org](https://archive.org/details/j2me-game-connect2media-silenthillmobile3) |

The port only accepts those exact files, by their hashes, and keeps each in the browser so that it's only downloaded once.

During development, `npm run play` also serves pinned builds by ID, so <http://localhost:8123/?jar=sh1-2007-a31> loads one without a file picker. <http://localhost:8123/?jar=sh2-2015-base> loads Mobile 2's touch build, and <http://localhost:8123/?jar=sh3-en-v170> a Mobile 3 touch build.

The page sets a Content Security Policy in a `<meta>` tag, so it applies wherever the page is hosted. Directives that a tag can't set, such as `frame-ancestors`, need a response header from the host.

## Silent Hill and Mobile 2

The first two games share an engine, Daydream's INK, so they share these controls.

| Input | What it does |
| --- | --- |
| Click | Looks around, chooses from menus and continues text. With the gun out, it fires |
| Right-click | Does what the right soft key button shows, such as Back or Menu |
| WASD or arrow keys, with no menu open | Take the room's exit in that direction: forward, back, left or right. In the two rooms with two forward exits, W or Up takes the one nearer the cursor. In a fight, they aim the crosshair instead |
| Q and E | Move the cursor to the previous or next thing that can be clicked, including puzzle buttons |
| Enter or Space | Clicks what the cursor is on, and fires while aiming |
| Esc, with Mouse recoil on and the mouse captured | Lets the mouse go. Clicking the room captures it again |
| Arrow keys or WASD, and Enter, in a menu | Move through and choose from every menu, including the map's floors and the verb wheel, whose arms each go with a direction. Up and Down, or the mouse wheel, also scroll long text, Help and About, and Enter continues text |
| Left and Right arrows, or A and D | Change a setting in the main menu, and move between items in the inventory |
| 1, or the Gun button | Draws or puts away the gun |
| 3, or the First aid button | Uses a first-aid kit |
| Esc | Skips the opening, goes back from a menu, a puzzle or the map, or opens the pause menu |
| M | Opens the map, once you have it |
| I, or the Inventory button | Opens the inventory. Clicks or the keys above move between items and actions |
| Quit, in the main menu | Goes back to the page's choice of games, after asking |
| Save and Load buttons | Save to this browser, and load from it. Load asks for a second click |
| Sound button and Volume slider | Turn sound on or off and set its level, and remember the choice |
| Soundfont button | Plays sound with a SoundFont 2 file you choose, kept in this browser, instead of the default |

Everything in the first game works, from the startup screens to the ending: the menus, all of the JAR's languages, rooms, hotspots, the verb wheel, text, choices, the inventory, the map, room transitions, battles, the flashlight, the HUD, saving and sound.

The original's Select, Menu, Map, Back and OK keys appear as buttons when they apply. Those and the in-game text follow the language you choose, while the page's other buttons stay in English. The text boxes and the rusted steel behind the buttons are art from your JAR, not files in this repo.

Settings, in the main menu and the pause menu, and the first menu after the logo can turn the transitions between rooms off, turn on a pixel font that imitates an old phone's text, and turn on mouse recoil for fights, which captures the mouse while aiming.

Tabbing away stops the game and its sound, and tabbing back carries on from the same moment. Unlike the original, which opens the pause menu, this doesn't interrupt play.

Browsers only allow sound after you click or press a key. The sound question after the logo gets that click, so the splash screen's music can play.

There's one save for each version of the game's data, whichever language is chosen. It's kept in this browser's local storage, so clearing site data deletes it. As in the original, starting a new game deletes it, after a warning.

## Soundfonts

The game's music is MIDI, which needs instrument sounds from somewhere. By default the port uses the BV version of the [Symbiote Soundfont](https://musical-artifacts.com/artifacts/7181) by NHP, which is about 220 KB and imitates old phones. Its BSD version is the other choice in the soundfont menu, at about 130 KB, with fewer samples and clearer licensing. These are the only sound files in this repo: see [their notice](../web/soundfonts/NOTICE.md) for their licenses. If one can't load, the port uses rough built-in voices.

For sounds much closer to a Nokia phone, choose a General MIDI SoundFont 2 file such as [Series 40 5th Edition FP1](https://www.musical-artifacts.com/artifacts/693). This repo doesn't include that one, so download it from that page and check its license yourself. Its listing is reported as CC-BY 4.0, but the file's own metadata says "Copyright © Nokia Corporation. All rights reserved." To use it, press the **File** button beside the menu. Your file stays in your browser and joins the menu, and the × button removes it and goes back to the default.

To skip the file picker during development, put a `.sf2` in the ignored `soundfonts/` folder and add it to the link, for example `?jar=sh1-2007-a31&soundfont=name.sf2`.

## Silent Hill: Mobile 2

Mobile 2 plays from a new game to its ending on the same engine, with what differs in `web/engine/mobile2.mjs`. There are two versions, and both can be finished:

- **The touch build, `sh2-2015-base`:** the painting, the carving and the incision are drawn by dragging with the left mouse button, so these can't be done with the keyboard. This is the build the port's code follows.
- **The keypad version, including the Internet Archive's `sh2-2015-a1`:** the painting is joined up by clicking its dots, the carving is steered with arrows, and the incision isn't there. It can be played with only the keyboard.

In both:

- The rooms are 310x270, and some are 290 wide and sit centered in the frame.
- The touch build's icons for the weapon, first aid and inventory are on the page's buttons, in the JAR's own art. The keypad version doesn't have them, so its buttons only have words. The navigation icon and turn arrows aren't there, because the mouse and the walking keys already reach every exit.
- The tutorial and Help are reworded for a mouse and keyboard, in all six languages. Fan translations keep their original text, so they still describe a phone.

The touch build vibrates as the original does, with its setting, on phones whose browser allows that. Safari on iPhones doesn't. The first game does too.

## Silent Hill: Mobile 3

Mobile 3 has a different engine, and the port plays it from the logos to the ending: rooms, corridors, the lift and map, all six puzzles, all four monsters, both worlds, the three chapters, saving, and six languages.

Its Internet Archive button loads `sh3-2010-v1.0.20-a`, a keypad build. You can also drop in any of the 41 JARs it follows, which are v1.0.20, v1.0.23, v1.0.24, and v1.1.0, v1.5.0 and v1.7.0 with touch art. It explains that it doesn't follow the others, which include the 3-minute demos of v1.0.17.

Point and click. In a room or corridor, the cursor's words say what a click does, and clicking something opens a wheel of look, use and inventory. W, A, S and D walk and turn, E and Q move to the next thing that can be clicked, I opens the inventory, and M the map once you have it. Enter and Space click, the two big buttons do what they're labelled with, C is the left one and Esc or a right-click the right one. So C confirms the clock, the safe and the pearls, and turns a paper.

In a puzzle or fight the direction keys move the cursor. For the safe, keypad builds take the number keys, and with a mouse the sides of the knob change a number and clicking the display moves to the next. In touch builds' fights, clicking the green ring is a sure hit and the red one a critical hit.

Each pistol or shotgun shot kicks the aim up, and the aim wanders while you hold a weapon. With a free mouse, both settle back to the mouse. With the keys they last until you steer back, as on a phone, and the Mouse recoil setting, shared with the other games, captures the mouse in fights so they last with it too. Esc lets it go.

The Controls page and the puzzles' instructions are rewritten for a mouse and keyboard, in all six languages.
