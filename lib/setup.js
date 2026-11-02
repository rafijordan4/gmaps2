'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, has, capture, canBuildLocally } = require('./util');

const CMDLINE_URL = 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip';
const PACKAGES = [
  { pkg: 'platforms;android-35', dir: 'platforms/android-35' },
  { pkg: 'ndk;29.0.14206865', dir: 'ndk/29.0.14206865' },
  { pkg: 'cmake;3.31.1', dir: 'cmake/3.31.1' }
];

function sdkRoot() {
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'android-sdk');
}

// Pasang Android SDK + NDK + CMake yang dibutuhkan Play! (hanya Linux x86_64).
function setup() {
  if (!canBuildLocally()) {
    throw new Error('Android SDK resmi hanya jalan di Linux x86_64. Di Termux pakai: gmaps2 build (otomatis build lewat GitHub Codespaces).');
  }
  for (const t of ['curl', 'unzip', 'java']) if (!has(t)) throw new Error(`${t} belum terpasang`);

  const root = sdkRoot();
  const sdkmanager = path.join(root, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');
  if (!fs.existsSync(sdkmanager)) {
    console.log('[setup] Download Android command-line tools');
    fs.mkdirSync(root, { recursive: true });
    const zip = path.join(root, 'cmdline-tools.zip');
    run('curl', ['-fsSL', '-o', zip, CMDLINE_URL]);
    const tmp = path.join(root, '.cmdline-tmp');
    fs.rmSync(tmp, { recursive: true, force: true });
    run('unzip', ['-q', zip, '-d', tmp]);
    fs.mkdirSync(path.join(root, 'cmdline-tools'), { recursive: true });
    fs.rmSync(path.join(root, 'cmdline-tools', 'latest'), { recursive: true, force: true });
    fs.renameSync(path.join(tmp, 'cmdline-tools'), path.join(root, 'cmdline-tools', 'latest'));
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(zip, { force: true });
  }

  const env = { ...process.env, ANDROID_HOME: root, ANDROID_SDK_ROOT: root };
  const missing = PACKAGES.filter((p) => !fs.existsSync(path.join(root, p.dir)));
  if (missing.length) {
    console.log('[setup] Terima lisensi + pasang: ' + missing.map((m) => m.pkg).join(', '));
    capture('sh', ['-c', `yes | "${sdkmanager}" --sdk_root="${root}" --licenses`], { env });
    run(sdkmanager, ['--sdk_root=' + root, ...missing.map((m) => m.pkg)], { env });
  } else {
    console.log('[setup] SDK sudah lengkap: ' + root);
  }
  return root;
}

module.exports = { setup, sdkRoot };
