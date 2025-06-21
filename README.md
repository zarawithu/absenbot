# AbsensiBot WhatsApp v1.2 EXTENDED

![AbsensiBot Logo](https://via.placeholder.com/400x200.png?text=AbsensiBot+Logo) 
*(Ganti placeholder ini dengan logo bot Anda jika ada)*

AbsensiBot adalah bot WhatsApp multifungsi yang dirancang khusus untuk manajemen absensi siswa/guru, dilengkapi dengan berbagai fitur utilitas dan manajemen grup. Bot ini dibangun menggunakan Baileys (Library WhatsApp Web terbaru) dan Node.js, menjadikannya cepat, efisien, dan mudah dikembangkan.

## Fitur Utama

### Manajemen Absensi
* **Absensi via QR Code:** Siswa/guru dapat melakukan absensi dengan mengirimkan gambar QR Code yang berisi data Nama|Kelas|Nomor.
* **Rekap Absensi Web UI:** Melihat rekap absensi secara rapi melalui antarmuka web yang dapat diakses dari browser.
* **`listsiswa`**: Menampilkan daftar siswa yang terdaftar.
* **`listguru`**: Menampilkan daftar guru yang terdaftar.
* **`listabsen`**: Menampilkan 10 absensi terakhir.
* **`today` / `hariini`**: Melihat daftar absensi yang tercatat untuk hari ini.
* **`cek <nama>`**: Memeriksa pendaftaran siswa tertentu.
* **`stat hariini` / `stat <kelas>`**: Melihat statistik absensi berdasarkan hari ini atau per kelas.

### Manajemen Pengguna & Peran
* **`addadmin` / `deladmin`**: Menambahkan/menghapus admin bot.
* **`addowner` / `delowner`**: Menambahkan/menghapus owner bot (akses tertinggi).
* **`addsiswa` / `delsiswa`**: Menambahkan/menghapus data siswa.
* **`addguru` / `delguru`**: Menambahkan/menghapus data guru.
* **`addprem` / `delprem`**: Memberikan/menghapus akses premium pengguna.

### Fitur Grup
* **`kick` / `kickall`**: Mengeluarkan anggota grup (admin/owner).
* **`hidetag` / `h`**: Mengirim pesan tersembunyi dengan mention semua anggota.
* **`tagall`**: Menandai semua anggota grup dengan pesan.
* **`setnamegc` / `setdesc`**: Mengubah nama/deskripsi grup.
* **`opengc` / `buka` & `closegc` / `tutup`**: Mengatur status grup (terbuka/tertutup).
* **`antilink-on` / `antilink-off`**: Mengaktifkan/menonaktifkan fitur anti-link grup dengan opsi `kick` atau `yapping` (hapus pesan).
* **`addsewa` / `delsewa`**: Mengelola masa sewa bot untuk grup (fitur owner).
* **`text-welcome` / `text-left`**: Mengatur pesan selamat datang/keluar grup.

### Utilitas Umum
* **`menu`**: Menampilkan daftar menu utama bot.
* **`ownermenu` / `adminmenu` / `gurumenu` / `siswamenu`**: Menampilkan menu perintah sesuai peran.
* **`info`**: Menampilkan informasi dan statistik bot.
* **`sticker`**: Membuat stiker dari gambar yang dikirim atau dibalas.
* **`ping`**: Menguji respons bot.
* **`speedtest`**: Mengukur kecepatan internet server bot.
* **`whois <domain>`**: Mencari informasi domain.
* **`shortlink <url>`**: Mempersingkat URL.
* **`cuaca <kota>`**: Mengecek kondisi cuaca.
* **`translate <kalimat> ke <bahasa>`**: Menerjemahkan teks.
* **`kalori <makanan>`**: Mengecek kalori makanan.
* **`cekbmi <berat> <tinggi>`**: Menghitung BMI.
* **`hitungkata <teks>`**: Menghitung jumlah kata.
* **`konversimatauang <jumlah> <mata_uang_asal> ke <mata_uang_tujuan>`**: Konversi mata uang.
* **`encoded` / `decoded`**: Encode/Decode teks ke Base64.
* **`text2pdf` / `txtpdf`**: Mengubah teks menjadi file PDF.
* **`totalfeature`**: Menampilkan total perintah dalam bot.
* **`worldtime`**: Menampilkan waktu di berbagai kota.
* **`clearsesi`**: Membersihkan file sesi WhatsApp bot (membutuhkan restart/scan QR).
* **`backup`**: Membuat dan mengirim file backup proyek.
* **`setbotname` / `setbotbio`**: Mengubah nama dan bio profil bot.
* **`addlist` / `dell-list` / `getlist`**: Mengelola daftar teks/konten tersimpan.
* **`cekidgc`**: Menampilkan ID dan info grup bot yang diikuti bot.

## Instalasi

### Prasyarat
* [Node.js](https://nodejs.org/en/) (versi 18.x atau lebih baru disarankan)
* [npm](https://www.npmjs.com/) (biasanya terinstal bersama Node.js)
* Python 3 (untuk fitur `speedtest.py`)
* Jika di Linux (VPS):
    ```bash
    sudo apt-get update
    sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
    ```
    Atau setara untuk distribusi lain (misal `yum` untuk CentOS/RHEL).

### Langkah-langkah
1.  **Clone repositori ini:**
    ```bash
    git clone [https://github.com/alfrdvinn/AbsensiBot.git](https://github.com/alfrdvinn/AbsensiBot.git) # Ganti dengan URL repositori Anda
    cd AbsensiBot
    ```
2.  **Instal dependensi NPM:**
    ```bash
    npm install
    ```
3.  **Konfigurasi API Keys (Penting!):**
    Buka file `index.js`. Cari baris-baris `const API_KEY_...` dan ganti `YOUR_API_KEY` dengan API Key Anda yang sebenarnya dari penyedia layanan masing-masing. Tanpa ini, beberapa fitur tidak akan berfungsi.
    * `API_KEY_WEATHER`: Dapatkan dari [WeatherAPI](https://www.weatherapi.com/)
    * `API_KEY_SPOONACULAR`: Dapatkan dari [Spoonacular Food API](https://spoonacular.com/food-api)
    * `API_KEY_MYMEMORY`: Dapatkan dari [MyMemory Translated](https://mymemory.translated.net/doc/spec.php)
4.  **Konfigurasi Nomor Owner:**
    Buka `index.js`, cari `const globalOwnerNumber = "6285747334379";`. Ganti nomor tersebut dengan nomor WhatsApp Anda (tanpa `+` atau `0` di depan).
5.  **Jalankan bot:**
    ```bash
    npm start
    ```
    Setelah menjalankan perintah ini, Anda akan melihat QR Code di terminal. Scan QR Code tersebut menggunakan WhatsApp di ponsel Anda (Pengaturan > Perangkat tertaut > Tautkan perangkat).

## Penggunaan

Setelah bot terhubung (ditandai dengan `✅ WhatsApp siap digunakan!`), Anda bisa mulai mengirim perintah via WhatsApp.

* Kirim `.menu` untuk melihat daftar perintah utama.
* Kirim `.ownermenu`, `.adminmenu`, `.gurumenu`, atau `.siswamenu` untuk melihat perintah spesifik sesuai peran.

**Contoh Penggunaan Absensi:**
1.  Buat QR Code yang berisi teks: `NamaSiswa|KelasSiswa|NomorWhatsAppSiswa` (misal: `Budi|9A|628123456789`).
2.  Kirim gambar QR Code tersebut ke bot di WhatsApp dengan caption: `.absen`.
3.  Bot akan mencatat absensi jika siswa terdaftar.

## Struktur Proyek
