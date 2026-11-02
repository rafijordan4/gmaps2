# gmaps2

ISO game PS2 -> APK dengan kontrol ala PS. Emulator: [Play!](https://github.com/jpd002/Play-) (open source, **tanpa BIOS**).

## Di Termux (build lewat GitHub Codespaces, tanpa bikin repo)

```bash
pkg install nodejs git gh openssh
gh auth login                      # login GitHub (akses codespace)

# pasang tool (dari folder gmaps2 ini)
npm install -g .

mkdir mygame && cd mygame
gmaps2 init                        # taruh ISO di iso/ , icon.png opsional di assets/
gmaps2 doctor
gmaps2 build                       # otomatis jarak jauh karena Termux = ARM
termux-open output/*.apk           # pasang
```

`gmaps2 build` di Termux: bikin/pakai codespace dari repo Play! (public), upload ISO, build di sana, download APK, lalu stop codespace. Build berikutnya memakai codespace yang sama (cache Gradle tetap ada).
Kalau koneksi putus saat build, build di codespace tetap jalan: `gmaps2 fetch`.

## Di Codespaces / Linux x86_64 (build lokal)

```bash
sudo apt-get install -y unzip curl      # biasanya sudah ada
npm install -g .
gmaps2 init && gmaps2 build             # SDK/NDK dipasang otomatis
```

## Cara kerja

1. Scan `iso/`, pilih ISO terbesar
2. Clone Play! (+ submodule), pasang SDK/NDK/CMake yang dibutuhkan
3. Patch: ganti `VirtualPadView` bawaan dengan `PsControlsView` (input lewat `InputManager`), tambah `GmapsLauncherActivity` (langsung boot game), ganti nama app/applicationId/icon, ABI hanya `arm64-v8a`
4. `gradlew assembleRelease` dengan keystore sendiri (`gmaps2.keystore`, disimpan supaya update APK tetap bisa menimpa)
5. Hasil: `output/<nama>.apk`

## Mode ISO

- `bundle`: ISO ikut di APK (otomatis kalau <= 1.5 GB), disalin sekali saat pertama dibuka
- `external`: APK jadi launcher, pilih ISO sekali lewat file picker (otomatis kalau lebih besar)

Paksa: `gmaps2 build --mode external`

## gmaps2.json

`name`, `packageId`, `mode`, `abis`, `controls.opacity/haptics`, `remote.repo/machine/displayName`, `emulator.repo/ref/dir`.

## Catatan

- Belum diuji build penuh di Codespace; yang sudah diuji: sintaks, `init`/`doctor`, dan patch terhadap source Play! asli.
- Kuota Codespaces gratis terbatas (cek github.com/settings/billing); mesin 4-core memakai kuota 4x lebih cepat dari 2-core.
- Tombol PS di overlay membuka menu emulator (simpan state, pengaturan, keluar).
- Cek lisensi Play! kalau APK mau dibagikan.
