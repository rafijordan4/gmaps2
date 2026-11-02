'use strict';
const fs = require('fs');
const path = require('path');
const { run, capture, findIsos, canBuildLocally, safeName, loadConfig } = require('./util');
const { setup } = require('./setup');
const { patch } = require('./patch');

const BUNDLE_LIMIT = 1.5 * 1024 ** 3; // 1.5 GB, batas aman APK

function ensureKeystore(cwd) {
  const ks = path.join(cwd, 'gmaps2.keystore');
  if (!fs.existsSync(ks)) {
    console.log('[build] Buat keystore penandatangan');
    run('keytool', [
      '-genkeypair', '-keystore', ks, '-alias', 'gmaps2', '-keyalg', 'RSA', '-keysize', '2048',
      '-validity', '10000', '-storepass', 'gmaps2pass', '-keypass', 'gmaps2pass', '-dname', 'CN=gmaps2'
    ]);
  }
  return ks;
}

function ensureEmulator(cwd, cfg) {
  const emu = process.env.GMAPS2_EMU_DIR || cfg.emulator.dir || path.join(cwd, '.gmaps2-work', 'emulator');
  if (!fs.existsSync(emu)) {
    console.log('[build] Clone emulator: ' + cfg.emulator.repo);
    fs.mkdirSync(path.dirname(emu), { recursive: true });
    run('git', ['clone', '--recursive', '--depth', '1', '--shallow-submodules', '-b', cfg.emulator.ref, cfg.emulator.repo, emu]);
  } else {
    console.log('[build] Emulator dipakai: ' + emu);
    run('git', ['submodule', 'update', '--init', '--recursive', '--depth', '1'], { cwd: emu });
  }
  // Grgit di build.gradle butuh minimal satu tag untuk git.describe()
  capture('git', ['-C', emu, 'tag', '-f', 'gmaps2-base']);
  return emu;
}

async function build(cwd, flags) {
  if (!canBuildLocally()) throw new Error('Jalankan di GitHub Codespaces (Linux x86_64), bukan di Termux/HP.');
  const cfg = loadConfig(cwd);
  cfg.abis = cfg.abis && cfg.abis.length ? cfg.abis : ['arm64-v8a'];

  const isos = findIsos(path.join(cwd, 'iso'));
  if (!isos.length) throw new Error('Tidak ada ISO di folder iso/ (drag file ISO ke sana dulu)');
  const iso = isos.sort((a, b) => b.size - a.size)[0];
  const mode = flags.mode || (cfg.mode && cfg.mode !== 'auto' ? cfg.mode : null) || (iso.size <= BUNDLE_LIMIT ? 'bundle' : 'external');
  const assetName = 'game' + (path.extname(iso.name).toLowerCase() || '.iso');
  console.log(`[1/5] ISO: ${iso.name} (${(iso.size / 1e9).toFixed(2)} GB), mode: ${mode}`);

  console.log('[2/5] Android SDK/NDK');
  const sdk = setup();

  console.log('[3/5] Emulator Play!');
  const emu = ensureEmulator(cwd, cfg);

  console.log('[4/5] Pasang overlay kontrol PS + launcher');
  const droid = patch(emu, cfg, { iso, mode, assetName, projectDir: cwd });
  fs.writeFileSync(path.join(droid, 'local.properties'), `sdk.dir=${sdk}\n`);

  console.log('[5/5] Build APK (build pertama lama: kompilasi emulator C++)');
  const ks = ensureKeystore(cwd);
  const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
  const gradlew = path.join(droid, 'gradlew');
  fs.chmodSync(gradlew, 0o755);
  run(
    gradlew,
    [
      'assembleRelease', '--console=plain',
      `-PPLAY_RELEASE_STORE_FILE=${ks}`, '-PPLAY_RELEASE_STORE_PASSWORD=gmaps2pass',
      '-PPLAY_RELEASE_KEY_ALIAS=gmaps2', '-PPLAY_RELEASE_KEY_PASSWORD=gmaps2pass'
    ],
    { cwd: droid, env }
  );

  const apks = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.apk$/.test(e.name)) apks.push(p);
    }
  })(path.join(droid, 'build', 'outputs', 'apk', 'release'));
  if (!apks.length) throw new Error('APK tidak ditemukan setelah build');
  apks.sort((a, b) => Number(/unsigned/.test(a)) - Number(/unsigned/.test(b)));

  const out = path.join(cwd, 'output');
  fs.mkdirSync(out, { recursive: true });
  const final = path.join(out, safeName(cfg.name) + '.apk');
  fs.copyFileSync(apks[0], final);
  console.log('\n[gmaps2] Selesai: ' + final + '\nKlik kanan file itu di panel kiri -> Download.');
  return final;
}

module.exports = { build };
