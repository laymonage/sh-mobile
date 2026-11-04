import { parseClass } from './classfile.mjs';
import { isInk, loadInkData, parseLan } from './ink.mjs';
import { buildsOf, input, readInput, sha1Short, sha256 } from './inputs.mjs';
import { parseBoxal, parseMbf, pngSizes } from './mbf.mjs';
import { pngInfo } from './png.mjs';
import { Zip } from './zip.mjs';

const SITE_MARKERS = [
  'dedomil',
  'konon',
  'kriker',
  'allmobi',
  'mobile3k',
  'prowap',
  'mynokia',
  'seclub',
  'foronokia',
  'xsmart',
  'kimjunco',
  'vserv',
  'torpedo',
  'joybits',
  'supplied by',
];
const POINTER_METHODS = new Set(['pointerPressed', 'pointerReleased', 'pointerDragged']);
const ENGINE_CLASSES = new Set([
  'M',
  'GameMidlet',
  'Cheat',
  'Ext',
  'ExtBase',
  'LoadRequest',
  'Menu',
  'MyCanvas',
  'Resource',
  'RoomObject',
  'Script',
  'ScriptThread',
  's',
  'txt_consts',
]);
const STANDARD_MANIFEST = new Set([
  'Manifest-Version',
  'MIDlet-1',
  'MIDlet-Name',
  'MIDlet-Version',
  'MIDlet-Vendor',
  'MIDlet-Icon',
  'MIDlet-Data-Size',
  'MicroEdition-Configuration',
  'MicroEdition-Profile',
  'Created-By',
  'Ant-Version',
]);

// What an unaltered build's manifest says. SH2 builds packaged on 2008-09-26 all
// add the ProvisionX line, and SH3's publisher and device fields vary by build.
const EXPECTED = {
  sh1: { vendor: 'Konami', name: 'Silent Hill', extraManifest: /^$/ },
  sh2: { vendor: 'Konami', name: 'Silent Hill Mobile 2', extraManifest: /^ProvisionX-Highscore-gameCode$/ },
  sh3: {
    vendor: 'Connect2Media',
    name: 'Silent Hill 3',
    extraManifest:
      /^(C2M-|Nokia-MIDlet-|MIDlet-Touch-Support|MIDlet-Jar-|MIDlet-Install-Notify|MIDlet-Permissions|UseNative|ReverseSoftkeys|LGE-)/,
  },
};

function parseManifest(text) {
  const unfolded = text.replace(/^ï»¿/, '').replace(/\r/g, '').replace(/\n /g, '');
  const fields = {};
  for (const line of unfolded.split('\n')) {
    const separator = line.indexOf(': ');
    if (separator > 0) fields[line.slice(0, separator)] = line.slice(separator + 2).trim();
  }
  return fields;
}

const fingerprint = (entries, pattern = /./) =>
  sha1Short(
    Buffer.from(
      [...entries]
        .filter(([name]) => pattern.test(name))
        .map(([name, value]) => `${name}:${sha1Short(value)}`)
        .sort()
        .join('\n'),
    ),
  );

// Names the script of a language file's text, to spot translations in the wrong slot.
export function textScript(strings) {
  const all = strings.join(' ');
  const count = (pattern) => all.match(pattern)?.length ?? 0;
  if (count(/[Ѐ-ӿ]/g) > 100) return 'cyrillic';
  if (count(/[㐀-鿿]/g) > 100) return 'chinese';
  return 'latin';
}

function analyzeInk(zip, result) {
  const data = loadInkData(zip);
  const { entries } = data;
  const infos = [...entries].filter(([name]) => name.endsWith('.png')).map(([, value]) => pngInfo(value));
  const languages = [...entries].filter(([name]) => name.endsWith('.lan') && /\/[a-z]+\.lan$/.test(name));
  const lanStrings = new Map();
  const malformedLanguages = [];
  for (const [name, value] of languages) {
    const language = name.match(/([a-z]+)\.lan$/)[1];
    try {
      lanStrings.set(language, parseLan(value, { strict: true }));
    } catch {
      malformedLanguages.push(language);
    }
  }
  const english = lanStrings.get('en') ?? [];

  return Object.assign(result, {
    data,
    scripts: [...entries.keys()].filter((name) => name.includes('/scr/')).length,
    rooms: [...entries.keys()].filter((name) => name.includes('/rom/')).length,
    gfx: {
      count: infos.length,
      maxWidth: Math.max(...infos.map((info) => info.width)),
      maxHeight: Math.max(...infos.map((info) => info.height)),
    },
    languages: [...lanStrings.keys(), ...malformedLanguages].sort(),
    malformedLanguages,
    textScripts: Object.fromEntries([...lanStrings].map(([language, strings]) => [language, textScript(strings)])),
    englishNonAscii: english.join('').match(/[\u0080-ÿ]/g)?.length ?? 0,
    dataGroup: fingerprint(entries),
    scriptGroup: fingerprint(entries, /\/scr\//),
    roomGroup: fingerprint(entries, /\/rom\//),
    gfxGroup: fingerprint(entries, /\.png$/),
    languageGroup: fingerprint(entries, /\.lan$/),
    englishGroup: fingerprint(entries, /\/en\.lan$/),
    midiGroup: fingerprint(entries, /\/sfx\//),
  });
}

function analyzeAal(zip, result, strings) {
  const archives = ['p.mbf', 'b.mbf'].filter((name) => zip.has(name)).map((name) => [name, parseMbf(zip.read(name))]);
  const sizes = archives.flatMap(([, entries]) => pngSizes(entries));
  const looseImages = zip.names.filter((name) => name.endsWith('.png'));
  const key = result.manifest['C2M-Demo'];
  return Object.assign(result, {
    ...(zip.has('boxal.inf') ? parseBoxal(zip.read('boxal.inf').toString('latin1')) : { tier: null, version: null }),
    archives: Object.fromEntries(archives.map(([name, entries]) => [name, entries])),
    archiveHashes: Object.fromEntries(archives.map(([name]) => [name, sha1Short(zip.read(name))])),
    gfx: {
      count: sizes.length,
      maxWidth: Math.max(0, ...sizes.map(({ width }) => width)),
      maxHeight: Math.max(0, ...sizes.map(({ height }) => height)),
    },
    looseImages,
    languages: zip.names
      .map((name) => name.match(/^TRAD_(.+)\.loc$/)?.[1])
      .filter(Boolean)
      .sort(),
    englishGroup: zip.has('TRAD_english.loc') ? sha1Short(zip.read('TRAD_english.loc')) : null,
    // Compares against the code's constant, so the key itself stays out of this repo.
    demo: !strings.has('C2M-Demo') ? 'no-check' : key && strings.has(key) ? 'full' : 'demo',
  });
}

export function analyzeBuild(id) {
  const { game } = input(id);
  const buffer = readInput(id);
  const zip = new Zip(buffer);
  const names = zip.names;

  // A damaged entry is a finding about the build, so it shouldn't stop the comparison.
  const corruptEntries = [];
  const contents = new Map();
  for (const name of names) {
    try {
      contents.set(name, zip.read(name));
    } catch {
      corruptEntries.push(name);
    }
  }

  const classes = names.filter((name) => name.endsWith('.class')).map((name) => parseClass(contents.get(name)));
  const strings = new Set(classes.flatMap((parsed) => [...parsed.strings]));
  // The low-end builds keep their own classes in a sh/ package.
  const foreignClasses = classes
    .map((parsed) => parsed.name)
    .filter(
      (name) => !name.startsWith('sh/') && (name.includes('/') || (name.length > 2 && !ENGINE_CLASSES.has(name))),
    );
  const pointerMethods = (parsed) => parsed.methods.filter((name) => POINTER_METHODS.has(name));

  const dateCounts = new Map();
  for (const name of names)
    dateCounts.set(zip.entries.get(name).date, (dateCounts.get(zip.entries.get(name).date) ?? 0) + 1);
  const dates = [...dateCounts.keys()].sort();

  const manifest = parseManifest(contents.get('META-INF/MANIFEST.MF').toString('latin1'));
  const body = [...contents].filter(([name]) => !name.startsWith('META-INF/'));
  const siteMarkers = {};
  for (const [name, value] of contents) {
    const text = `${name}\n${value.toString('latin1')}`.toLowerCase();
    for (const marker of SITE_MARKERS) {
      if (text.includes(marker)) (siteMarkers[marker] ??= []).push(name);
    }
  }

  const expected = EXPECTED[game];
  const extraManifest = Object.keys(manifest).filter(
    (key) => !STANDARD_MANIFEST.has(key) && !expected.extraManifest.test(key),
  );
  const result = {
    id,
    game,
    size: buffer.length,
    sha256: sha256(buffer),
    fileCount: names.length,
    manifest,
    extraManifest,
    siteMarkers,
    corruptEntries,
    packagedAt: [...dateCounts].sort((left, right) => right[1] - left[1])[0][0],
    dateCount: dates.length,
    manifestDate: zip.entries.get('META-INF/MANIFEST.MF').date,
    newestDate: dates.at(-1),
    classNames: classes.map((parsed) => parsed.name).sort(),
    foreignClasses: foreignClasses.sort(),
    debugInfo: classes.some(
      (parsed) => parsed.attributeNames.has('LineNumberTable') || parsed.attributeNames.has('LocalVariableTable'),
    ),
    gamePointerMethods: classes
      .filter((parsed) => !foreignClasses.includes(parsed.name))
      .flatMap(pointerMethods)
      .sort(),
    anyPointerMethods: classes.flatMap(pointerMethods).sort(),
    leftoverDevFiles: names.filter((name) => /\.java~$|\.ini~$|Thumbs\.db$|\/_old|\/old_|touchpad\.png$/.test(name)),
    bodyGroup: fingerprint(body),
    codeGroup: fingerprint(body, /\.class$/),
    strings,
  };
  result.markerFree =
    manifest['MIDlet-Vendor'] === expected.vendor &&
    manifest['MIDlet-Name'] === expected.name &&
    !Object.keys(siteMarkers).length &&
    !foreignClasses.length &&
    !extraManifest.length;
  result.looksUntouched = result.markerFree && result.dateCount === 1 && !result.packagedAt.startsWith('1980');

  if (game === 'sh3') return analyzeAal(zip, { ...result, family: 'aal' }, strings);
  if (!isInk(zip)) return { ...result, family: 'low-end' };
  result.family = 'ink';
  if (corruptEntries.length) return result;
  return analyzeInk(zip, result);
}

export function analyzeGame(game) {
  return new Map(buildsOf(game).map(({ id }) => [id, analyzeBuild(id)]));
}

// Other builds whose contents match byte for byte outside META-INF.
export function twinsOf(builds, id) {
  const { bodyGroup } = builds.get(id);
  return [...builds.values()]
    .filter((build) => build.id !== id && build.bodyGroup === bodyGroup)
    .map((build) => build.id)
    .sort();
}

export function diffData(left, right) {
  const diff = { changedNames: [], addedNames: [], removedNames: [] };
  for (const [name, value] of right.entries) {
    if (!left.entries.has(name)) diff.addedNames.push(name);
    else if (!left.entries.get(name).equals(value)) diff.changedNames.push(name);
  }
  for (const name of left.entries.keys()) {
    if (!right.entries.has(name)) diff.removedNames.push(name);
  }
  return diff;
}

export function diffStrings(left, right) {
  const a = parseLan(left);
  const b = parseLan(right);
  const changes = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) changes.push({ index: i, left: a[i], right: b[i] });
  }
  return changes;
}

export function setDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

export function groupBy(builds, key) {
  const groups = new Map();
  for (const build of builds) {
    const value = key(build);
    if (value === undefined || value === null) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(build.id);
  }
  return groups;
}
