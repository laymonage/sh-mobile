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

- **The port**, in `web/`. It loads the original game data from a JAR you provide and plays it in the browser, on reimplemented engines: one for the first two games, as ScummVM does for adventure games, and one for Mobile 3. It adds mouse and keyboard controls, saving to the browser, and MIDI music through a SoundFont.
- **The analysis**, in `src/` and `scripts/`. It compares about 300 builds of the three games, decodes their scripts, rooms and art without running any Java, and recommends which builds a port should follow.
- **Tests**, in `test/`, which pin each number in the findings and play routes through all three games.

## No game files

This repo contains no game files. The JARs, decompiled code and rendered art are copyrighted, so you supply your own copy and the port reads it in your browser without uploading it. The page can also fetch the copies on the Internet Archive for you.

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
