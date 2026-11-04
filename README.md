# Silent Hill Mobile analysis

Reproducible analysis of the three Silent Hill J2ME games, and the start of a JavaScript port. The analysis answers three questions:

- How different are the available builds?
- Which build should a port be based on?
- Can the game data be read without running the original Java code?

**This repo contains no game files.** The JARs, zips, decompiled code and rendered art are copyrighted, so you supply the downloads yourself and everything derived from them goes in the ignored `build/` folder. `inputs.json` records only each build's location, size and hash.

See [docs/FINDINGS.md](docs/FINDINGS.md) for the results.

## Playing the prototype

`web/` is an early browser port of the first game. It reads your own JAR locally and doesn't upload it. Start it with:

```bash
npm run play
```

Then open <http://localhost:8123/> and drop in a JAR, or choose **Load from the Internet Archive** to download a copy of `sh1-2014-base` from [archive.org](https://archive.org/details/j2me-game-glu-silenthill). The port only accepts that exact file, by its hash, and keeps it in this browser so that it's only downloaded once. During development, <http://localhost:8123/?jar=sh1-2007-a31> loads a pinned build.

The page sets a Content Security Policy in a `<meta>` tag, so it applies wherever the page is hosted. Directives that a tag can't set, such as `frame-ancestors`, need a response header from the host.

| Input | What it does |
| --- | --- |
| Click | Looks around, chooses from menus and continues text. With the gun out, it fires |
| Right-click | Does what the right soft key button shows, such as Back or Menu |
| WASD or arrow keys, with no menu open | Take the room's exit in that direction: forward, back, left or right. In the two rooms with two forward exits, W or Up takes the one nearer the cursor |
| Arrow keys or WASD, and Enter, in a menu | Move through and choose from every menu, including the map's floors and the verb wheel, whose arms each go with a direction. Up and Down, or the mouse wheel, also scroll long text, Help and About, and Enter continues text |
| Left and Right arrows, or A and D | Change a setting in the main menu, and move between items in the inventory |
| 1, or the Gun button | Draws or puts away the gun |
| 3, or the First aid button | Uses a first-aid kit |
| Esc | Skips the opening, goes back from a menu, a puzzle or the map, or opens the pause menu |
| M | Opens the map, once you have it |
| I, or the Inventory button | Opens the inventory. Clicks or the keys above move between items and actions |
| Save and Load buttons | Save to this browser, and load from it. Load asks for a second click |
| Sound button and Volume slider | Turn sound on or off and set its level, and remember the choice |
| Soundfont button | Plays sound with a SoundFont 2 file you choose, kept in this browser |

The startup screens, main menu, pause menu, all of the JAR's languages, the opening, rooms, hotspots, the verb wheel, text, choices, inventory, the map, room changes and their transitions, battles, the flashlight, the HUD, saving and sound work. Nobody has played it to the end.

The original's Select, Menu, Map, Back and OK keys appear as buttons when they apply. Those and the in-game text follow the language you choose, while the page's other buttons stay in English. The text boxes and the rusted steel behind the buttons are art from your JAR, not files in this repo.

Settings, in the main menu and the pause menu, and the first menu after the logo can turn the transitions between rooms off, and turn on a pixel font that imitates an old phone's text.

Tabbing away stops the game and its sound, and tabbing back carries on from the same moment. Unlike the original, which opens the pause menu, this doesn't interrupt play.

Browsers only allow sound after you click or press a key. The sound question after the logo gets that click, so the splash screen's music can play.

### Soundfonts

The game's music is MIDI, which needs instrument sounds from somewhere. Without a soundfont, the port uses rough built-in voices. For sounds much closer to a Nokia phone, choose a General MIDI SoundFont 2 file such as [Series 40 5th Edition FP1](https://www.musical-artifacts.com/artifacts/693). The **Get** link beside the Soundfont button opens that page, where you can download it. It's a link because the site doesn't let other pages download from it directly. This repo doesn't include one: check its license yourself. Its listing is reported as CC-BY 4.0, but the file's own metadata says "Copyright © Nokia Corporation. All rights reserved."

To skip the file picker during development, put a `.sf2` in the ignored `soundfonts/` folder and add it to the link, for example `?jar=sh1-2007-a31&soundfont=name.sf2`.

There's one save for each version of the game's data, whichever language is chosen. It's kept in this browser's local storage, so clearing site data deletes it. As in the original, starting a new game deletes it, after a warning.

## Requirements

- Node.js 22 or newer. There are no npm dependencies.
- A JDK, for the decompile and bytecode-count steps. The analysis was run on OpenJDK 26.

## Setup

Put these in the repo root. Downloads can stay zipped: builds are read from inside the zips without being extracted or run.

| Input | Path |
| --- | --- |
| Silent Hill, 133 JARs (130 distinct) | `sh1/` |
| Silent Hill Mobile 2, 73 JARs (70 distinct) | `sh2/` |
| Silent Hill Mobile 3, 90 JARs (86 distinct) | `sh3/` |
| Vineflower 1.12.0 | `vineflower-1.12.0.jar` |

To keep them somewhere else, set `SHM_INPUTS` to the folder that contains them.

## Usage

Run the whole analysis, then check the results against the recorded findings:

```bash
npm run all
```

```bash
npm test
```

You can also run each step on its own:

| Command | What it does | Output |
| --- | --- | --- |
| `npm run play` | Serves the browser port on this machine only | `http://localhost:8123/` |
| `npm run find-route` | Searches for a way through the first game, for the playthrough test | `src/sh1-route.json` |
| `npm run verify` | Checks every build's hash | Console |
| `npm run compare` | Compares every build of each game | `build/reports/builds-sh1.md`, `builds-sh2.md`, `builds-sh3.md`, `builds.json` |
| `npm run analyze` | Decodes every INK script and room | `build/reports/data.json` |
| `npm run opcodes` | Names each script command and event, with usage counts | `build/reports/opcodes.md` |
| `npm run render` | Draws sample rooms with hotspots outlined | `build/rooms/` |
| `npm run code-volume` | Counts `sh1-2014-a6` and `sh1-2014-a7` bytecode instructions | `build/reports/code-volume.json` |
| `npm run decompile` | Decompiles the recommended builds with Vineflower, and saves leftover source | `build/decompiled/`, `build/source/` |
| `npm run pin` | Rewrites the build list in `inputs.json` after you add downloads | `inputs.json` |

To draw other rooms, pass a game with room IDs or `--all`:

```bash
node scripts/render-rooms.mjs --game sh2 puzzleScalpel
```

```bash
node scripts/render-rooms.mjs --game sh1 --all
```

To decompile any other build, pass its ID:

```bash
node scripts/decompile.mjs sh2-2008-a7
```

## Layout

- `web/`: the browser port, with the engine and shared format parsers in `web/engine/`
- `src/`: Node analysis code: class files, SH3 archives, the room renderer and build comparison
- `scripts/`: the command-line steps above
- `test/`: pins each number and claim in the findings
- `docs/FINDINGS.md`: what the analysis found and what it doesn't show
- `inputs.json`: pinned builds and the recommended ones

## Build IDs

IDs come from the file names, with the game first:

| ID | File |
| --- | --- |
| `sh1-2007-a31` | `Silent Hill (2007)(Konami)(v0.1.0)(a31).jar` |
| `sh1-2014-base` | `Silent Hill (2014)(Konami)(v0.1.0).jar` |
| `sh1-2007-binpda-a2` | `Silent Hill (2007)(Konami_BiNPDA)(v0.1.0)(a2).jar` |
| `sh2-2015-base` | `Silent Hill Mobile 2 (2015)(Konami)(v1.0.0).jar` |
| `sh3-en-v170` | `Silent-Hill-Mobile-3_J2ME_EN_v170.jar` |

The year in a catalogued name is a catalogue label, and often matches the date of an edited manifest rather than the build.
