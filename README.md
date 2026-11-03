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

Then open <http://localhost:8123/> and drop in a JAR, or open <http://localhost:8123/?jar=sh1-2007-a31> to load a pinned build. Click to look around and to continue text, and press Esc to skip the opening.

The opening, rooms, hotspots, the verb wheel, text, choices, inventory and room changes work. Battles, sound, saving, the HUD, the map and transition effects aren't there yet, and nobody has played it to the end.

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
