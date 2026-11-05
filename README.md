# sh-mobile

A browser port of the three Silent Hill: Mobile games made for Java (J2ME) phones, and the analysis of their builds behind it.

| Game | Engine |
| --- | --- |
| Silent Hill: Mobile | Daydream's INK: scripts on a virtual machine, with rooms as data |
| Silent Hill: Mobile 2 | The same engine |
| Silent Hill: Mobile 3 | Connect2Media's: logic in Java, with first-person corridors |

All three games can be played in the browser from a new game to the ending, and each has been played that way by hand. Tests also play each one through to its ending in Node.

> [!NOTE]
> This whole project is AI-assisted. The analysis, the port, the tests and these docs were written with Claude Opus 5.5 in Claude Code, directed and played by me.

## What's here

- The port lives in `web/`. You give it a JAR from one of the original games, and it plays that game's own data in your browser. Underneath are two engines rewritten from scratch, the way ScummVM does it for old adventure games: one for the first two games and one for Mobile 3. On top of that it adds mouse and keyboard controls, saves in the browser, and plays the MIDI music through a SoundFont.
- The analysis is in `src/` and `scripts/`. It compares about 300 builds of the three games, reads their scripts, rooms and art without running any Java, and works out which builds are the best ones to port.
- The tests are in `test/`. They check every number in the findings, and play all three games through to the end.

There are no game files in this repo. The JARs, the decompiled code and the rendered art all belong to their owners, so you bring your own copy. The port reads it right in your browser and never uploads it. If you don't have one, the page can fetch the copies on the Internet Archive for you.

## Playing

```bash
npm run play
```

Then open <http://localhost:8123/>, and choose a game or drop in a JAR. It needs Node.js 22 or newer and nothing else.

## Docs

- [Playing the port](docs/PLAYING.md): controls, settings, soundfonts and saving, and what's different in each game.
- [Findings](docs/FINDINGS.md): how the builds differ, which ones the port follows, how each engine works, and what hasn't been checked.
- [Running the analysis](docs/DEVELOPMENT.md): requirements, setup, the commands and the code's layout.

## License

The code and docs are under the [MIT License](LICENSE). The shipped soundfonts in `web/soundfonts/` have their own licenses, described in [their notice](web/soundfonts/NOTICE.md). Silent Hill is a trademark of Konami, and this project isn't affiliated with or endorsed by Konami or the games' developers.
