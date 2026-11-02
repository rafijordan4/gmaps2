'use strict';
const fs = require('fs');
const path = require('path');
const { copyDir, linkOrCopy } = require('./util');

const JAVA_DIR = 'Source/ui_android/java/com/virtualapplications/play';

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}
function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
function edit(file, fn) {
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  must(after !== before, `Patch tidak mengubah apa pun: ${file} (struktur Play! mungkin berubah)`);
  fs.writeFileSync(file, after);
}

/**
 * Terapkan semua modifikasi gmaps2 ke checkout Play!.
 * ctx: { iso, mode, assetName, projectDir }
 */
function patch(emu, cfg, ctx) {
  const droid = path.join(emu, 'build_android');
  must(fs.existsSync(path.join(droid, 'build.gradle')), `build_android/build.gradle tidak ada di ${emu}. Cek emulator.repo / emulator.ref`);

  // 0. Kembalikan file yang pernah dipatch supaya patch ini idempoten
  const git = require('./util').capture('git', ['-C', emu, 'checkout', '--', 'build_android', 'Source/ui_android/java']);
  if (git.code !== 0) console.log('[patch] peringatan: git checkout gagal, lanjut: ' + git.err);

  // 1. Java: overlay kontrol PS + launcher (package sama dengan Play!)
  copyDir(path.join(__dirname, '..', 'templates', 'overlay'), path.join(emu, JAVA_DIR));

  // 2. Ganti VirtualPadView bawaan dengan PsControlsView
  edit(path.join(droid, 'src/main/res/layout/emulator.xml'), (s) =>
    s.replace(/com\.virtualapplications\.play\.VirtualPadView/g, 'com.virtualapplications.play.PsControlsView')
  );

  // 3. Manifest: launcher baru, nama app
  edit(path.join(droid, 'src/main/AndroidManifest.xml'), (s) => {
    const noLauncher = s.replace(
      /\s*<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"\s*\/>[\s\S]*?<\/intent-filter>/,
      ''
    );
    must(noLauncher !== s, 'Intent-filter MAIN tidak ketemu di AndroidManifest.xml');
    const label = xmlEsc(cfg.name);
    const act =
      '\t\t<activity\n' +
      '\t\t\tandroid:name=".GmapsLauncherActivity"\n' +
      '\t\t\tandroid:exported="true"\n' +
      '\t\t\tandroid:screenOrientation="sensorLandscape"\n' +
      '\t\t\tandroid:theme="@android:style/Theme.NoTitleBar.Fullscreen"\n' +
      `\t\t\tandroid:label="${label}">\n` +
      '\t\t\t<intent-filter>\n' +
      '\t\t\t\t<action android:name="android.intent.action.MAIN" />\n' +
      '\t\t\t\t<category android:name="android.intent.category.LAUNCHER" />\n' +
      '\t\t\t\t<category android:name="android.intent.category.LEANBACK_LAUNCHER" />\n' +
      '\t\t\t</intent-filter>\n' +
      '\t\t</activity>\n';
    const withAct = noLauncher.replace(/(\s*)<activity\s+android:name="\.EmulatorActivity"/, (m, ws) => '\n' + act + ws + m.trimStart());
    must(withAct !== noLauncher, 'EmulatorActivity tidak ketemu di AndroidManifest.xml');
    return withAct.replace(/android:label="@string\/app_name"/g, `android:label="${label}"`);
  });

  // 4. build.gradle: ABI, applicationId, aset tidak dikompres
  const ext = path.extname(ctx.assetName || ctx.iso.name).replace('.', '') || 'iso';
  edit(path.join(droid, 'build.gradle'), (s) => {
    let o = s.replace(/abiFilters\s+[^\n]+/, 'abiFilters ' + cfg.abis.map((a) => `'${a}'`).join(', '));
    o = o.replace(/minSdkVersion\s+\d+/, (m) => `applicationId '${cfg.packageId}'\n\t\t${m}`);
    o = o.replace(/^android\s*\{/m, (m) => `${m}\n\tandroidResources {\n\t\tnoCompress += ['${ext}', 'json']\n\t}`);
    return o;
  });

  // 5. Gradle: memori + tanpa daemon (aman untuk Codespaces)
  const gp = path.join(droid, 'gradle.properties');
  let props = fs.readFileSync(gp, 'utf8');
  if (!/org\.gradle\.jvmargs/.test(props)) {
    props = props.replace(/\s*$/, '\n') + 'org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8\norg.gradle.daemon=false\n';
    fs.writeFileSync(gp, props);
  }

  // 6. Icon (opsional)
  const icon = path.join(ctx.projectDir, 'assets', 'icon.png');
  if (fs.existsSync(icon)) {
    let n = 0;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/^ic_launcher\.png$/.test(e.name)) { fs.copyFileSync(icon, p); n++; }
      }
    })(path.join(droid, 'src/main/res'));
    console.log(`[patch] icon diganti di ${n} lokasi`);
  }

  // 7. Aset game: config (+ ISO kalau mode bundle)
  const assets = path.join(droid, 'src/main/assets/gmaps2');
  fs.rmSync(assets, { recursive: true, force: true });
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(
    path.join(assets, 'game.json'),
    JSON.stringify(
      {
        name: cfg.name,
        mode: ctx.mode,
        assetName: ctx.mode === 'bundle' ? ctx.assetName : null,
        isoSize: ctx.iso.size,
        controls: cfg.controls,
        packageId: cfg.packageId
      },
      null,
      2
    )
  );
  if (ctx.mode === 'bundle') linkOrCopy(ctx.iso.path, path.join(assets, ctx.assetName));

  return droid;
}

module.exports = { patch };
