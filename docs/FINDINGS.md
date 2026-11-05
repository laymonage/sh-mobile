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
| Mobile 3 | Keypad reference | `sh3-en-v180` | Newest build overall. The port's keypad build is `sh3-2010-v1.0.20-a` instead |
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

Its code lists its three languages in its `h` class, and its `settings.ini` is the only one with no `INK-Languages`. Its `localization/` files name only those three, without French, German and Italian, so each text from Select on is 3 lines earlier than in the other 104 accepted builds. Every text number its code asks for, from there on, is `sh1-2014-a7`'s minus 3. Its files keep the "Vibra:" label, at line 17, but its code never reads it and has no such setting.

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

From reading the code: `GameMidlet` has a 78-row table of trigger, condition and action rules. There's no script bytecode. The rules decide what objects and doors do, and what's outside them is in Java, including six puzzles and four kinds of fight. Vineflower decompiles `sh3-en-v170` into 15,575 lines with no reported failures.

Rule 35 lists four actions but its count says three, so the original never runs the last, which unlocks a door. The port does the same.

The game's rooms, floors, dialogue order and items are arrays built by static initializers, which can be read from the class files without running them. 17 builds have these arrays with the numbers `sh3-en-v170` has, including all of v1.5.0, and 24 more have them with the numbers `sh3-2010-v1.0.20-a` has.

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
| Accepted | The 88 full-resolution Silent Hill builds and 36 full-resolution Mobile 2 builds |
| Accepted with a warning about smaller art | The other 17 Silent Hill INK builds and 25 Mobile 2 INK builds |
| Rejected: no INK data | 25 Silent Hill and 8 Mobile 2 low-end builds |
| Rejected: damaged | `sh2-2008-konno-a3` |

`sh1-2007-a31` and `sh1-2014-base` have been run in the browser. Being accepted means a build's data has the expected form, not that the build has been played.

### Battles

From reading the code: battles are aim-and-shoot. Pressing 1 draws the gun, which starts a battle if the room has a monster, and a shot hits if the crosshair is within 8 pixels of the monster's anchor point. Dark rooms need the flashlight, which hides everything outside a circle around the cursor. With the flashlight on, a monster can only attack while the beam is on it.

The tests cover drawing the gun, hits and misses, killing a monster, taking damage, dying and running out of ammo. The full playthrough fights its way through `17`, `r`, `y`, `1d`, `2a` and the final fight in `2d`, reached by walking there. The port follows the original in `2d`: input locks once the boss is dead, and the ending runs by itself.

The port differs from the original or leaves things out in these ways:

- With a mouse, recoil settles back to the pointer, because a mouse doesn't steer back as a keypad does. With the keys, it stays until the player steers back, as in the original: about 25 pixels up and 9 to the side per shot, where a shot has to land within 8 pixels. Moving the mouse goes back to the mouse's rule. The Mouse recoil setting, off by default, captures the mouse with the browser's Pointer Lock while aiming, so that the crosshair is the game's own and recoil lasts with a mouse too. The real pointer reappears where it was when the lock began, so the crosshair jumps there on the next mouse move after a fight.
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

The map's floor list marks the current floor with `gfx/map_cursor.png`, using the `var_floor` variable that stairs set, as in `ExtBase.menuPaintIngame`. That code runs for every choice menu, but the map's script is the only one that offers choices. The list starts on the current floor, as the original's map key does, and moving the mouse over a row highlights it. Every menu also takes the arrow keys, WASD and Enter. The verb wheel's arms each go with a direction, as on the original's keypad. The game can be played with only the keyboard, which `test/playthrough.test.mjs` checks with the whole route. Q and E put the cursor on each thing that can be clicked, including what a dark room hides, so this is easier than the original's cursor, which had to be steered to each spot. Enter or Space clicks. In a fight, the movement keys steer the crosshair with the speeds in `ExtBase.ingameMoveKeyHandling`. There's no help with aiming.

Room changes use the transition from `Ext.appPaint`: one frame of `dissolveEffectImg` over the old room, three of solid black, then two of the pattern over the new room. Input waits for it to finish, as in `MyCanvas.keyPressed`. It's counted in the port's 60 ms ticks, so it lasts about 360 ms, and its speed on a real phone hasn't been measured.

Cursor hints such as "Move forward" stop once a script sets `s_cursorHintDisable`, and that carries through saves.

The original's soft keys appear as buttons when they apply. Back uses the room's own back hotspot, and Map looks at the map item, which offers the floors. 
### Menus

The startup follows `ExtBase`: the Konami logo fades in over four steps on white and holds for a second, then the language menu on the first run, the sound question, and the splash screen from `splash.ini` for 3 seconds with `sh_bgmusic`, which carries on into the main menu. The sound question's click is also what lets a browser start that music.

The main menu has Play, Settings, Help, About and Quit, all drawn on `ENGINE_MENU_BG_COLOR` paper in the original's notepad art. Play offers the saved game and a new game when there's a save. About uses the JAR's own text. Help's two pages and the tutorial's first line are reworded for a mouse and keyboard, in all six languages, in `web/engine/help-text.mjs`. They keep the JAR's headings, conditions and descriptions of the icons, and only the words about keys are new. The translations are this port's own and haven't been checked by native speakers. Fan translations, such as the Russian and Chinese builds, keep their original text, so they still describe the phone's keys. Settings has sound, language and two of the port's own switches, kept in the browser: room transitions, which are on by default, and a pixel font, which is off. The pixel font imitates an old phone's text with a 1-bit bitmap font in `web/pixel-font.mjs`, since the phone's own font isn't in the JARs. The 26 distinct letters and digits in one 240×320 screenshot of the game were matched to it, and four lines of that screenshot's text reproduce with no wrong pixels. The other letters, digits and punctuation were drawn to go with them, and accented letters are built from a plain letter and an accent, so those haven't been compared with a phone. Line spacing stays the port's: 14 pixels, where the screenshot has 18. Text it has no letters for, such as Chinese in a fan translation, is drawn in Arial with its smoothing removed.

The JARs list their languages in `settings.ini`. Of the 105 Silent Hill builds the port accepts, 94 have all six, 4 have English and French and 6 have only English. `sh1-en-v153` has English, Spanish and Portuguese, which its code lists instead. The menu offers those whose text files are present, and a build with one language never asks.

That build's text is numbered differently, as described under [Touch](#touch). The port recognizes it by the missing setting and puts the 3 missing lines back as it reads the file, so that every number for this game applies to it, including the ones for Help, the language names and the speakers. It leaves out the build's "Vibra:" label, since the port takes that label to mean a build has the setting. Under each name in the port's table, its English says the same as `a31`'s, apart from the year in About. Its Spanish and Portuguese differ in wording. Help's reworded pages keep what this build says about touching the weapon, the bag and the first-aid kit, because those are its own words rather than keys, so they don't name the page's buttons.

The text files write a line break as `\n` and a non-breaking space as `+`, which `ExtBase.wrapString` converts. That's why the controls page's `Num+1` reads "Num 1", and why French punctuation stays with its word.

The pause menu from `ExtBase.createEscapeMenu` opens with Esc or the Menu button: Continue, Save where allowed, Settings, Help and Main menu. As in the original, Esc goes back rather than pausing on the map's floors and the children's drawing, and the port also goes back from puzzles. Leaving asks first, using the original's text.

The port differs in these ways:

- Quit returns to the page's choice of games, because a web page has nothing else to quit to. It asks first, as the original does, with a list that has No highlighted rather than a popup answered with soft keys.
- The logo and splash art sit closer together, because the port's screen is shorter than the phone's. Without the phone's soft key bars, the logo sits at the very top.
- The sound question has a Continue row, because a mouse can't press the soft key that does this on a phone. It also offers the transitions and language settings.
- The warnings about a new game and leaving a game are lists with No highlighted, rather than popups answered with soft keys.
- A battle stops while the pause menu is open. In the original, only a phone call or hiding the app stopped it.
- Coming back to the tab doesn't open the pause menu, as the original does on returning to the app, so players can tab in and out without interrupting play. The game's clock stands still while the tab is hidden, so nothing happens in the meantime.
- The original's Reload choice, for a room that fails to load, isn't there.

The startup, every menu, language switching, saving from the pause menu, leaving for the main menu and loading afterwards were tried in the browser with real clicks and keys, with the game stepped by a timer because the test pane doesn't run animation frames. Whether the music sounds right hasn't been checked by ear. Pausing a battle is only tested in Node, and only `sh1-2007-a31` was tried in the browser.

### Sound

Silent Hill has 13 very short MIDI files, 1,915 bytes in total, and plays only one at a time, so a new sound cuts off the last. Browsers can't play MIDI, so the port renders it with Web Audio. It has three kinds of sound source:

- **The shipped soundfonts**, the "BV" and "BSD" versions of [Symbiote](https://musical-artifacts.com/artifacts/7181), in `web/soundfonts/`. BV is the default. Every note in `sh1-2007-a31`, `sh2-2015-base` and `sh2-2008-a7` has an instrument in both. BV's licensing rests on its creator's account, because its listing says CC BY 4.0 while the file says "Bona Vacantia - Beatnik shut down 2011", and some of its samples come from code that its creator says was never cleared for release. BSD uses only samples from the BSD-licensed MiniBAE repository, by its creator's account. See their `NOTICE.md`.
- **A SoundFont 2 file the player chooses.** The file stays in their browser. `web/engine/soundfont.mjs` reads it, covering zones, tuning, loops, the volume envelope, the initial filter, pan and tremolo. It doesn't apply the modulation envelope, vibrato, chorus or reverb.
- **Built-in voices.** These are rough stand-ins, used if a shipped soundfont can't load, or for an instrument a soundfont lacks.

The Series 40 5th Edition FP1 soundfont was tested. Its metadata says "Copyright © Nokia Corporation. All rights reserved", while its listing is reported as CC-BY 4.0. The listing page refuses automated requests, so the license hasn't been confirmed.

### The door sound

`ls`, played on entering rooms through a door, is 48 notes of General MIDI's applause instrument across five octaves, none longer than 0.9 s. In Series 40, that instrument has a 2.5 s attack and a 1.8 s release, so no note reaches full volume, and the result is a slow swell and fade.

That makes it nearly silent at the font's own levels, peaking at 0.02 of full scale. So the port measures each sound through whichever source is in use, and scales it by its peak and its sustained loudness. A real phone's levels weren't measured, so how loud each sound should be compared with the others is a judgment call, and there's a volume slider.

Sounds also end with their MIDI file, with a 0.25 s fade, because the original hands each file to the phone's media player. Whether a real phone cuts off ringing notes at that point, or lets them fade, hasn't been checked.

The door sound starts almost silent, so nothing masked the click from cutting off the previous sound. Sounds now fade over 15 ms when stopped. A crackle was reported at the door's start, and this is the one measured cause found: the setup time and the sample were ruled out, and filtering slowed samples made no measurable difference. Whether it fully fixes what was heard hasn't been confirmed.

There's no limiter. An earlier version had the browser's compressor on the output, but it cut short sounds to about half their level even well below its threshold, and measured levels leave nothing for it to catch.

Every file was rendered in a browser through both sound sources and measured for silence, invalid samples and clipping. Nobody has compared the result with a real phone.

### Vibration

`sh1-2007-a40` and the recommended game data have the vibration code, with a setting that's on by default and whose text in the JAR is "Vibra:". Turning it on vibrates for 250 ms, and each shot for 150 ms. Its one script command, in `2w`, says 200 ms in the first room, and `ExtBase.executeCommand` skips it after coming back to that room. The route's only run of that command comes after coming back, so the route doesn't feel it. The painting in the first room reaches a frame marked with a negative length, -20000, after 12 seconds. `RoomObject.animRoutine` vibrates for 200 ms the first time a new game reaches a marked frame, but not in a loaded game. The startup's 2 ms call isn't copied, because a browser wouldn't allow it before a click.

Some builds, such as `sh1-2014-a7`, don't have this code, but their text still has the setting's label, and the port gives every build with that label the same vibration. The exception among the 105 accepted builds is `sh1-en-v153`, which keeps the label but has no setting and never reads it, so the port leaves that label out when it renumbers the build's text.

The setting only appears on a touch screen whose browser has `navigator.vibrate`. Android Chrome does and Safari on iPhones doesn't. Shots along the route, and the rules above, are tested in Node with a stand-in for the call. Nobody has felt them on a phone.

## The Mobile 2 port

`web/engine/mobile2.mjs` runs Silent Hill Mobile 2 on the first game's engine, following `sh2-2015-base`'s decompiled code. Its script interpreter, the `c` class, was read against the port's: the commands mean the same, so the virtual machine is shared unchanged, and the difference between the games is in the engine around it. The tests for Silent Hill passed unchanged, apart from the count of accepted builds above.

The game can be finished in the port. `test/playthrough-sh2.test.mjs` plays it from a new game through Lucas and Vincent to "To be continued..." and back to the main menu, in 235 steps of pointer moves, clicks, keys and strokes. It passes through 30 of the 41 rooms. It leaves out `setup`, which is over within a tick, one of the three enemy rooms, the six map rooms and two rooms that only show something.

`scripts/walk-route.mjs` found the route. Its goals are the steps of [this walkthrough](https://www.silenthillmemories.net/sh_mobile2/walkthrough_en.htm), in order, with a few added from the scripts where a step takes two actions, such as unlocking a door before going through it. The keypad codes 2591 and 21536 and the nameplate order Bill, Marie, Lucas agree with the scripts. The walkthrough shows the drawings only as images, which weren't read, so those strokes come from the regions in `e.b`. The painting's regions are the sides of a triangle through three of its red dots, as the walkthrough's text describes. Searching this way takes about 300 MB, where `scripts/find-route.mjs` allows 7 GB.

The route finishes with each of the eight other dice seeds tried, and on the keyboard, apart from its strokes, which only a mouse can draw. It takes damage, unlike the first game's route, and got as low as 2 of 5 health. That shows a path exists, not that the game plays well.

### The keypad version

The Internet Archive's copy, `sh2-2015-a1`, is the keypad version: all 987 of its data entries match `sh2-2008-a7`. Its scripts and variables have different names from the touch build's, so its route is separate, in `src/sh2-keypad-route.json`, 234 steps long. `scripts/walk-route.mjs` writes both from the same goals, which go by what a player sees, such as item names and what's said.

The port still follows the touch build's engine for this version. Comparing the two builds' hard-coded strings found only the touch build's icons and puzzle code added, but the rest of the keypad engine hasn't been read closely.

Its puzzles are scripts rather than code. The painting is joined up by clicking dots 1, 2, 3, 8 and 1 again, the same triangle as the touch build's. The carving is steered with four arrows, along a staircase of right and up that was found by trying every way. There's no incision: the scalpel cuts the body directly. The route also finishes with four other dice seeds, on only the keyboard, and with saves and loads along the way.

### What differs from the first game

- **Rooms:** `s_screenWidth` and `s_screenHeight` set a room's size, 310x270 or 290x270. The original pans over them on a 240x320 screen, and the port shows the whole room, centered.
- **Palettes:** corridors are recolored by swapping an image's PNG palette, from `plts/`. An image takes the palette set when it's first loaded after a room change, because the `a` class caches it.
- **Exits:** there are also `turnback`, `turnleft`, `turnright`, stairs and elevator exits, with cursors of their own. The walking keys take the turns and `turnback`, and left and right take only the turns. Forward takes the stairs and the elevator only when there's no forward exit, so that they're straight ahead. Plain left and right exits, which like the stairs and elevator are all in rooms 3 and 9, are for the pointer.
- **The verb wheel:** it has three arms, with no mouth.
- **Battles:** `h.s` has its own rules. A shot hits anywhere on a target, rather than near an anchor point. Enemies have idle, moving, dodging, attacking and recovering states, and their vulnerable zones change every 20 ticks. A fight starts with the gun away. Reloading is from the inventory.
- **Being hit:** the screen is tiled with an image the script names, rather than blood spreading.
- **Skipping:** a `setSkip` variable decides what can be skipped, rather than the room's name.
- **The splash screen:** `e.b` centers the art and draws the logo over it, where the first game's `ExtBase.splashPaint` draws it against the left edge, over the logo. The art is 240x320 for a phone's screen, so in the port's 270-pixel-tall frame about 50 of its rows are cut off, and the logo covers more of the top.
- **The space around rooms:** the JAR has no art in the shape of the first game's panel, so the page's panel is as tall as its controls, with `gfx/border_bottom.png` repeated behind them. On a phone, `e.c` draws that strip and `gfx/border_top.png` above and below the room. It also draws `gfx/screenHUD_left.png` beside narrow rooms, which isn't in any of the four builds looked at, so the port turns the two strips on their sides for that, which is its own choice. The medium and small art builds tried have no strips, so these spaces stay black there.
- **Text:** the same phrases are numbered differently, so the engine now looks them up by name. Language files sit in a top-level `lan/` folder.

The moving enemy compares its name with the word `Enemy`, as `h.s` does. That name is translated, so in other languages enemies don't walk from side to side. This looks like a bug in the original, and the port keeps it.

### The drawn puzzles

`e.a`, `e.b` and `e.c` draw a line and check its position against regions measured from a mask image's corner. They don't read the mask's pixels. A stroke has to touch three checkpoints without leaving the regions, and only dragging counts, not the point it starts from. As in the original, nothing is drawn for the first 350 ms. The keypad builds have ordinary puzzles in rooms of the same names, and the port lets those be clicked.

### Vibration

The touch build vibrates for 150 ms on each shot, and whenever one of 17 script commands says to. It has a setting for this, on by default, whose text in the JAR is "Vibra:", and turning it on vibrates for 250 ms. The port does the same through the browser's `navigator.vibrate`. The keypad builds have the same 17 commands but ignore them, and have no such setting, so the keypad version doesn't vibrate in the port either. 

The setting only appears on a touch screen whose browser has that call. Android Chrome does and Safari on iPhones doesn't. The route's vibrations are tested in Node, with a stand-in for the call. Nobody has felt them on a phone.

### What the port leaves out

- The touch build's navigation and pointer icons and its arrows for turning, which have no use with a mouse. Its other icons are on the page's buttons rather than over the room, where they'd cover art and clash with hotspots. As in `h.s`, the weapon icon becomes `iconBattle1` while the gun is out, and they go grey while a menu is open, except that an open inventory keeps its icon lit, because pressing it closes the inventory. `h.s` hides them in rooms whose names contain `control`, `start`, `light`, `dark` or `puzzle`, and the page's buttons stay there, so they go grey instead. The art comes from the player's JAR. The keypad version has none, so its buttons have only words.
- The Mouse recoil setting is shared with the first game and hasn't been tried in Mobile 2.

### Help and the tutorial

The JAR's Help and tutorial describe a keypad, or the touch build's icons. `web/engine/mobile2-help.mjs` rewrites what's about controls, in all six languages, and keeps the rest in the JAR's words. The tutorial still shows the touch build's pictures of its icons, with lines about the keys that do those jobs here. The translations are this port's own and haven't been checked by native speakers, and the page's buttons are named in English because they stay in English. Fan translations, recognized by the wording of the tutorial's first line, keep their original text. Across the 61 undamaged INK builds, that's 7 with Russian in the English slot, 4 with Chinese in the French slot and 1 with Vietnamese in the Portuguese slot.

### What was tried

In the browser, with `sh2-2015-base`: the startup, the main menu, the tutorial, the first room, the verb wheel, a recolored corridor, a fight and two drawn puzzles, using real pointer events where it mattered. Those rooms were reached by setting the game's state rather than by walking there, and the rest of the route has only been run in Node. No one has played it by hand, and the music hasn't been listened to.

The Internet Archive's button was clicked in the browser: it downloaded the file, checked its hash, kept it, and a reload played from the kept copy without downloading again. The keypad version's painting was solved there with pointer events. The first game's button was clicked too, after it became one of two.

The two smaller art sizes reach the first room in Node, and no further has been tried.

Playing the route also found a freeze in the engine shared with the first game: pressing Esc in a menu at the moment a script's wait ended closed the text that script had just opened, which left it waiting forever. A key now goes to whatever is on top after the wait ends.

## The Mobile 3 port

`web/engine/mobile3/` runs on its own engine, reading the game's tables out of the player's JAR, and shares only the page and sound with the other two games. Their code hasn't changed.

`test/mobile3-route.test.mjs` plays from a new game to the ending in Node, through the page's own methods, following [the walkthrough at Silent Hill Memories](https://www.silenthillmemories.net/sh_mobile3/walkthrough_en.htm). It does this on one build of each of the 12 different programs the port accepts. Its fights use a seeded random number generator and perfect aim, so surviving them says nothing about how hard they are.

In the browser, `sh3-2010-v1.0.20-a` was started from the Internet Archive button and clicked by hand from its logos to the opening dialogue. Screens were looked at by eye on it and `sh3-en-v170`: the menus, the inventory, the map, the verb wheel, a corridor, all six puzzles on the keypad build, three of them on the touch build, and all four monsters on the keypad build. There were no console errors. The rest of the route has only been run in Node, and sound has been parsed, not listened to.

### Which builds

The port follows two kinds of build. They have the same game and tables, and differ in the resource numbers written into their methods, which `web/engine/mobile3/resources.mjs` lists. Touch builds, like `sh3-en-v170`, have extra art for on-screen buttons. Keypad builds, like `sh3-2010-v1.0.20-a`, keep their MIDI files in `b.mbf`, and those are byte-identical to the touch builds' loose files.

The Internet Archive button loads `sh3-2010-v1.0.20-a`, which has the key that makes the code a full game. Another copy on the Archive, in `SHMobileGames.zip`, is the same as `sh3-2010-v1.0.17-a10`. It lacks that key, so its code would end it after 3 minutes, and it's from a family with smaller art and different class names, which the port doesn't follow.

### What the port changes

- Scenes are shown whole, with what a phone draws on its 240-pixel screen in the middle. So the fights, puzzles and boxes are laid out as on a phone, and the areas for turning in a corridor are the port's own.
- The door to the last room's words are wrapped to fit their paper. The original wraps them 100 pixels wider than the paper, which hides the end of each line.
- Keypad builds have no way to enter the safe's number with a mouse, so the port adds one.
- Long text scrolls by a click before moving on, rather than needing the up and down keys.
- Fights have no critical hits, as the keypad builds don't. Touch builds add on-screen targets for them, and the port doesn't draw those.
- The demo's 3-minute limit isn't included, as for the other games' checks.

### Original behavior that looks like a bug

These are kept:

- Rule 35 lists an action its count skips, and two rules have a condition that's never true, so their dialogues never show.
- Pouring from the largest bottle into the smallest, or from the middle one into a partly full smallest, doesn't conserve sand. The walkthrough's order isn't affected.
- The last monster reads its two position tables crosswise, as the bytecode confirms.
- Picking the Beretta up again in the last chapter gives you a second one.

## What hasn't been checked

- The first game has been played through once by a person in the browser, who reported that it seemed okay. That wasn't a side-by-side comparison with the original on a phone, and the route in `test/playthrough.test.mjs` hasn't been compared with one either.
- Mobile 3 hasn't been played by hand to its end, or compared with a phone. How often its monsters attack depends on the same assumed 60 ms tick as the other games.
- Mobile 2 hasn't been compared with a phone, and how often its monsters attack depends on the same assumed 60 ms tick as the first game's.
- The decompiled Java hasn't been recompiled.
- Build dates come from ZIP metadata.
