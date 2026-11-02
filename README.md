# gmaps2 (versi Codespaces)

ISO game PS2 -> APK dengan kontrol ala PS. Emulator: [Play!](https://github.com/jpd002/Play-) (tanpa BIOS).

## Pakai

1. Taruh semua isi folder ini di root repo GitHub lo, buka **Code -> Codespaces -> Create codespace**
   (`.devcontainer` otomatis minta mesin 4-core, 64GB).
2. **Drag file ISO** ke folder `iso/` di panel file kiri.
3. (Opsional) taruh `icon.png` (persegi) di `assets/`, ganti nama game di `gmaps2.json`.
4. Terminal:
   ```bash
   npm run doctor
   npm run build
   ```
5. Hasil: `output/<nama>.apk` -> klik kanan -> Download.

Build pertama lama (pasang SDK/NDK, clone Play!, kompilasi C++). Build berikutnya jauh lebih cepat.

## Mode ISO

- `bundle`: ISO ikut di APK (otomatis kalau <= 1.5 GB), disalin sekali saat pertama dibuka
- `external`: pilih ISO sekali lewat file picker (otomatis kalau lebih besar)

Paksa: `npm run build -- --mode external`

## Cara kerja

Patch Play!: `VirtualPadView` diganti `PsControlsView` (input lewat `InputManager`), tambah `GmapsLauncherActivity` (langsung boot game), ganti nama/applicationId/icon, ABI hanya `arm64-v8a`, lalu `assembleRelease` dengan keystore sendiri (`gmaps2.keystore`, tidak masuk git).

## Catatan

- ISO, output, dan keystore ada di `.gitignore`, jangan di-commit.
- Tombol PS di overlay membuka menu emulator (simpan state, pengaturan, keluar).
- Cek lisensi Play! kalau APK mau dibagikan.
