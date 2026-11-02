'use strict';
const fs = require('fs');
const path = require('path');
const { has, capture, findIsos, canBuildLocally } = require('./util');
const { sdkRoot } = require('./setup');

function doctor(cwd) {
  const ok = (m) => console.log('  [OK]  ' + m);
  const bad = (m) => console.log('  [!!]  ' + m);
  const local = canBuildLocally();

  console.log(`Platform: ${process.platform}/${process.arch} -> build ${local ? 'LOKAL' : 'JARAK JAUH via GitHub Codespaces'}\n`);

  if (local) {
    console.log('Tools build lokal:');
    for (const t of ['git', 'java', 'curl', 'unzip']) has(t) ? ok(t) : bad(t + ' belum ada');
    const root = sdkRoot();
    fs.existsSync(path.join(root, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'))
      ? ok('Android SDK: ' + root)
      : bad('Android SDK belum ada (otomatis dipasang saat gmaps2 build, atau jalankan: gmaps2 setup)');
  } else {
    console.log('Tools build jarak jauh:');
    if (!has('gh')) bad('gh belum ada (Termux: pkg install gh)');
    else {
      ok('gh');
      const st = capture('gh', ['auth', 'status']);
      st.code === 0 ? ok('gh sudah login') : bad('gh belum login: jalankan gh auth login (pilih akses codespace)');
    }
    has('ssh') ? ok('ssh') : bad('ssh belum ada (Termux: pkg install openssh)');
  }

  console.log('\nIsi proyek:');
  fs.existsSync(path.join(cwd, 'gmaps2.json')) ? ok('gmaps2.json') : bad('Jalankan gmaps2 init dulu');
  const isos = findIsos(path.join(cwd, 'iso'));
  isos.length
    ? isos.forEach((i) => ok(`ISO: ${i.name} (${(i.size / 1e9).toFixed(2)} GB)`))
    : bad('Tidak ada ISO di iso/');
  console.log('\n(BIOS tidak perlu: Play! memakai HLE)');
}

module.exports = { doctor };
