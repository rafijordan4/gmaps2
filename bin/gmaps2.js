#!/usr/bin/env node
'use strict';

const { init } = require('../lib/init');
const { doctor } = require('../lib/doctor');
const { build } = require('../lib/build');
const { setup } = require('../lib/setup');

const HELP = `
gmaps2 - ISO PS2 jadi APK (kontrol ala PS), build di GitHub Codespaces

  npm run doctor   cek tools + ISO
  npm run setup    pasang Android SDK/NDK/CMake
  npm run build    build APK -> output/

Atau pakai perintah: gmaps2 init | doctor | setup | build [--mode bundle|external]
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < rest.length; i++) if (rest[i] === '--mode') flags.mode = rest[++i];
  const cwd = process.env.GMAPS2_PROJECT || process.cwd();
  switch (cmd) {
    case 'init': return init(cwd);
    case 'doctor': return doctor(cwd);
    case 'setup': return setup();
    case 'build': return build(cwd, flags);
    default: console.log(HELP);
  }
}

main().catch((e) => {
  console.error('\n[gmaps2] Gagal: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
