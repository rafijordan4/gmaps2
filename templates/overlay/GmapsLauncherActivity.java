package com.virtualapplications.play;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Pintu masuk app hasil gmaps2: siapkan emulator, siapkan ISO, lalu langsung boot game.
 * mode "bundle"  : ISO ada di dalam APK (disalin sekali ke penyimpanan app)
 * mode "external": pilih ISO sekali lewat file picker, lalu diingat
 */
public class GmapsLauncherActivity extends Activity {

    private static final int REQ_PICK = 0x6D32;
    private TextView status;
    private JSONObject cfg;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        status = new TextView(this);
        status.setTextColor(0xFFFFFFFF);
        status.setTextSize(18);
        status.setGravity(Gravity.CENTER);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);
        root.addView(status, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        try {
            cfg = new JSONObject(readAsset("gmaps2/game.json"));
        } catch (Exception e) {
            say("Config game tidak terbaca: " + e.getMessage());
            return;
        }
        say(cfg.optString("name", "Game"));

        // Sama seperti MainActivity.Startup()
        NativeInterop.setFilesDirPath(getApplicationContext().getFilesDir().getAbsolutePath());
        NativeInterop.setCacheDirPath(getApplicationContext().getCacheDir().getAbsolutePath());
        NativeInterop.setAssetManager(getAssets());
        NativeInterop.setContentResolver(getApplicationContext().getContentResolver());
        EmulatorActivity.RegisterPreferences();
        if (!NativeInterop.isVirtualMachineCreated()) {
            NativeInterop.createVirtualMachine();
        }

        if ("external".equals(cfg.optString("mode"))) {
            SharedPreferences sp = getSharedPreferences("gmaps2", MODE_PRIVATE);
            String saved = sp.getString("isoUri", null);
            if (saved != null) start(saved); else pick();
        } else {
            prepareBundled();
        }
    }

    private void say(final String s) {
        runOnUiThread(() -> status.setText(s));
    }

    private String readAsset(String name) throws Exception {
        try (InputStream in = getAssets().open(name)) {
            java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            return o.toString("UTF-8");
        }
    }

    // ---- mode bundle ----
    private void prepareBundled() {
        final String asset = cfg.optString("assetName", "game.iso");
        final long total = cfg.optLong("isoSize", 0);
        new Thread(() -> {
            try {
                File dir = new File(getFilesDir(), "game");
                dir.mkdirs();
                File dst = new File(dir, asset);
                if (!dst.exists() || (total > 0 && dst.length() != total)) {
                    File part = new File(dir, asset + ".part");
                    long done = 0, lastShown = -1;
                    try (InputStream in = getAssets().open("gmaps2/" + asset);
                         OutputStream out = new FileOutputStream(part)) {
                        byte[] buf = new byte[1 << 20];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            done += n;
                            long pct = total > 0 ? done * 100 / total : 0;
                            if (pct != lastShown) { lastShown = pct; say("Menyiapkan game (pertama kali)... " + pct + "%"); }
                        }
                    }
                    if (!part.renameTo(dst)) throw new Exception("Gagal menyimpan ISO");
                }
                final String path = dst.getAbsolutePath();
                runOnUiThread(() -> start(path));
            } catch (Exception e) {
                say("Gagal menyiapkan game: " + e.getMessage());
            }
        }).start();
    }

    // ---- mode external ----
    private void pick() {
        say("Pilih file ISO game");
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i, REQ_PICK);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_PICK) return;
        if (res != RESULT_OK || data == null || data.getData() == null) { finish(); return; }
        Uri uri = data.getData();
        try {
            getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) { }
        getSharedPreferences("gmaps2", MODE_PRIVATE).edit().putString("isoUri", uri.toString()).apply();
        start(uri.toString());
    }

    private void start(String path) {
        try {
            VirtualMachineManager.launchGame(this, path, this::finish);
        } catch (Exception e) {
            getSharedPreferences("gmaps2", MODE_PRIVATE).edit().remove("isoUri").apply();
            say("Gagal boot: " + e.getMessage());
        }
    }
}
