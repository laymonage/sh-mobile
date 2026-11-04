# Findings

The numbers and build comparisons below are checked by `npm test`. Statements that come from reading the decompiled code, such as what a command does, are not. Run `npm run all` to regenerate the detailed reports.

## Recommendation

| Game | Purpose | Build | Why |
| --- | --- | --- | --- |
| Silent Hill | Game data | `sh1-2007-a31` | Looks untouched, full-resolution art |
| Silent Hill | Code reference | `sh1-2014-a7` | Real class, method and field names, with full-resolution constants |
| Silent Hill | Second code reference | `sh1-2007-a40` | Real names and no site marker, but built for 176-pixel art |
| Silent Hill | Leftover source | `sh1-2007-a33` | The newest `.java~` backups |
| Silent Hill | Touch reference | `sh1-en-v153` | On-screen controls with unchanged scripts, rooms and art |
| Mobile 2 | Game data and touch reference | `sh2-2015-base` | Built for pointer input |
| Mobile 2 | Keypad reference | `sh2-2008-a7` | Looks untouched, and 24 other builds share its data |
| Mobile 3 | Game data and code reference | `sh3-en-v170` | Newest build with top-tier art that's labelled for touch |
| Mobile 3 | Keypad reference | `sh3-en-v180` | Newest build overall |
| Mobile 3 | Asset names | `sh3-en-v160` | Loose files with real names, but smaller art |

For the two INK games, the best route to a port is to reimplement the engine in JavaScript and load the original game data, as ScummVM does. Most of those games are data rather than Java code. Mobile 3 has a different engine, and more of its logic is in Java.

## How builds were judged

A build **looks untouched** if all of these are true:

- Every file has the same timestamp.
- The manifest's vendor and name are the expected ones, with no added fields.
- No file names or mentions a known site or repacker.
- There are no classes beyond the game's own.

ZIP dates can be edited and there are no known-good copies, so this is strong evidence rather than proof.

Two builds are **twins** if everything outside `META-INF` matches byte for byte.

Dates show when a build was packaged, not how new its content is. `sh1-2014-a23` is dated 2007-09-21, but `sh1-2007-binpda-a2` has the same bytes dated 2007-08-31. `sh1-2014-v1.0.0-a` is dated 2008-02-25, but keeps typos that `sh1-2014-a23` fixes.

## Silent Hill

There are 133 JARs, of which 130 are distinct and 86 are distinct when manifests are ignored.

| Builds | Count | Description |
| --- | --- | --- |
| INK | 105 | The full game: 88 at 256 pixels, 16 at 176 and 1 at 190 |
| Low-end | 25 | A separate version with no INK engine or scripts |
| Look untouched | 30 | 18 INK, of which 13 are full-resolution |

All 88 full-resolution builds have the same scripts.

### Data

`sh1-2007-a31` differs from `sh1-2014-a23` in one French string, "tout petit" against "toute petite". `sh1-2007-a26` looks untouched and has `a23`'s language files. Its puzzle art is smaller, so take only the language files from it. Four other untouched-looking builds have the same data as `a31`.

`sh1-2014-v1.0.0-base` has the same data as `a23`, and its code strings lack only `VolumeControl` and `ly`.

There are two sets of four MIDI files among full-resolution builds. They haven't been compared by ear.

### Third-party changes

27 builds name dedomil, always in the manifest and never elsewhere. 16 of them have a twin without dedomil's lines, and 13 have a twin that looks untouched. So dedomil's change to those builds is limited to the manifest. The other 11 can't be checked this way.

Other changes:

- 34 builds put Russian in the English slot, including those marked SEclub and Konon, and 8 put Chinese there.
- `sh1-en-v010-4` and `sh1-en-v010-5` have Vietnamese there.
- `sh1-2008-base` is a Joybits "Silent Hill Demo" with SMS payment text in its manifest.
- Some builds add `com/hellomoto`, `com/alcatelonetouchx` or Nokia API wrapper classes.
- A JAD in `v010(8).zip` describes an unrelated game, "Spin the XXX Bottle".

The Polish string `Drugi ekran` is compiled into builds that look untouched, so it isn't a fan's addition.

### Code

Only `sh1-2014-a7` and `sh1-2007-a40` keep the real class names, and neither has debug info. 7 of their 13 classes are byte-identical, including `Script` and `ScriptThread`.

Vineflower decompiles all 13 `a7` classes into 11,440 lines with no reported failures. 210 of the 213 method names found in `Ext`, `ExtBase`, `M` and `MyCanvas` also appear in `sh1-2014-base`'s leftover source; the other three are `tickBasedTime` helpers.

`a7` is a reference and not the shipped code:

- It has about 16% more bytecode than `sh1-2014-a6` (28,542 instructions against 24,637). Obfuscator optimization probably explains part of this, but that hasn't been shown.
- It has debug-style strings and `ink.resourceinfo` that `a6` lacks, and lacks `vibraRecordStore`, which `a6` has.
- It lacks `a23`'s `VolumeControl` string, among others.
- Its `Cheat` class, a Ben/Moon/Karen route menu, is never called.

`a40` has the vibration code `a7` lacks, but its constants are for smaller art, such as a room size of 176. Where behavior matters, check both against the bytecode of a build that looks untouched.

### Leftover source

`sh1-2007-a33` has newer `.java~` backups than `sh1-2014-base`, dated 2007-09-10 rather than 2007-08-30. `Ext` is the same, while the others add device flags such as `K700_INTERUPTION`, `P990_SOFT_KEYS` and `SOUND_OTT`. The build itself is a Russian repack at an unusual art size. `base`'s backups also ship in `sh1-2007-binpda-a`, without dedomil's lines.

The touch code in these backups sits behind a `TOUCHPAD` flag.

### Touch

Only `sh1-en-v153` and `sh1-2007-a33` compile pointer handling into the game's own classes. Other pointer code comes from a `com/hellomoto` wrapper.

`sh1-en-v153` has version 1.5.3, a single timestamp of 2010-10-14 and no site marker. It shows a Tectoy Mobile logo at startup and ships English, Spanish and Portuguese. Taps go through on-screen controls that simulate key presses. Its scripts, rooms and art match `a31`, and 4 English strings differ, 3 of which describe the new controls. So the game can be touch-driven without changing its scripts. Whether Tectoy's release was licensed is unknown. Vineflower can't rebuild one method in its `i` class.

### Engine and data

Silent Hill runs on Daydream's INK engine.

| Item | Result |
| --- | --- |
| Data entries in `a31` | 924, including language files |
| Scripts | 533, all decoded, with 29,170 bytes of bytecode |
| Script use | 45 of 56 commands and 34 of 56 events |
| Rooms | 112, all decoded, with 1,053 objects |
| Room references | Every script and graphic a room lists exists |
| Sprite transforms | Indexes 0, 1 and 7 |
| English text | 714 strings |
| Audio | 13 MIDI files, 1,915 bytes in total |

All 105 INK builds decode without errors or broken references. Two 176-pixel builds have 531 scripts. See `build/reports/opcodes.md` for command names and usage.

Sprites are placed using the registration point in each PNG's `oFFs` chunk, following `M.getLeft` and `M.getTop`. The rendered rooms line up with their hotspots when checked by eye. This check isn't automated: the tests only pin the output so that later changes are noticed.

## Silent Hill Mobile 2

There are 73 JARs, of which 70 are distinct and 49 are distinct when manifests are ignored. 62 use INK and 8 are a separate low-end version. 32 look untouched, including 15 full-resolution INK builds. No build has readable game class names.

### The touch build

`sh2-2015-base` is the only copy. Its files are dated 2008-10-17, and only its 2015 manifest names dedomil.

From reading its decompiled code: it needs a 240-pixel-wide portrait screen, dragging pans the room, and two puzzles are drawn with a finger and checked against a mask image. A port can drop the screen-width check.

Compared with `sh2-2008-a7`:

| Item | `a7` | Touch build |
| --- | --- | --- |
| Rooms | 39 | 41: adds `lightSurgeryRoomXRay` and `puzzleBodyIncision` |
| Scripts | 446 | 366 |
| Opcodes | 42 | The same 42 |
| Art | 381 distinct images | 388, of which 360 are shared |
| MIDI files | 11 | 11, none byte-identical |
| Bitmap fonts | Used | Files present but unused |

36 of the 39 shared rooms keep their object counts. The scripts fall by 80 because `puzzleDrawing` and `puzzleScalpel` lose 84, and the `control` room and two new rooms add 4. The help text describes icons rather than keys.

The drawbacks are that nothing can cross-check a single copy, and that the drawing checks are hard-coded in obfuscated Java.

### Third-party changes

Four builds name dedomil, only in the manifest. `sh2-2015-a`, `sh2-2015-a1` and `sh2-en-v100` have twins that look untouched.

Builds to avoid:

- `sh2-2008-konno-a3` has 8 damaged chunks.
- 7 undamaged builds have Russian in the English slot, and 4 have Chinese in the French slot.
- `sh2-2008-a8` adds `com/kimjunco` classes, and `sh2-2008-konno-base` and `-a4` add a `com/hellomoto` wrapper.

### Format

Rooms store zone sizes in 16 bits rather than Silent Hill's 8, the only room format difference found. All 61 undamaged INK builds decode without errors or broken references. Sprites use all eight transforms, and some images are RGB or RGBA rather than indexed. Applying `a7`'s command names to this game assumes the IDs mean the same thing, because no build here keeps them.

## Silent Hill Mobile 3

There are 90 JARs, of which 86 are distinct. Mobile 3 uses a different engine, with `p.mbf` and `b.mbf` archives. No build has readable game class names. 13 v1.0.17 builds have 1,071 longer member names, but they're mechanical renames such as `m_aaI`.

### Tiers

Each build names its device tier in `boxal.inf`.

| Tier | Builds | Art | Notes |
| --- | --- | --- | --- |
| `qvga_touch_u_h` | 21 | 213 images, up to 1693x561 | Includes `sh3-en-v170`. 3 builds have the medium art instead |
| `qvga_u_h` | 24 | 213 images, up to 1693x561 | Includes `sh3-en-v1023`. `sh3-2010-v1.0.24-a6` and `-a12` have changed data, with 212 images |
| `k750` and `qvga_500_m` | 17 | 211 images, up to 1152x387 | `sh3-en-v160` has its images loose |
| `qcif_u_h` and `subqcif_500_m` | 10 | 208 images, up to 862x281 | |
| `subqcif_92_l` | 13 | 56 images, up to 180x256 | English-only, no pointer code |

`sh3-2010-v1.0.17-a2` names no tier and has no `p.mbf`.

Top-tier touch and keypad archives share 190 of their 213 images. `sh3-en-v180` is labelled touch, but its archives are byte-identical to keypad build `sh3-en-v1023`.

`sh3-en-v170`'s code strings match v1.1.0 and v1.5.0. `sh3-en-v180` moves the MIDI files into its archives and has 5,700 fewer bytes of class files. Language files vary slightly between versions, and haven't been reviewed line by line.

### Third-party changes

No build is provably untouched. 12 have no site marker and only `sh3-2010-v1.0.17-a7` has a single timestamp, so packaging dates are mixed throughout. `sh3-en-v170`'s only visible addition is `supplied by kriker.ini`, and `sh3-2010-v1.1.0-a21` has the same archives with no marker.

Builds to avoid:

- `sh3-en-v0011` and `sh3-2012-v0.0.13-*` date from 2012 and have a Vserv ad SDK, despite their version numbers. `sh3-en-v005` is a relabelled v1.1.0 build.
- `sh3-2010-v1.0.17-a4` has Torpedo ad classes, and `sh3-2010-v1.1.0-a7` has Diamond Mine classes.
- 9 builds have `PointFont` and `XConnection` classes, with Chinese in the English slot. What `XConnection` does hasn't been read.

### Demo builds

20 builds don't have the manifest key their code expects: most of v1.0.17, and the 2012 rebuilds. From reading the code, such a build ends after 3 minutes with "End of the Demo". A port wouldn't include this check. The content doesn't appear to be cut: `sh3-2010-v1.0.17-a` shares `p.mbf` with builds that have the key, and the 2012 rebuilds share both archives with them.

### Game logic

From reading the code: `GameMidlet` has a 78-row table of trigger, condition and action rules, which can be extracted as data. What each number means, and how much logic sits outside the table, hasn't been worked out. There's no script bytecode, and some puzzles may be hard-coded. Vineflower decompiles `sh3-en-v170` into 15,575 lines with no reported failures.

`sh3-en-v160` stores its assets as 215 loose PNGs with real names, such as `b_enigma1_telephone.png`, including 97 objects and 22 puzzle images. Its art differs from the top tier, so these names haven't been mapped to the archive entries.

## The prototype

`web/` runs Silent Hill's own scripts in a browser, following `sh1-2014-a7`'s decompiled engine. The game can be finished in the port. `test/playthrough.test.mjs` plays it from a new game through Ben, Moon and Karen to the ending and back to the main menu, using only the pointer, clicks and keys. It passes through 110 of the 112 rooms: `setup` is over within the first tick, and no script leads to `ben_backToLight`. The route also finishes with a save and load at each of its save points outside the puzzle rooms, which reset when they're entered.

`scripts/find-route.mjs` found the route by trying everything a player could from each state, so the 527 steps include plenty of looking around and aren't a sensible way to play. It was given the answers to the three clocks, the gate and the blackboard, read from their scripts. Moon's clock and the blackboard's word agree with [this walkthrough](https://www.silenthillmemories.net/sh_orphan/walkthrough_en.htm), which doesn't cover Karen's clock or spell out the gate's answer. The safe was solved by the search alone.

The route was also played once in the browser with the real renderer. It reached the ending with no drawing errors, and thumbnails of the rooms looked right by eye. Rooms that stay dark until the lighter is used showed as nearly black. Text layout and animation weren't checked frame by frame, and sound wasn't played.

The route shows that a path exists, not that the game plays well:

- It never took damage: the bot's quick shots keep monsters from attacking. Dying and healing are only covered by other tests.
- It takes one path, so other orders of play and the many other things a player could try aren't covered.
- Choice menu rows are marked directly in Node, because the renderer lays them out. The browser run used the pointer.

The same route finishes on 103 of the 105 Silent Hill builds the port accepts or warns about. It fails on `sh1-2007-a2` and `sh1-2010-a9` at Moon's clock, because those builds number their scripts differently there, so the route's button names don't apply. That's a limit of the route rather than something shown to be wrong with those builds. Each of the 103 was only run in Node, once.

From its data alone, the port accepts or explains every Silent Hill and Mobile 2 build:

| Result | Builds |
| --- | --- |
| Accepted | The 88 full-resolution Silent Hill builds |
| Accepted with a warning about smaller art | The other 17 Silent Hill INK builds |
| Rejected: no INK data | 25 Silent Hill and 8 Mobile 2 low-end builds |
| Rejected: Mobile 2 isn't supported yet | 61 Mobile 2 builds |
| Rejected: damaged | `sh2-2008-konno-a3` |

`sh1-2007-a31` and `sh1-2014-base` have been run in the browser. Being accepted means a build's data has the expected form, not that the build has been played.

### Battles

From reading the code: battles are aim-and-shoot. Pressing 1 draws the gun, which starts a battle if the room has a monster, and a shot hits if the crosshair is within 8 pixels of the monster's anchor point. Dark rooms need the flashlight, which hides everything outside a circle around the cursor. With the flashlight on, a monster can only attack while the beam is on it.

The tests cover drawing the gun, hits and misses, killing a monster, taking damage, dying and running out of ammo. The full playthrough fights its way through `17`, `r`, `y`, `1d`, `2a` and the final fight in `2d`, reached by walking there. The port follows the original in `2d`: input locks once the boss is dead, and the ending runs by itself.

The port differs from the original or leaves things out in these ways:

- Recoil settles back to the pointer, because a mouse doesn't steer back as a keypad does.
- Timing assumes a 60 ms tick, taken from `M.tickBasedTimeUpdate`. The original's real frame rate depended on the phone, and it hasn't been measured, so how often monsters attack may differ.

### Saving

A save holds every script variable and the action keys, as in `ExtBase.saveGameInRMS`, and no running script. Loading runs the setup room again, whose script then returns to the saved room. So a room's state comes back through its entry scripts, not from a snapshot.

99 of the 112 rooms are save points. As in the original, saving is also refused during text, while a script is paused and in a battle. Five scripts save by themselves at story moments.

The confirmation is the original's popup, which holds up all input until it's answered. The original answers it with its left soft key, labeled OK, and the port also accepts a click or Enter.

The port differs in two ways: saves go to the browser's local storage, and a save from before a language change keeps any game text held in its variables in the old language, as the original's would.

Save and load were tested in the browser by saving in one room, reloading the page and continuing. Saves from late in the game haven't been tried, and neither have the story moments that save by themselves, beyond a test of the first one.

### Interface

The original's screen is 240x320: a 256-pixel-tall room, panning sideways with the cursor, above `gfx/bigScreenHUD_hor.png`, 64 pixels of rusted steel with blood and cobwebs. The port shows the whole square room instead, without panning, and puts that art behind the page's buttons.

Text boxes use the original's notepad art, tiled as in `ExtBase.menuPaintIngameImageBorders`. Text takes its speaker's color: Ben `#1C0E70`, Moon `#A30C0C` and Karen `#A20B8A`. The box positions follow the room's bottom rather than the phone's screen, and they hold four lines, so they're larger than the original's. Long text scrolls by line with the arrow keys or mouse wheel, as in the original. A click also moves on by four lines and only closes the text at its end, while the original's OK closes it straight away. The fonts are the browser's, not the phone's.

The inventory follows `ExtBase.inventoryMenuPaint`: a page half the room's width, centered on the cursor, showing one item's name and picture, with arrows to the others and its actions below. The script's named first item always comes first. After that, the original's order came from a Java hash table, and the port's is the order items were picked up.

WASD and the arrow keys take the room's exits, which the original doesn't do: its keys only moved the cursor. They run the same script as clicking the exit. With every room loaded from a new game's state, 92 of the 110 that load have directional exits, and none has more than two directions. Rooms `a` and `10` have two forward exits side by side, a doorway and a staircase, and the key takes the one nearer the cursor. Exits that depend on story progress may differ. Many rooms are left through doors and other objects that use the verb wheel, so the keys don't replace the mouse.

The map's floor list marks the current floor with `gfx/map_cursor.png`, using the `var_floor` variable that stairs set, as in `ExtBase.menuPaintIngame`. That code runs for every choice menu, but the map's script is the only one that offers choices. The list starts on the current floor, as the original's map key does, and moving the mouse over a row highlights it. Every menu also takes the arrow keys, WASD and Enter. The verb wheel's arms each go with a direction, as on the original's keypad. Hotspots in a room and puzzle buttons are still only reached with the mouse, because the port has no keyboard cursor.

Room changes use the transition from `Ext.appPaint`: one frame of `dissolveEffectImg` over the old room, three of solid black, then two of the pattern over the new room. Input waits for it to finish, as in `MyCanvas.keyPressed`. It's counted in the port's 60 ms ticks, so it lasts about 360 ms, and its speed on a real phone hasn't been measured.

Cursor hints such as "Move forward" stop once a script sets `s_cursorHintDisable`, and that carries through saves.

The original's soft keys appear as buttons when they apply. Back uses the room's own back hotspot, and Map looks at the map item, which offers the floors. 
### Menus

The startup follows `ExtBase`: the Konami logo fades in over four steps on white and holds for a second, then the language menu on the first run, the sound question, and the splash screen from `splash.ini` for 3 seconds with `sh_bgmusic`, which carries on into the main menu. The sound question's click is also what lets a browser start that music.

The main menu has Play, Settings, Help and About, all drawn on `ENGINE_MENU_BG_COLOR` paper in the original's notepad art. Play offers the saved game and a new game when there's a save. About uses the JAR's own text. Help's two pages and the tutorial's first line are reworded for a mouse and keyboard, in all six languages, in `web/engine/help-text.mjs`. They keep the JAR's headings, conditions and descriptions of the icons, and only the words about keys are new. The translations are this port's own and haven't been checked by native speakers. Fan translations, such as the Russian and Chinese builds, keep their original text, so they still describe the phone's keys. Settings has sound, language and two of the port's own switches, kept in the browser: room transitions, which are on by default, and a pixel font, which is off. The pixel font imitates an old phone's text with a 1-bit bitmap font in `web/pixel-font.mjs`, since the phone's own font isn't in the JARs. The 26 distinct letters and digits in one 240×320 screenshot of the game were matched to it, and four lines of that screenshot's text reproduce with no wrong pixels. The other letters, digits and punctuation were drawn to go with them, and accented letters are built from a plain letter and an accent, so those haven't been compared with a phone. Line spacing stays the port's: 14 pixels, where the screenshot has 18. Text it has no letters for, such as Chinese in a fan translation, is drawn in Arial with its smoothing removed.

The JARs list their languages in `settings.ini`. Of the 105 Silent Hill builds the port accepts, 94 have all six, 4 have English and French and 7 have only English. The menu offers those whose text files are present, and a build with one language never asks.

The text files write a line break as `\n` and a non-breaking space as `+`, which `ExtBase.wrapString` converts. That's why the controls page's `Num+1` reads "Num 1", and why French punctuation stays with its word.

The pause menu from `ExtBase.createEscapeMenu` opens with Esc or the Menu button: Continue, Save where allowed, Settings, Help and Main menu. As in the original, Esc goes back rather than pausing on the map's floors and the children's drawing, and the port also goes back from puzzles. Leaving asks first, using the original's text.

The port differs in these ways:

- There's no Quit, because a web page has nothing to quit to.
- The logo and splash art sit closer together, because the port's screen is shorter than the phone's. Without the phone's soft key bars, the logo sits at the very top.
- The sound question has a Continue row, because a mouse can't press the soft key that does this on a phone. It also offers the transitions and language settings.
- The warnings about a new game and leaving a game are lists with No highlighted, rather than popups answered with soft keys.
- A battle stops while the pause menu is open. In the original, only a phone call or hiding the app stopped it.
- Coming back to the tab doesn't open the pause menu, as the original does on returning to the app, so players can tab in and out without interrupting play. The game's clock stands still while the tab is hidden, so nothing happens in the meantime.
- The original's Reload choice, for a room that fails to load, isn't there.

The startup, every menu, language switching, saving from the pause menu, leaving for the main menu and loading afterwards were tried in the browser with real clicks and keys, with the game stepped by a timer because the test pane doesn't run animation frames. Whether the music sounds right hasn't been checked by ear. Pausing a battle is only tested in Node, and only `sh1-2007-a31` was tried in the browser.

### Sound

Silent Hill has 13 very short MIDI files, 1,915 bytes in total, and plays only one at a time, so a new sound cuts off the last. Browsers can't play MIDI, so the port renders it with Web Audio. It has two sound sources:

- **A SoundFont 2 file the player chooses.** The file stays in their browser, and the repo includes none. `web/engine/soundfont.mjs` reads it, covering zones, tuning, loops, the volume envelope, the initial filter, pan and tremolo. It doesn't apply the modulation envelope, vibrato, chorus or reverb.
- **Built-in voices.** These are rough stand-ins, used without a soundfont or for an instrument the soundfont lacks.

The Series 40 5th Edition FP1 soundfont was tested. Its metadata says "Copyright © Nokia Corporation. All rights reserved", while its listing is reported as CC-BY 4.0. The listing page refuses automated requests, so the license hasn't been confirmed.

### The door sound

`ls`, played on entering rooms through a door, is 48 notes of General MIDI's applause instrument across five octaves, none longer than 0.9 s. In Series 40, that instrument has a 2.5 s attack and a 1.8 s release, so no note reaches full volume, and the result is a slow swell and fade.

That makes it nearly silent at the font's own levels, peaking at 0.02 of full scale. So the port measures each sound through whichever source is in use, and scales it by its peak and its sustained loudness. A real phone's levels weren't measured, so how loud each sound should be compared with the others is a judgment call, and there's a volume slider.

Sounds also end with their MIDI file, with a 0.25 s fade, because the original hands each file to the phone's media player. Whether a real phone cuts off ringing notes at that point, or lets them fade, hasn't been checked.

The door sound starts almost silent, so nothing masked the click from cutting off the previous sound. Sounds now fade over 15 ms when stopped. A crackle was reported at the door's start, and this is the one measured cause found: the setup time and the sample were ruled out, and filtering slowed samples made no measurable difference. Whether it fully fixes what was heard hasn't been confirmed.

There's no limiter. An earlier version had the browser's compressor on the output, but it cut short sounds to about half their level even well below its threshold, and measured levels leave nothing for it to catch.

Every file was rendered in a browser through both sound sources and measured for silence, invalid samples and clipping. Nobody has compared the result with a real phone.

## What hasn't been checked

- No person has played a game through. The first game's route in `test/playthrough.test.mjs` was found by a search, and it hasn't been compared with the original on a phone.
- Mobile 2 and Mobile 3 scripts haven't been run, and most of Silent Hill's have been reached only by the tests above, so most command behavior is only known from reading the code.
- The decompiled Java hasn't been recompiled.
- Build dates come from ZIP metadata.
