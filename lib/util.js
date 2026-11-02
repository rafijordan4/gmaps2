'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function run(cmd, args, opts = {}) {
  console.log('$ ' + [cmd, ...args].join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} keluar dengan kode ${r.status}`);
}

function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function has(cmd) {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function findIsos(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(iso|bin|cso|isz|chd)$/i.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      return { name: f, path: p, size: fs.statSync(p).size };
    });
}

// Android SDK resmi hanya ada untuk Linux x86_64. Termux (arm64) harus build jarak jauh.
function canBuildLocally() {
  return process.platform === 'linux' && process.arch === 'x64';
}

function safeName(n) {
  return String(n).replace(/\W+/g, '_');
}

function linkOrCopy(src, dst) {
  try { fs.rmSync(dst, { force: true }); } catch (_) {}
  try { fs.linkSync(src, dst); } catch (_) { fs.copyFileSync(src, dst); }
}

function loadConfig(cwd) {
  const p = path.join(cwd, 'gmaps2.json');
  if (!fs.existsSync(p)) throw new Error('gmaps2.json tidak ada. Jalankan: gmaps2 init');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = { run, capture, has, copyDir, findIsos, canBuildLocally, safeName, linkOrCopy, loadConfig };
