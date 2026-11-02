'use strict';
const fs = require('fs');
const path = require('path');
const { run, capture, has, findIsos, safeName, loadConfig } = require('./util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PKG_ROOT = path.join(__dirname, '..');

function gh(args, opts = {}) {
  return capture('gh', args, opts);
}

function findOrCreateCodespace(cfg) {
  const r = cfg.remote;
  const list = gh(['codespace', 'list', '--json', 'name,displayName,state,repository', '--limit', '50']);
  if (list.code === 0) {
    try {
      const found = JSON.parse(list.out || '[]').find((c) => c.displayName === r.displayName && c.repository === r.repo);
      if (found) {
        console.log(`[remote] Pakai codespace lama: ${found.name} (${found.state})`);
        return found.name;
      }
    } catch (_) {}
  }
  console.log('[remote] Buat codespace baru dari ' + r.repo + ' (' + r.machine + ')');
  const base = ['codespace', 'create', '--repo', r.repo, '--display-name', r.displayName, '--default-permissions', '--idle-timeout', '60m'];
  let c = gh([...base, '--machine', r.machine]);
  if (c.code !== 0) {
    console.log('[remote] Machine ' + r.machine + ' gagal (' + c.err.split('\n').pop() + '), coba machine default');
    c = gh(base);
  }
  if (c.code !== 0) throw new Error('Gagal membuat codespace: ' + c.err);
  return c.out.split('\n').pop().trim();
}

function ssh(name, cmd, inherit) {
  return spawnGh(['codespace', 'ssh', '-c', name, '--', cmd], inherit);
}
function spawnGh(args, inherit) {
  return inherit ? { code: require('child_process').spawnSync('gh', args, { stdio: 'inherit' }).status } : gh(args);
}

async function waitReady(name) {
  process.stdout.write('[remote] Menunggu codespace siap');
  for (let i = 0; i < 40; i++) {
    const r = ssh(name, 'echo ready');
    if (r.code === 0 && /ready/.test(r.out)) { console.log(' ok'); return; }
    process.stdout.write('.');
    await sleep(8000);
  }
  throw new Error('Codespace tidak siap dalam waktu wajar. Cek: gh codespace list');
}

function stage(cwd, cfg) {
  const dir = path.join(cwd, '.gmaps2-remote');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Salinan nyata (bukan symlink, scp/sftp bisa melewatkan symlink). ISO dikirim terpisah karena besar.
  for (const part of ['bin', 'lib', 'templates', 'package.json']) {
    fs.cpSync(path.join(PKG_ROOT, part), path.join(dir, 'gmaps2', part), { recursive: true });
  }
  fs.copyFileSync(path.join(cwd, 'gmaps2.json'), path.join(dir, 'gmaps2.json'));
  if (fs.existsSync(path.join(cwd, 'assets'))) fs.cpSync(path.join(cwd, 'assets'), path.join(dir, 'assets'), { recursive: true });
  if (fs.existsSync(path.join(cwd, 'gmaps2.keystore'))) fs.copyFileSync(path.join(cwd, 'gmaps2.keystore'), path.join(dir, 'gmaps2.keystore'));
  fs.writeFileSync(
    path.join(dir, 'run.sh'),
    [
      '#!/usr/bin/env bash',
      'cd "$(dirname "$0")"',
      'rm -f ~/gmaps2-build.status',
      'if [ -d /workspaces/Play- ]; then export GMAPS2_EMU_DIR=/workspaces/Play-; fi',
      "nohup bash -c 'node gmaps2/bin/gmaps2.js build --local > ~/gmaps2-build.log 2>&1; echo $? > ~/gmaps2-build.status' >/dev/null 2>&1 &",
      'echo started',
      ''
    ].join('\n')
  );
  return dir;
}

async function buildRemote(cwd, flags) {
  const cfg = loadConfig(cwd);
  cfg.remote = Object.assign({ repo: 'jpd002/Play-', machine: 'standardLinux32gb', displayName: 'gmaps2-build' }, cfg.remote);
  if (!has('gh')) throw new Error('gh belum ada. Termux: pkg install gh openssh, lalu gh auth login');
  if (gh(['auth', 'status']).code !== 0) throw new Error('gh belum login. Jalankan: gh auth login');
  const iso = findIsos(path.join(cwd, 'iso')).sort((a, b) => b.size - a.size)[0];
  if (!iso) throw new Error('Tidak ada ISO di folder iso/');

  console.log('[1/6] Codespace');
  const name = findOrCreateCodespace(cfg);
  await waitReady(name);

  console.log('[2/6] Siapkan paket kecil (tool + config + icon)');
  const dir = stage(cwd, cfg);

  console.log(`[3/6] Upload ke codespace, ISO ${(iso.size / 1e9).toFixed(2)} GB (tergantung koneksi, bisa lama)`);
  const mk = ssh(name, 'rm -rf ~/gmaps2-payload && mkdir -p ~/gmaps2-payload/iso && echo ok');
  if (mk.code !== 0) throw new Error('Gagal menyiapkan folder di codespace: ' + mk.err);
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rec = fs.statSync(full).isDirectory() ? ['-r'] : [];
    run('gh', ['codespace', 'cp', '-c', name, ...rec, full, 'remote:gmaps2-payload/']);
  }
  run('gh', ['codespace', 'cp', '-c', name, iso.path, 'remote:gmaps2-payload/iso/']);

  console.log('[4/6] Mulai build di codespace');
  const st = ssh(name, 'bash ~/gmaps2-payload/run.sh');
  if (st.code !== 0 || !/started/.test(st.out || 'started')) throw new Error('Gagal menjalankan build jarak jauh: ' + (st.err || st.out));

  console.log('[5/6] Memantau log (Ctrl+C aman, build tetap jalan; lanjutkan nanti dengan: gmaps2 fetch)');
  await follow(name);

  console.log('[6/6] Ambil APK');
  return fetchApk(cwd, cfg, name, flags);
}

async function follow(name) {
  let offset = 0;
  for (;;) {
    const log = ssh(name, `tail -c +${offset + 1} ~/gmaps2-build.log 2>/dev/null`);
    if (log.code === 0 && log.out) {
      process.stdout.write(log.out + '\n');
      offset += Buffer.byteLength(log.out) + 1;
    }
    const s = ssh(name, 'cat ~/gmaps2-build.status 2>/dev/null');
    if (s.code === 0 && s.out !== '') {
      if (s.out.trim() !== '0') throw new Error('Build di codespace gagal (kode ' + s.out.trim() + '). Log lengkap: gh codespace ssh -c ' + name + ' -- cat gmaps2-build.log');
      return;
    }
    await sleep(15000);
  }
}

function fetchApk(cwd, cfg, name, flags) {
  const out = path.join(cwd, 'output');
  fs.mkdirSync(out, { recursive: true });
  const final = path.join(out, safeName(cfg.name) + '.apk');
  run('gh', ['codespace', 'cp', '-c', name, 'remote:gmaps2-payload/output/latest.apk', final]);
  // keystore baru dari remote disimpan supaya update APK selanjutnya tetap bertanda tangan sama
  if (!fs.existsSync(path.join(cwd, 'gmaps2.keystore'))) {
    capture('gh', ['codespace', 'cp', '-c', name, 'remote:gmaps2-payload/gmaps2.keystore', path.join(cwd, 'gmaps2.keystore')]);
  }
  if (!flags.keep) {
    console.log('[remote] Hentikan codespace (hemat kuota; build berikutnya lebih cepat karena cache tetap ada)');
    gh(['codespace', 'stop', '-c', name]);
  }
  console.log('\n[gmaps2] Selesai: ' + final);
  console.log('Pasang di Termux: termux-open "' + final + '"');
  return final;
}

async function fetchOnly(cwd, flags) {
  const cfg = loadConfig(cwd);
  cfg.remote = Object.assign({ repo: 'jpd002/Play-', machine: 'standardLinux32gb', displayName: 'gmaps2-build' }, cfg.remote);
  const name = findOrCreateCodespace(cfg);
  await waitReady(name);
  await follow(name);
  return fetchApk(cwd, cfg, name, flags);
}

module.exports = { buildRemote, fetchOnly, stage };
