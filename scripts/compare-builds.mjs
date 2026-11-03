import { analyzeGame, groupBy, twinsOf } from '../src/builds.mjs';
import { GAMES } from '../src/inputs.mjs';
import { table, writeReport } from '../src/report.mjs';

const dimensions = ({ gfx }) => (gfx ? `${gfx.maxWidth}x${gfx.maxHeight}` : '-');
const markers = (build) => Object.keys(build.siteMarkers).join(' ');
const summarize = ({ data, strings, archives, ...rest }) => rest;

const summary = {};
for (const game of GAMES) {
  const builds = analyzeGame(game);
  const list = [...builds.values()];

  summary[game] = {
    buildCount: list.length,
    families: Object.fromEntries(groupBy(list, (build) => build.family)),
    looksUntouched: list.filter((build) => build.looksUntouched).map((build) => build.id),
    identicalOutsideManifest: Object.fromEntries(
      [...groupBy(list, (build) => build.bodyGroup)].filter(([, ids]) => ids.length > 1),
    ),
    dataGroups: Object.fromEntries(groupBy(list, (build) => build.dataGroup)),
    archiveGroups: Object.fromEntries(
      groupBy(list, (build) => (build.archiveHashes ? JSON.stringify(build.archiveHashes) : null)),
    ),
    builds: list.map((build) => ({ ...summarize(build), identicalOutsideManifest: twinsOf(builds, build.id) })),
  };

  const rows = list.map((build) => [
    build.id,
    build.size,
    build.family,
    build.packagedAt,
    build.tier?.replace(/^silenthillmobile3_/, '') ?? '-',
    dimensions(build),
    build.languages?.join(' ') ?? '-',
    build.textScripts
      ? Object.entries(build.textScripts)
          .filter(([, script]) => script !== 'latin')
          .map(([language, script]) => `${language}=${script}`)
          .join(' ')
      : '-',
    build.demo ?? '-',
    build.looksUntouched ? 'yes' : 'no',
    markers(build),
    build.foreignClasses.length,
    build.gamePointerMethods.length ? 'yes' : 'no',
    twinsOf(builds, build.id).join(' '),
  ]);
  writeReport(
    `builds-${game}.md`,
    `# ${game} builds\n\n${table(
      [
        'ID',
        'Bytes',
        'Family',
        'Packaged',
        'Tier',
        'Largest image',
        'Languages',
        'Translated slots',
        'Demo',
        'Looks untouched',
        'Site markers',
        'Foreign classes',
        'Game pointer code',
        'Identical outside manifest',
      ],
      rows,
    )}\n`,
  );
  console.log(`${game}: ${list.length} builds, ${summary[game].looksUntouched.length} look untouched.`);
}
writeReport('builds.json', summary);
