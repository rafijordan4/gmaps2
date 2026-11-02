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
  controls: { opacity: 0.55, haptics: true }
};

function init(cwd) {
  for (const d of ['iso', 'assets', 'output']) fs.mkdirSync(path.join(cwd, d), { recursive: true });
  const cfg = path.join(cwd, 'gmaps2.json');
  if (!fs.existsSync(cfg)) fs.writeFileSync(cfg, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  console.log('[gmaps2] Siap. Taruh ISO di iso/ (opsional: icon.png di assets/), lalu: npm run build');
}

module.exports = { init };
