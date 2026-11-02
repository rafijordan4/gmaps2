'use strict';
const fs = require('fs');
const path = require('path');
const { has, findIsos, canBuildLocally } = require('./util');
const { sdkRoot } = require('./setup');

function doctor(cwd) {
  const ok = (m) => console.log('  [OK]  ' + m);
  const bad = (m) => console.log('  [!!]  ' + m);

  console.log(`Platform: ${process.platform}/${process.arch}`);
  canBuildLocally() ? ok('Linux x86_64, bisa build di sini') : bad('Harus dijalankan di GitHub Codespaces / Linux x86_64 (bukan Termux)');

  console.log('\nTools:');
  for (const t of ['git', 'java', 'curl', 'unzip']) has(t) ? ok(t) : bad(t + ' belum ada');
  const root = sdkRoot();
  fs.existsSync(path.join(root, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'))
    ? ok('Android SDK: ' + root)
    : bad('Android SDK belum ada (otomatis dipasang saat build, atau: npm run setup)');

  console.log('\nProyek:');
  fs.existsSync(path.join(cwd, 'gmaps2.json')) ? ok('gmaps2.json') : bad('gmaps2.json tidak ada (jalankan: node bin/gmaps2.js init)');
  const isos = findIsos(path.join(cwd, 'iso'));
  isos.length
    ? isos.forEach((i) => ok(`ISO: ${i.name} (${(i.size / 1e9).toFixed(2)} GB)`))
    : bad('Tidak ada ISO di iso/');
  console.log('\n(BIOS tidak perlu: Play! memakai HLE)');
}

module.exports = { doctor };
