#!/usr/bin/env node
'use strict';

const { init } = require('../lib/init');
const { doctor } = require('../lib/doctor');
const { build } = require('../lib/build');
const { setup } = require('../lib/setup');

const HELP = `
gmaps2 - ISO PS2 jadi APK (kontrol ala PS)

Pakai:
  gmaps2 init      buat folder iso/, assets/ dan gmaps2.json
  gmaps2 doctor    cek tools + ISO
  gmaps2 setup     pasang Android SDK/NDK (Linux x86_64 / Codespaces)
  gmaps2 build     scan iso/, ambil emulator, pasang kontrol PS, build APK -> output/
  gmaps2 fetch     (Termux) ambil hasil build jarak jauh yang masih berjalan

Build otomatis:
  Linux x86_64 (Codespaces)  -> build lokal
  Termux / ARM               -> build lewat GitHub Codespaces (perlu: gh auth login)

Opsi build:
  --remote | --local   paksa lokasi build
  --mode bundle        ISO dibundel ke APK (default kalau ISO <= 1.5GB)
  --mode external      APK jadi launcher, ISO dipilih dari penyimpanan HP
  --keep               jangan stop codespace setelah selesai
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--remote') flags.remote = true;
    else if (rest[i] === '--local') flags.local = true;
    else if (rest[i] === '--keep') flags.keep = true;
    else if (rest[i] === '--mode') flags.mode = rest[++i];
  }
  switch (cmd) {
    case 'init': return init(process.cwd());
    case 'doctor': return doctor(process.cwd());
    case 'setup': return setup();
    case 'build': return build(process.cwd(), flags);
    case 'fetch': return require('../lib/remote').fetchOnly(process.cwd(), flags);
    default: console.log(HELP);
  }
}

main().catch((e) => {
  console.error('\n[gmaps2] Gagal: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
