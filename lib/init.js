'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  name: 'Game PS2',
  packageId: 'com.gmaps2.game',
  mode: 'auto',
  abis: ['arm64-v8a'],
  emulator: {
    repo: 'https://github.com/jpd002/Play-.git',
    ref: 'master',
    dir: null
  },
  remote: {
    repo: 'jpd002/Play-',
    machine: 'standardLinux32gb',
    displayName: 'gmaps2-build'
  },
  controls: { opacity: 0.55, haptics: true }
};

function init(cwd) {
  for (const d of ['iso', 'assets', 'output']) fs.mkdirSync(path.join(cwd, d), { recursive: true });
  const cfg = path.join(cwd, 'gmaps2.json');
  if (!fs.existsSync(cfg)) fs.writeFileSync(cfg, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  fs.writeFileSync(path.join(cwd, 'iso', 'TARUH_ISO_DI_SINI.txt'), 'Taruh file ISO game PS2 di folder ini.\n');
  fs.writeFileSync(path.join(cwd, 'assets', 'TARUH_ICON_DI_SINI.txt'), 'Opsional: taruh icon.png (persegi) di folder ini.\n');
  console.log('[gmaps2] Siap. Langkah selanjutnya:');
  console.log('  1. Taruh ISO di iso/  (opsional: icon.png di assets/, edit nama game di gmaps2.json)');
  console.log('  2. gmaps2 doctor');
  console.log('  3. gmaps2 build');
  console.log('  (BIOS tidak perlu: emulator Play! memakai HLE)');
}

module.exports = { init };
