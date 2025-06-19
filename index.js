// === index.js v1.2 EXTENDED by @alfrdvinn ===
// ✅ Semua fitur stabil, ditambah ownermenu, adminmenu, gurumenu, dan lainnya

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const P = require('pino')
const qrcodeTerminal = require('qrcode-terminal')
const Jimp = require('jimp') // Untuk pemrosesan gambar, termasuk QR
const QrCode = require('qrcode-reader') // Untuk membaca QR Code
const { Sticker } = require('wa-sticker-formatter'); // Untuk membuat stiker: npm install wa-sticker-formatter

// --- Dependensi baru dari system.js ---
const axios = require('axios'); // Untuk HTTP requests
const cheerio = require('cheerio'); // Untuk web scraping
const moment = require('moment-timezone'); // Untuk waktu global
const { exec, execSync } = require('child_process'); // Untuk menjalankan perintah sistem (speedtest, backup)
const PDFDocument = require('pdfkit'); // Untuk text2pdf
const FormData = require('form-data'); // Untuk request multipart/form-data
// const { Client } = require('ssh2'); // Tidak diaktifkan secara default karena kompleksitas

// --- Variabel Global/Konstanta ---
// Ini adalah pengganti variabel global dari system.js, sesuaikan jika perlu
const botname = "davinBot"; // Nama bot Anda
const pengembang = "@alfrdvinn"; // Nama pengembang
const host = "https://panel.example.com"; // Ganti dengan link panel Pterodactyl Anda jika menggunakan fitur panel
const host2 = "https://panel2.example.com"; // Link panel kedua
const globalOwnerNumber = "6285747334379"; // Nomor owner utama
const mess = {
    wait: '⏳ Mohon tunggu sebentar...',
    owner: '🚫 Perintah ini hanya untuk Owner bot.',
    admin: '🚫 Perintah ini hanya untuk Admin grup.',
    group: '🚫 Perintah ini hanya bisa digunakan di dalam grup.',
    botadmin: '🚫 Bot harus menjadi Admin grup untuk menggunakan perintah ini.',
    premium: '🌟 Fitur ini khusus pengguna Premium.',
    success: '✅ Berhasil!',
    error: '❌ Terjadi kesalahan.',
    // Tambahkan pesan lain jika diperlukan
};
const API_KEY_WEATHER = 'YOUR_WEATHER_API_KEY'; // Ganti dengan API Key WeatherAPI Anda
const API_KEY_SPOONACULAR = 'YOUR_SPOONACULAR_API_KEY'; // Ganti dengan API Key Spoonacular Anda
const API_KEY_MYMEMORY = 'YOUR_MYMEMORY_API_KEY'; // Ganti dengan API Key MyMemory.translated.net Anda

// --- Path Database ---
const app = express()
const PORT = 3111
app.use(express.static('public'))

const DB = './database/absensi.json'
const ADMIN = './database/admin.json'
const OWNER = './database/owner.json'
const SISWA = './database/siswa.json'
const GURU = './database/guru.json'
const CONFIG = './config.json'
const USERS = './database/users.json' // Database baru untuk user-specific data (limit, premium)
const SEWA = './database/sewa.json' // Database untuk data sewa grup
const ANTILINK = './database/antilink.json' // Database untuk konfigurasi antilink
const STORELIST = './database/store-list.json' // Database untuk storelist

if (!fs.existsSync('./database')) fs.mkdirSync('./database')

// Fungsi untuk membaca dan memastikan file JSON adalah array/objek valid
const readJsonFile = (filePath, defaultContent) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(data);
        if (Array.isArray(defaultContent) && !Array.isArray(parsedData)) {
            console.warn(`[Warning] ${filePath} expected an array but parsed data is not. Resetting to default.`);
            fs.writeFileSync(filePath, JSON.stringify(defaultContent));
            return defaultContent;
        }
        if (typeof defaultContent === 'object' && !Array.isArray(defaultContent) && typeof parsedData !== 'object') {
             console.warn(`[Warning] ${filePath} expected an object but parsed data is not. Resetting to default.`);
            fs.writeFileSync(filePath, JSON.stringify(defaultContent));
            return defaultContent;
        }
        return parsedData;
    } catch (e) {
        console.error(`[Error] Failed to read or parse ${filePath}:`, e.message);
        fs.writeFileSync(filePath, JSON.stringify(defaultContent));
        return defaultContent;
    }
};

// Inisialisasi file-file database
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '[]')
if (!fs.existsSync(ADMIN)) fs.writeFileSync(ADMIN, '[]')

let currentOwners = readJsonFile(OWNER, []);
if (currentOwners.length === 0) {
    fs.writeFileSync(OWNER, JSON.stringify([globalOwnerNumber])); // Owner default dari variabel global
}

if (!fs.existsSync(SISWA)) fs.writeFileSync(SISWA, '[]')
if (!fs.existsSync(GURU)) fs.writeFileSync(GURU, '[]')
if (!fs.existsSync(CONFIG)) fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'public' }))
if (!fs.existsSync(USERS)) fs.writeFileSync(USERS, '{}') // Inisialisasi USERS sebagai objek kosong
if (!fs.existsSync(SEWA)) fs.writeFileSync(SEWA, '{}') // Inisialisasi SEWA sebagai objek kosong
if (!fs.existsSync(ANTILINK)) fs.writeFileSync(ANTILINK, '{}') // Inisialisasi ANTILINK sebagai objek kosong
if (!fs.existsSync(STORELIST)) fs.writeFileSync(STORELIST, '{}') // Inisialisasi STORELIST sebagai objek kosong

// Fungsi utilitas untuk membaca konfigurasi dan daftar pengguna
const getMode = () => readJsonFile(CONFIG, { mode: 'public' }).mode
const isAdminOrOwner = n => readJsonFile(ADMIN, []).includes(n) || readJsonFile(OWNER, []).includes(n)
const isOwner = n => readJsonFile(OWNER, []).includes(n)

// --- Fungsi untuk format ukuran file (dari system.js) ---
const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Fungsi untuk random password (dari system.js) ---
function generateRandomPassword() {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 10; // Cukup panjang untuk password panel
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters[randomIndex];
  }
  return password;
}

// --- Fungsi untuk manajemen user database (limit, premium) ---
const ensureUserExists = (userJid) => {
    let usersDb = readJsonFile(USERS, {});
    if (!usersDb[userJid]) {
        usersDb[userJid] = {
            premium: false,
            limit: 20, // Limit default
            lastclaim: 0,
            exp: 0 // Tambah EXP juga
        };
        fs.writeFileSync(USERS, JSON.stringify(usersDb, null, 2));
    }
    return usersDb[userJid];
};

app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))
app.get('/generate', (_, res) => res.sendFile(path.join(__dirname, 'public', 'generate.html')))
app.get('/absensi', (req, res) => {
  let db = readJsonFile(DB, [])
  const kelas = req.query.kelas?.toLowerCase()
  const tanggal = req.query.tanggal
  if (kelas) db = db.filter(d => d.kelas.toLowerCase() === kelas)
  if (tanggal) db = db.filter(d => d.waktu.startsWith(tanggal))
  const rows = db.reverse().map(d => `<tr><td>${d.nama}</td><td>${d.kelas}</td><td>${d.waktu}</td><td>${d.sender}</td></tr>`).join('')
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"><link rel="stylesheet" href="/style.css"><title>Rekap Absensi</title></head><body><main><h2>📋 Rekap Absensi</h2><form><input name="kelas" placeholder="Kelas"/><input type="date" name="tanggal"/><button>🔍 Filter</button></form><table><thead><tr><th>Nama</th><th>Kelas</th><th>Waktu</th><th>Pengirim</th></tr></thead><tbody>${rows}</tbody></table><button class="toggle-mode" onclick="toggleTheme()">🌗 Ganti Mode</button><footer>© 2025 Developer @alfrdvinn</footer><script>function toggleTheme(){const html=document.documentElement;const next=html.getAttribute("data-theme")==="dark"?"light":"dark";html.setAttribute("data-theme",next);localStorage.setItem("theme",next);}document.addEventListener("DOMContentLoaded",()=>{const saved=localStorage.getItem("theme")||"light";document.documentElement.setAttribute("data-theme",saved)});</script></main></body></html>`)
})

let isConnecting = false
async function startSocket() {
  if (isConnecting) return
  isConnecting = true
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ auth: state, version, logger: P({ level: 'silent' }) })

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) qrcodeTerminal.generate(qr, { small: true })
      if (connection === 'open') console.log('✅ WhatsApp siap digunakan!')
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        if (statusCode === DisconnectReason.loggedOut) isConnecting = false
        else setTimeout(() => { isConnecting = false; startSocket() }, 3000)
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return
      const sender = m.key.remoteJid
      const from = (m.key.participant || sender).replace(/@s\.whatsapp\.net/, '')
      const type = Object.keys(m.message)[0]
      
      const commandBody = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '';

      const send = t => sock.sendMessage(sender, { text: t })
      if (getMode() === 'self' && !isOwner(from)) return

      // Pastikan data user ada di database USERS
      ensureUserExists(from);
      let usersDb = readJsonFile(USERS, {});
      let user = usersDb[from];
      const isPremium = user.premium;
      const userLimit = user.limit;

      // --- Fungsi untuk mendapatkan salam personal dan info user ---
      const getPersonalizedGreeting = (userNumber) => {
          const now = new Date();
          const hour = now.getHours();
          let timeOfDay;

          if (hour >= 5 && hour < 12) {
              timeOfDay = "pagi";
          } else if (hour >= 12 && hour < 15) {
              timeOfDay = "siang";
          } else if (hour >= 15 && hour < 18) {
              timeOfDay = "sore";
          } else {
              timeOfDay = "malam";
          }

          let greetingName = userNumber; // Default: nomor telepon
          let userRoleText = "Pengguna tidak terdaftar";
          let additionalInfo = ""; // Kelas atau mapel

          const owners = readJsonFile(OWNER, []);
          const admins = readJsonFile(ADMIN, []);
          const gurus = readJsonFile(GURU, []);
          const siswas = readJsonFile(SISWA, []);

          if (owners.includes(userNumber)) {
              greetingName = "Anda"; // Owner biasanya tidak perlu nama spesifik dari DB
              userRoleText = "Owner";
          } else if (admins.includes(userNumber)) {
              greetingName = "Anda"; // Admin biasanya tidak perlu nama spesifik dari DB
              userRoleText = "Admin";
          } else {
              // Cari di daftar Guru berdasarkan nomor
              const foundGuru = gurus.find(g => g.nomor === userNumber);
              if (foundGuru) {
                  greetingName = foundGuru.nama;
                  userRoleText = "Guru";
                  additionalInfo = ` (Mapel: ${foundGuru.mapel})`;
              } else {
                  // Cari di daftar Siswa berdasarkan nomor
                  const foundSiswa = siswas.find(s => s.nomor === userNumber);
                  if (foundSiswa) {
                      greetingName = foundSiswa.nama;
                      userRoleText = "Siswa";
                      additionalInfo = ` (Kelas: ${foundSiswa.kelas})`;
                  }
              }
          }

          return `Halo selamat ${timeOfDay}, ${greetingName}! Anda masuk sebagai ${userRoleText}${additionalInfo}.`;
      };
      // --- AKHIR Fungsi getPersonalizedGreeting ---

      // --- COMMANDS ---

      // Keterangan: Menu utama bot, dapat diakses semua pengguna.
      if (commandBody === '.menu') {
        const greeting = getPersonalizedGreeting(from);
        return send(`${greeting}
        
📖 *MENU ABSENSI BOT v1.2 EXTENDED*

_Pilih salah satu menu di bawah ini untuk melihat daftar perintah yang tersedia. Ketik perintah yang diinginkan._

• *.ownermenu* - Menu khusus Owner bot.
• *.adminmenu* - Menu khusus Admin bot.
• *.gurumenu* - Menu khusus Guru.
• *.siswamenu* - Menu khusus Siswa.
• *.info* - Informasi dan statistik bot.
• *.sticker* - Buat stiker dari gambar.
• *.fiturlain* - Fitur-fitur lain bot ini.`) // Tambahkan menu fitur lain
      }

      // Keterangan: Menu khusus owner bot, untuk manajemen tingkat tinggi.
      if (commandBody === '.ownermenu') return send(`👑 *Owner Menu:*
_Perintah ini hanya dapat diakses oleh Owner bot. Digunakan untuk manajemen sistem dan hak akses._
• *.addadmin <nomor>* - Menambahkan nomor ke daftar admin.
• *.deladmin <nomor>* - Menghapus nomor dari daftar admin.
• *.addowner <nomor>* - Menambahkan nomor ke daftar owner (gunakan dengan hati-hati!).
• *.delowner <nomor>* - Menghapus nomor dari daftar owner (gunakan dengan sangat hati-hati!).
• *.broadcast <pesan>* - Mengirim pesan ke semua grup yang diikuti bot.
• *.self / .public* - Mengubah mode bot (Self: hanya owner; Public: semua pengguna terdaftar).
• *.owner* - Menampilkan daftar kontak owner bot.
• *.clearsesi* - Membersihkan file sesi WhatsApp bot.
• *.backup* - Membuat dan mengirim backup file proyek.
• *.addprem <nomor>* - Menambah akses premium pengguna.
• *.delprem <nomor>* - Menghapus akses premium pengguna.
• *.setbotname <nama>* - Mengubah nama profil bot.
• *.setbotbio <teks>* - Mengubah bio profil bot.
• *.addsewa <ID_grup|hari>* - Mengelola sewa bot untuk grup.
• *.delsewa <ID_grup>* - Menghapus sewa bot untuk grup.
• *.text-welcome <teks>* - Mengatur teks pesan welcome grup.
• *.text-left <teks>* - Mengatur teks pesan left grup.
• *.addlist <nama|konten>* - Mengelola daftar teks/konten tersimpan.
• *.dell-list <nama>* - Menghapus daftar tersimpan.
• *.getlist* - Menampilkan semua daftar tersimpan.
• *.cekidgc* - Menampilkan ID dan info grup bot.`)


      // Keterangan: Menu khusus admin, untuk manajemen data siswa dan guru.
      if (commandBody === '.adminmenu') {
        return send(`🛠 *Admin Menu:*
_Perintah ini dapat diakses oleh Admin dan dan Owner. Digunakan untuk mengelola data siswa dan guru, serta manajemen grup._
• *.addsiswa <Nama|Kelas|Nomor>* - Menambahkan data siswa baru (contoh: *.addsiswa Budi|9A|628123456789*).
• *.delsiswa <NamaSiswa>* - Menghapus siswa dari database (contoh: *.delsiswa Budi*).
• *.addguru <Nama|Mapel|Nomor>* - Menambahkan data guru baru (contoh: *.addguru PakJoko|Matematika|6285711223344*).
• *.delguru <NamaGuru>* - Menghapus guru dari database (contoh: *.delguru PakJoko*).
• *.listsiswa* - Menampilkan daftar siswa yang terdaftar.
• *.listguru* - Menampilkan daftar guru yang terdaftar.
• *.listabsen* - Menampilkan 10 absensi terakhir.
• *.kick <mention/balas>* - Mengeluarkan anggota grup.
• *.kickall* - Mengeluarkan semua anggota grup.
• *.hidetag / .h* - Mengirim pesan tersembunyi dengan tag semua anggota.
• *.tagall* - Menandai semua anggota grup dengan pesan.
• *.setnamegc <nama>* - Mengubah nama grup.
• *.setdesc <teks>* - Mengubah deskripsi grup.
• *.opengc / .buka* - Membuka grup.
• *.closegc / .tutup* - Menutup grup.
• *.antilink-on <kick/yapping>* - Mengaktifkan anti-link grup.
• *.antilink-off* - Menonaktifkan anti-link grup.`)
      }

      // Keterangan: Menu khusus guru, untuk melihat data siswa dan absensi.
      if (commandBody === '.gurumenu') return send(`📚 *Guru Menu:*
_Perintah ini dapat diakses oleh Guru, Admin, dan Owner. Digunakan untuk melihat data siswa dan rekap absensi._
• *.listsiswa* - Melihat daftar siswa yang terdaftar.
• *.listabsen* - Melihat 10 absensi terakhir yang tercatat.
• *.today / .hariini* - Melihat daftar absensi yang tercatat untuk hari ini.
• *.cek <nama>* - Memeriksa pendaftaran siswa tertentu (contoh: *.cek Budi*).
• *.stat hariini / .stat <kelas>* - Melihat statistik absensi (contoh: *.stat hariini* atau *.stat 9A*).`)

      // Keterangan: Menampilkan informasi umum tentang bot.
      if (commandBody === '.info') {
        const admin = readJsonFile(ADMIN, [])
        const siswa = readJsonFile(SISWA, [])
        const guru = readJsonFile(GURU, [])
        const absen = readJsonFile(DB, [])
        let usersDb = readJsonFile(USERS, {});
        const totalUsers = Object.keys(usersDb).length;
        const totalMem = process.memoryUsage().heapUsed; // Menggunakan process.memoryUsage() untuk RAM yang digunakan Node.js
        const formattedTotalMem = formatSize(totalMem);
        // Runtime
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / (3600 * 24));
        const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        const runtime = `${days}h ${hours}j ${minutes}m ${seconds}d`;

        return send(`🤖 *Info Bot:*
_Informasi status dan data statistik bot saat ini._
👤 Mode: *${getMode().toUpperCase()}*
👮 Admin: ${admin.length}
👨‍🎓 Siswa: ${siswa.length}
👨‍🏫 Guru: ${guru.length}
📅 Absen Total: ${absen.length}
👥 Total User Bot: ${totalUsers}
⚙️ RAM Terpakai: ${formattedTotalMem}
⏰ Runtime: ${runtime}
`)
      }

      // Keterangan: Menampilkan daftar nomor WhatsApp owner bot.
      if (commandBody === '.owner') {
        let owners = readJsonFile(OWNER, [])
        const list = Array.isArray(owners) && owners.length > 0
          ? owners.map(o => `wa.me/${o}`).join('\n')
          : 'Tidak ada owner terdaftar.'
        return send(`👑 Kontak Owner:\n${list}`)
      }

      // --- Fitur Baru: Manajemen Bot & Akun (dari system.js) ---

      // Membersihkan file sesi WhatsApp bot
      if (commandBody === '.clearsesi' || commandBody === '.delsesi' || commandBody === '.clear' || commandBody === '.cs' || commandBody === '.clearsession') {
          if (!isOwner(from)) return send(mess.owner);
          fs.readdir("./auth", async (err, files) => { // Menggunakan folder 'auth' untuk sesi Baileys
              if (err) {
                  console.error('Failed to scan auth directory:', err);
                  return send('❌ Gagal memindai folder sesi: ' + err.message);
              }
              const filteredFiles = files.filter(file => file !== 'creds.json'); // Jangan hapus creds.json
              let deletedCount = 0;
              for (const file of filteredFiles) {
                  fs.unlinkSync(path.join('./auth', file));
                  deletedCount++;
              }
              if (deletedCount > 0) {
                  send(`✅ Berhasil menghapus ${deletedCount} file sesi sampah. Bot mungkin perlu di-restart atau di-scan ulang QR-nya.`);
              } else {
                  send('❕ Tidak ada file sesi sampah yang ditemukan (selain creds.json).');
              }
          });
          return;
      }

      // Membuat dan mengirim backup file proyek
      if (commandBody === '.backup') {
          if (!isOwner(from)) return send(mess.owner);
          send(mess.wait);
          try {
              const filesToBackup = fs.readdirSync('./').filter(item => 
                  item !== 'node_modules' && item !== 'package-lock.json' && item !== 'auth' && item !== '.git'
              ); // Kecualikan folder besar/sensitif
              const backupFileName = `backup-${Date.now()}.zip`;
              const backupPath = path.join(__dirname, backupFileName);
              
              const archiver = require('archiver'); // npm install archiver
              const output = fs.createWriteStream(backupPath);
              const archive = archiver('zip', { zlib: { level: 9 } });

              output.on('close', async () => {
                  send(`✅ Backup berhasil dibuat. Ukuran: ${formatSize(archive.pointer())}`);
                  await sock.sendMessage(sender, {
                      document: fs.readFileSync(backupPath),
                      mimetype: 'application/zip',
                      fileName: backupFileName,
                      caption: '✅ Backup file proyek Anda.'
                  }, { quoted: m });
                  fs.unlinkSync(backupPath); // Hapus file zip setelah dikirim
              });

              archive.on('error', (err) => { throw err; });
              archive.pipe(output);
              filesToBackup.forEach(file => {
                  if (fs.statSync(file).isDirectory()) {
                      archive.directory(file, file);
                  } else {
                      archive.file(file, { name: file });
                  }
              });
              archive.finalize();
          } catch (e) {
              console.error("[Backup Error]", e);
              send(`❌ Gagal membuat backup: ${e.message}`);
          }
          return;
      }
      
      // Menambah/menghapus akses premium pengguna
      if (commandBody.startsWith('.addprem')) {
        if (!isOwner(from)) return send(mess.owner);
        const targetNumber = commandBody.split(' ')[1]?.replace(/\D/g, '') + '@s.whatsapp.net';
        if (!targetNumber) return send('❌ Format salah!\nGunakan: .addprem 628xxxx');
        
        ensureUserExists(targetNumber);
        let usersDb = readJsonFile(USERS, {});
        usersDb[targetNumber].premium = true;
        fs.writeFileSync(USERS, JSON.stringify(usersDb, null, 2));
        return send(`✅ Pengguna ${targetNumber} sekarang Premium!`);
      }
      if (commandBody.startsWith('.delprem')) {
        if (!isOwner(from)) return send(mess.owner);
        const targetNumber = commandBody.split(' ')[1]?.replace(/\D/g, '') + '@s.whatsapp.net';
        if (!targetNumber) return send('❌ Format salah!\nGunakan: .delprem 628xxxx');

        ensureUserExists(targetNumber);
        let usersDb = readJsonFile(USERS, {});
        usersDb[targetNumber].premium = false;
        fs.writeFileSync(USERS, JSON.stringify(usersDb, null, 2));
        return send(`✅ Pengguna ${targetNumber} tidak lagi Premium.`);
      }

      // Mengubah nama profil bot
      if (commandBody.startsWith('.setbotname')) {
          if (!isOwner(from)) return send(mess.owner);
          const newName = commandBody.split(' ').slice(1).join(' ');
          if (!newName) return send('❌ Format salah!\nGunakan: .setbotname <nama_baru_bot>');
          try {
              await sock.updateProfileName(newName);
              send(`✅ Nama bot berhasil diubah menjadi: *${newName}*`);
          } catch (e) {
              console.error("[SetBotName Error]", e);
              send('❌ Gagal mengubah nama bot. Mungkin terlalu panjang atau ada masalah lain.');
          }
          return;
      }

      // Mengubah bio profil bot
      if (commandBody.startsWith('.setbotbio')) {
          if (!isOwner(from)) return send(mess.owner);
          const newBio = commandBody.split(' ').slice(1).join(' ');
          if (!newBio) return send('❌ Format salah!\nGunakan: .setbotbio <bio_baru_bot>');
          try {
              await sock.updateProfileStatus(newBio);
              send(`✅ Bio bot berhasil diubah menjadi: *${newBio}*`);
          } catch (e) {
              console.error("[SetBotBio Error]", e);
              send('❌ Gagal mengubah bio bot. Mungkin terlalu panjang atau ada masalah lain.');
          }
          return;
      }
      
      // Mengelola sewa bot untuk grup
      if (commandBody.startsWith('.addsewa') || commandBody.startsWith('.delsewa')) {
        if (!isOwner(from)) return send(mess.owner);
        const data = readJsonFile(SEWA, {});
        const parts = commandBody.split(' ')[1]?.split('|'); // Contoh: groupId|days

        if (commandBody.startsWith('.addsewa')) {
            if (!parts || parts.length < 2) return send('❌ Format salah!\nGunakan: .addsewa <ID_grup_atau_link_grup_invite>|<hari>\nContoh: .addsewa 12345@g.us|30 atau .addsewa https://chat.whatsapp.com/INVITELINK|30');
            
            let groupId = parts[0];
            const daysToAdd = parseInt(parts[1]);

            if (groupId.includes('chat.whatsapp.com/')) {
                const inviteMatch = groupId.match(/(?:https?:\/\/chat\.whatsapp\.com\/)?([a-zA-Z0-9]{22})/);
                if (inviteMatch && inviteMatch[1]) {
                    try {
                        const inviteInfo = await sock.groupGetInviteInfo(inviteMatch[1]);
                        groupId = inviteInfo.id;
                    } catch (e) {
                        return send('❌ Link grup tidak valid atau bot tidak bisa mengaksesnya.');
                    }
                } else {
                    return send('❌ Link grup tidak valid.');
                }
            } else if (!groupId.endsWith('@g.us')) {
                return send('❌ ID grup tidak valid. Harus berupa JID (@g.us) atau link invite.');
            }

            if (isNaN(daysToAdd) || daysToAdd <= 0) return send('❌ Jumlah hari tidak valid. Harus angka positif.');

            const expirationTime = Date.now() + (daysToAdd * 24 * 60 * 60 * 1000);
            data[groupId] = {
                active: true,
                expiration: expirationTime,
                days: daysToAdd
            };
            fs.writeFileSync(SEWA, JSON.stringify(data, null, 2));
            send(`✅ Grup ${groupId} berhasil disewa selama ${daysToAdd} hari. Berakhir pada ${new Date(expirationTime).toLocaleString()}.`);
        } else if (commandBody.startsWith('.delsewa')) {
            const targetGroupId = parts[0];
            if (!targetGroupId) return send('❌ Format salah!\nGunakan: .delsewa <ID_grup_atau_link_grup_invite>');

            let groupIdToDelete = targetGroupId;
            if (targetGroupId.includes('chat.whatsapp.com/')) {
                const inviteMatch = targetGroupId.match(/(?:https?:\/\/chat\.whatsapp\.com\/)?([a-zA-Z0-9]{22})/);
                if (inviteMatch && inviteMatch[1]) {
                    try {
                        const inviteInfo = await sock.groupGetInviteInfo(inviteMatch[1]);
                        groupIdToDelete = inviteInfo.id;
                    } catch (e) {
                        return send('❌ Link grup tidak valid atau bot tidak bisa mengaksesnya.');
                    }
                } else {
                    return send('❌ Link grup tidak valid.');
                }
            } else if (!groupIdToDelete.endsWith('@g.us')) {
                return send('❌ ID grup tidak valid. Harus berupa JID (@g.us) atau link invite.');
            }

            if (data[groupIdToDelete]) {
                delete data[groupIdToDelete];
                fs.writeFileSync(SEWA, JSON.stringify(data, null, 2));
                send(`✅ Sewa untuk grup ${groupIdToDelete} berhasil dihapus.`);
            } else {
                send(`❕ Grup ${groupIdToDelete} tidak ditemukan dalam daftar sewa.`);
            }
        }
        return;
      }
      
      // Mengatur teks pesan welcome/left grup
      if (commandBody.startsWith('.text-welcome') || commandBody.startsWith('.text-left')) {
          if (!isOwner(from)) return send(mess.owner);
          const textToSet = commandBody.split(' ').slice(1).join(' ');
          const type = commandBody.split(' ')[0].replace('.', ''); // welcome atau left
          if (!textToSet) return send(`❌ Format salah!\nGunakan: .${type} <teks_pesan>\n*Gunakan #user untuk menandai member, #group untuk nama grup, #total untuk total member.*`);
          
          let dbPath = `./database/${type}.json`;
          let currentText = {};
          try {
              currentText = JSON.parse(fs.readFileSync(dbPath));
          } catch {
              fs.writeFileSync(dbPath, '{}');
          }
          currentText.text = textToSet;
          fs.writeFileSync(dbPath, JSON.stringify(currentText, null, 2));
          send(`✅ Teks ${type} berhasil diperbarui.`);
          return;
      }

      // Mengelola daftar teks/konten tersimpan
      if (commandBody.startsWith('.addlist') || commandBody.startsWith('.dell-list') || commandBody === '.getlist') {
        const storelist = readJsonFile(STORELIST, {});

        if (commandBody.startsWith('.addlist')) {
            const parts = commandBody.split(' ')[1]?.split('|');
            if (!parts || parts.length < 2) return send('❌ Format salah!\nGunakan: .addlist <nama_list>|<konten>\nContoh: .addlist selamat_datang|Halo semua!');
            const [listName, listContent] = parts;
            storelist[listName] = { content: listContent };
            fs.writeFileSync(STORELIST, JSON.stringify(storelist, null, 2));
            send(`✅ List *${listName}* berhasil ditambahkan.`);
        } else if (commandBody.startsWith('.dell-list')) {
            const listName = commandBody.split(' ')[1];
            if (!listName) return send('❌ Format salah!\nGunakan: .dell-list <nama_list>');
            if (storelist[listName]) {
                delete storelist[listName];
                fs.writeFileSync(STORELIST, JSON.stringify(storelist, null, 2));
                send(`✅ List *${listName}* berhasil dihapus.`);
            } else {
                send(`❕ List *${listName}* tidak ditemukan.`);
            }
        } else if (commandBody === '.getlist') {
            const listNames = Object.keys(storelist);
            if (listNames.length === 0) return send('📂 Tidak ada list tersimpan.');
            let msg = '📋 *Daftar List Tersimpan:*\n\n';
            listNames.forEach((name, i) => {
                msg += `${i + 1}. ${name}\n`;
            });
            send(msg);
        }
        return;
      }

      // Menampilkan ID dan info grup yang diikuti bot
      if (commandBody === '.cekidgc') {
        if (!isOwner(from)) return send(mess.owner);
        let allGroups = await sock.groupFetchAllParticipating();
        let groups = Object.values(allGroups); // Konversi objek ke array
        
        if (groups.length === 0) return send('📂 Bot tidak tergabung dalam grup mana pun.');

        let msg = `📋 *Daftar Grup yang Diikuti Bot:*\n\n`;
        groups.forEach((group, i) => {
            msg += `*${i + 1}. Nama Grup:* ${group.subject}\n`;
            msg += `   *ID Grup:* ${group.id}\n`;
            msg += `   *Anggota:* ${group.participants.length}\n\n`;
        });
        send(msg);
        return;
      }

      // --- Fitur Baru: Manajemen Grup (dari system.js) ---

      // Mengeluarkan anggota grup
      if (commandBody.startsWith('.kick')) {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
        if (!botIsAdmin) return send(mess.botadmin);

        let usersToKick = [];
        if (m.quoted) {
            usersToKick.push(m.quoted.sender);
        } else if (m.mentionedJid && m.mentionedJid.length > 0) {
            usersToKick = m.mentionedJid;
        } else if (commandBody.split(' ')[1]) {
            const number = commandBody.split(' ')[1]?.replace(/\D/g, '') + '@s.whatsapp.net';
            if (number && !number.startsWith('@s.whatsapp.net')) usersToKick.push(number);
        }
        
        if (usersToKick.length === 0) return send('❌ Tidak ada pengguna untuk dikeluarkan. Balas pesan atau mention pengguna.');

        for (const user of usersToKick) {
            if (groupMetadata.participants.some(p => p.id === user && p.admin)) {
                send(`❕ Tidak bisa mengeluarkan admin grup.`);
                continue;
            }
            try {
                await sock.groupParticipantsUpdate(m.chat, [user], 'remove');
                send(`✅ Berhasil mengeluarkan @${user.split('@')[0]}.`);
            } catch (e) {
                console.error(`[Kick Error] Failed to kick ${user}:`, e);
                send(`❌ Gagal mengeluarkan @${user.split('@')[0]}.`);
            }
        }
        return;
      }

      // Mengeluarkan semua anggota grup (hanya owner)
      if (commandBody === '.kickall') {
        if (!m.isGroup) return send(mess.group);
        if (!isOwner(from)) return send(mess.owner); // Kickall hanya untuk owner
        const groupMetadata = await sock.groupMetadata(m.chat);
        const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
        if (!botIsAdmin) return send(mess.botadmin);

        const nonAdmins = groupMetadata.participants.filter(p => !p.admin && p.id !== sock.user.id).map(p => p.id);
        if (nonAdmins.length === 0) return send('❕ Tidak ada anggota non-admin untuk dikeluarkan.');

        send(mess.wait);
        let kickedCount = 0;
        for (const user of nonAdmins) {
            try {
                await sock.groupParticipantsUpdate(m.chat, [user], 'remove');
                kickedCount++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay
            } catch (e) {
                console.error(`[KickAll Error] Failed to kick ${user}:`, e);
            }
        }
        send(`✅ Berhasil mengeluarkan ${kickedCount} anggota non-admin.`);
        return;
      }

      // Mengirim pesan tersembunyi dengan tag semua anggota
      if (commandBody.startsWith('.hidetag') || commandBody === '.h') {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const participants = groupMetadata.participants.map(p => p.id);
        const messageText = commandBody.split(' ').slice(1).join(' ') || (m.quoted ? m.quoted.text : '');

        if (messageText) {
            await sock.sendMessage(m.chat, {
                text: messageText,
                mentions: participants
            });
        } else if (m.quoted) {
             // Recreate the quoted message as a forward with mentions
            const quotedMessage = { forward: m.quoted.fakeObj, mentions: participants };
            await sock.sendMessage(m.chat, quotedMessage);
        } else {
            send('❌ Format salah! Kirim .hidetag <pesan> atau balas pesan dengan .hidetag');
        }
        return;
      }

      // Menandai semua anggota grup dengan pesan
      if (commandBody.startsWith('.tagall')) {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const participants = groupMetadata.participants.map(p => p.id);
        const messageText = commandBody.split(' ').slice(1).join(' ') || (m.quoted ? m.quoted.text : 'Halo semua!');

        let mentionsText = messageText + '\n\n';
        mentionsText += participants.map(id => `@${id.split('@')[0]}`).join(' ');

        await sock.sendMessage(m.chat, {
            text: mentionsText,
            mentions: participants
        });
        return;
      }

      // Mengubah nama grup
      if (commandBody.startsWith('.setnamegc') || commandBody.startsWith('.setgroupname') || commandBody.startsWith('.setsubject')) {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
        if (!botIsAdmin) return send(mess.botadmin);

        const newName = commandBody.split(' ').slice(1).join(' ');
        if (!newName) return send('❌ Format salah! Kirim .setnamegc <nama_grup_baru>');
        try {
            await sock.groupUpdateSubject(m.chat, newName);
            send(`✅ Nama grup berhasil diubah menjadi: *${newName}*`);
        } catch (e) {
            console.error("[SetNameGC Error]", e);
            send('❌ Gagal mengubah nama grup. Mungkin terlalu panjang atau ada masalah lain.');
        }
        return;
      }

      // Mengubah deskripsi grup
      if (commandBody.startsWith('.setdesc') || commandBody.startsWith('.setdesk')) {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
        if (!botIsAdmin) return send(mess.botadmin);

        const newDesc = commandBody.split(' ').slice(1).join(' ');
        if (!newDesc) return send('❌ Format salah! Kirim .setdesc <deskripsi_baru>');
        try {
            await sock.groupUpdateDescription(m.chat, newDesc);
            send(`✅ Deskripsi grup berhasil diubah.`);
        } catch (e) {
            console.error("[SetDesc Error]", e);
            send('❌ Gagal mengubah deskripsi grup.');
        }
        return;
      }

      // Membuka grup
      if (commandBody.startsWith('.opengc') || commandBody === '.buka') {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
        if (!botIsAdmin) return send(mess.botadmin);

        try {
            await sock.groupSettingUpdate(m.chat, 'not_announcement');
            send(`✅ Grup berhasil dibuka. Sekarang semua anggota dapat mengirim pesan.`);
        } catch (e) {
            console.error("[OpenGC Error]", e);
            send('❌ Gagal membuka grup.');
        }
        return;
      }
      
      // Menutup grup
      if (commandBody.startsWith('.closegc') || commandBody === '.tutup') {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const groupMetadata = await sock.groupMetadata(m.chat);
        const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
        if (!botIsAdmin) return send(mess.botadmin);

        try {
            await sock.groupSettingUpdate(m.chat, 'announcement');
            send(`✅ Grup berhasil ditutup. Sekarang hanya admin yang dapat mengirim pesan.`);
        } catch (e) {
            console.error("[CloseGC Error]", e);
            send('❌ Gagal menutup grup.');
        }
        return;
      }

      // Mengaktifkan/menonaktifkan fitur anti-link grup
      if (commandBody.startsWith('.antilink-on') || commandBody.startsWith('.antilink-off')) {
        if (!m.isGroup) return send(mess.group);
        if (!isAdminOrOwner(from)) return send(mess.admin);
        const antiLinkConfig = readJsonFile(ANTILINK, {});

        if (commandBody.startsWith('.antilink-on')) {
            const method = commandBody.split(' ')[1]?.toLowerCase();
            if (!method || (method !== 'kick' && method !== 'yapping')) {
                return send('❌ Format salah! Gunakan: .antilink-on <kick/yapping>\n*kick*: mengeluarkan member. *yapping*: menghapus pesan.');
            }
            antiLinkConfig[m.chat] = { active: true, method: method };
            fs.writeFileSync(ANTILINK, JSON.stringify(antiLinkConfig, null, 2));
            send(`✅ Anti-link berhasil diaktifkan di grup ini dengan metode: *${method}*.`);
        } else { // .antilink-off
            if (antiLinkConfig[m.chat]) {
                delete antiLinkConfig[m.chat];
                fs.writeFileSync(ANTILINK, JSON.stringify(antiLinkConfig, null, 2));
                send('✅ Anti-link berhasil dinonaktifkan di grup ini.');
            } else {
                send('❕ Anti-link sudah tidak aktif di grup ini.');
            }
        }
        return;
      }

      // --- Periksa Anti-link (Middleware) ---
      // Ini harus dijalankan setiap ada pesan untuk memeriksa link grup
      const antiLinkConfig = readJsonFile(ANTILINK, {});
      if (m.isGroup && antiLinkConfig[m.chat]?.active) {
          const groupMetadata = await sock.groupMetadata(m.chat);
          const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
          if (!botIsAdmin && antiLinkConfig[m.chat].method === 'kick') {
              // Jika bot tidak admin tapi metode kick, nonaktifkan antilink atau peringatkan
              console.warn(`[AntiLink] Bot bukan admin di ${m.chat}, antilink (kick) tidak berfungsi.`);
              // Opsional: nonaktifkan antilink secara otomatis jika bot bukan admin
              // delete antiLinkConfig[m.chat];
              // fs.writeFileSync(ANTILINK, JSON.stringify(antiLinkConfig, null, 2));
              // send('⚠️ Bot bukan admin, anti-link dinonaktifkan otomatis.');
          } else {
              const chatInviteRegex = /(?:https?:\/\/chat\.whatsapp\.com\/)?([a-zA-Z0-9]{22})/;
              if (commandBody.match(chatInviteRegex) && !isAdminOrOwner(from)) { // Hanya anti link grup WhatsApp
                  send('🚫 *ANTILINK AKTIF!* Terdeteksi Anda mengirim link grup.');
                  if (antiLinkConfig[m.chat].method === 'kick' && botIsAdmin) {
                      try {
                          await sock.groupParticipantsUpdate(m.chat, [from], 'remove');
                          send(`✅ @${from.split('@')[0]} telah dikeluarkan karena mengirim link.`, {mentions: [from]});
                      } catch (e) {
                          console.error(`[AntiLink Kick Error] Failed to kick ${from}:`, e);
                          send('❌ Gagal mengeluarkan pengguna.');
                      }
                  } else if (antiLinkConfig[m.chat].method === 'yapping') {
                      try {
                          await sock.sendMessage(m.chat, { delete: m.key });
                          send('⚠️ Pesan link dihapus.');
                      } catch (e) {
                          console.error(`[AntiLink Yapping Error] Failed to delete message:`, e);
                          send('❌ Gagal menghapus pesan link.');
                      }
                  }
              }
          }
      }
      // --- Akhir Anti-link ---

      // --- Fitur Baru: Informasi & Utilitas Umum (dari system.js) ---

      // Menguji respons bot
      if (commandBody === '.ping') {
        const startTime = process.hrtime.bigint();
        await send('Pong!');
        const endTime = process.hrtime.bigint();
        const latency = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds
        send(`Pong! Latensi: ${latency.toFixed(2)} ms`);
        return;
      }

      // Mengukur kecepatan internet VPS
      if (commandBody === '.speedtest') {
        // Asumsi file speed.py ada di root folder proyek
        send(mess.wait + '\n_Menjalankan speedtest, ini mungkin memakan waktu..._');
        exec("python3 speed.py", (err, stdout, stderr) => {
            if (err) {
                console.error("[Speedtest Error]", err);
                return send("❌ Gagal menjalankan speed test. Pastikan Python dan speed.py terinstal dengan benar.");
            }
            if (stderr) console.error("[Speedtest Stderr]", stderr);
            send(`📊 *Hasil Speedtest:*\n${stdout}`);
        });
        return;
      }

      // Mencari info domain
      if (commandBody.startsWith('.whois ')) {
        const domain = commandBody.split(' ')[1];
        if (!domain) return send('❌ Format salah! Contoh: .whois google.com');
        try {
            const res = await axios.get(`https://api.whoislookupapi.com/?domain=${domain}`); // Perlu API key mungkin
            send(`*Whois for ${domain}:*\n\n${JSON.stringify(res.data, null, 2)}`);
        } catch (e) {
            console.error("[Whois Error]", e);
            send('❌ Gagal mengambil info domain atau domain tidak ditemukan.');
        }
        return;
      }

      // Mempersingkat URL
      if (commandBody.startsWith('.shortlink ')) {
        const url = commandBody.split(' ')[1];
        if (!url) return send('❌ Format salah! Contoh: .shortlink https://example.com');
        try {
            const res = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
            send(`🔗 Shortlink: ${res.data}`);
        } catch (e) {
            console.error("[Shortlink Error]", e);
            send('❌ Gagal memperpendek URL.');
        }
        return;
      }

      // Mengecek kondisi cuaca
      if (commandBody.startsWith('.cuaca ')) {
        const city = commandBody.split(' ').slice(1).join(' ');
        if (!city) return send('❌ Format salah! Contoh: .cuaca Jakarta');
        try {
            const res = await axios.get(`https://api.weatherapi.com/v1/current.json?key=${API_KEY_WEATHER}&q=${city}`);
            const { location, current } = res.data;
            send(`🌡️ *Cuaca di ${location.name}, ${location.country}:*\n` +
                 `Suhu: ${current.temp_c}°C\n` +
                 `Kondisi: ${current.condition.text}\n` +
                 `Kecepatan Angin: ${current.wind_kph} km/h\n` +
                 `Kelembaban: ${current.humidity}%`);
        } catch (e) {
            console.error("[Cuaca Error]", e);
            send('❌ Gagal mengambil data cuaca. Pastikan API Key benar atau kota ditemukan.');
        }
        return;
      }

      // Menerjemahkan teks
      if (commandBody.startsWith('.translate ')) {
        const textToTranslate = commandBody.split(' ').slice(1).join(' ');
        const parts = textToTranslate.split(' ke ');
        if (parts.length < 2) return send('❌ Format salah! Contoh: .translate halo ke inggris');
        const [text, lang] = parts;
        try {
            const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=id|${encodeURIComponent(lang)}&key=${API_KEY_MYMEMORY}`);
            send(`🌐 *Terjemahan:*\n${res.data.responseData.translatedText}`);
        } catch (e) {
            console.error("[Translate Error]", e);
            send('❌ Gagal menerjemahkan. Pastikan API Key benar atau bahasa valid.');
        }
        return;
      }

      // Mengecek kalori makanan
      if (commandBody.startsWith('.kalori ')) {
        const query = commandBody.split(' ').slice(1).join(' ');
        if (!query) return send('❌ Format salah! Contoh: .kalori nasi goreng');
        try {
            const res = await axios.get(`https://api.spoonacular.com/food/ingredients/search?query=${encodeURIComponent(query)}&apiKey=${API_KEY_SPOONACULAR}`);
            if (res.data.results.length === 0) return send('❕ Data kalori tidak ditemukan.');
            const item = res.data.results[0];
            send(`🍽️ *Kalori untuk ${item.name}:*\n` +
                 `Mungkin sekitar ${item.estimatedCost?.value || 'N/A'} kkal per ${item.estimatedCost?.unit || 'satuan'}.`); // Spoonacular API agak terbatas di sini
        } catch (e) {
            console.error("[Kalori Error]", e);
            send('❌ Gagal mengambil data kalori. Pastikan API Key benar.');
        }
        return;
      }

      // Menghitung BMI
      if (commandBody.startsWith('.cekbmi ')) {
        const parts = commandBody.split(' ')[1]?.split(' ');
        if (!parts || parts.length < 2) return send('❌ Format salah!\nGunakan: .cekbmi <berat_kg> <tinggi_cm>\nContoh: .cekbmi 70 175');
        const berat = parseFloat(parts[0]);
        const tinggi = parseFloat(parts[1]);
        if (isNaN(berat) || isNaN(tinggi) || berat <= 0 || tinggi <= 0) return send('❌ Berat atau tinggi tidak valid. Masukkan angka positif.');
        
        const bmi = (berat / ((tinggi / 100) ** 2)).toFixed(2);
        let kategori;
        if (bmi < 18.5) kategori = "Kurus";
        else if (bmi < 24.9) kategori = "Normal";
        else if (bmi < 29.9) kategori = "Berat Badan Berlebih";
        else kategori = "Obesitas";
        send(`⚖️ *Hasil BMI Anda:*\nBMI: ${bmi}\nKategori: ${kategori}`);
        return;
      }

      // Menghitung jumlah kata
      if (commandBody.startsWith('.hitungkata ')) {
        const textCount = commandBody.split(' ').slice(1).join(' ');
        if (!textCount) return send('❌ Format salah! Contoh: .hitungkata Halo dunia!');
        const wordCount = textCount.split(/\s+/).filter(word => word.length > 0).length;
        send(`📝 Jumlah kata: ${wordCount}`);
        return;
      }

      // Konversi mata uang
      if (commandBody.startsWith('.konversimatauang ')) {
        const parts = commandBody.split(' ').slice(1).join(' ').split(' ');
        if (parts.length < 4 || parts[2].toLowerCase() !== 'ke') return send('❌ Format salah!\nGunakan: .konversimatauang <jumlah> <mata_uang_asal> ke <mata_uang_tujuan>\nContoh: .konversimatauang 100 USD ke IDR');
        
        const amount = parseFloat(parts[0]);
        const fromCurrency = parts[1].toUpperCase();
        const toCurrency = parts[3].toUpperCase();

        if (isNaN(amount) || amount <= 0) return send('❌ Jumlah tidak valid.');
        
        try {
            const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`); // Atau API lain jika ini tidak berfungsi
            const rate = res.data.rates[toCurrency];
            if (!rate) return send('❌ Mata uang tujuan tidak valid.');
            send(`💰 ${amount} ${fromCurrency} = ${(amount * rate).toFixed(2)} ${toCurrency}`);
        } catch (e) {
            console.error("[KonversiMataUang Error]", e);
            send('❌ Gagal mengambil kurs mata uang. Pastikan kode mata uang benar (contoh: USD, IDR).');
        }
        return;
      }

      // Encode/Decode teks ke Base64
      if (commandBody.startsWith('.encoded ') || commandBody.startsWith('.decoded ')) {
        const action = commandBody.split(' ')[0];
        const textToProcess = commandBody.split(' ').slice(1).join(' ');
        if (!textToProcess) return send('❌ Format salah! Masukkan teks yang akan di-encode/decode.');

        try {
            if (action === '.encoded') {
                const encodedText = Buffer.from(textToProcess).toString('base64');
                send(`🔐 *Base64 Encoded:*\n\`\`\`${encodedText}\`\`\``);
            } else { // .decoded
                const decodedText = Buffer.from(textToProcess, 'base64').toString('utf8');
                send(`🔓 *Base64 Decoded:*\n\`\`\`${decodedText}\`\`\``);
            }
        } catch (e) {
            console.error("[EncodeDecode Error]", e);
            send('❌ Gagal memproses teks. Pastikan format Base64 valid untuk decode.');
        }
        return;
      }

      // Mengubah teks menjadi file PDF
      if (commandBody.startsWith('.text2pdf') || commandBody.startsWith('.txtpdf')) {
        const textContent = commandBody.split(' ').slice(1).join(' ');
        if (!textContent) return send('❌ Format salah! Gunakan: .text2pdf <teks>');

        try {
            const doc = new PDFDocument();
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', async () => {
                const pdfBuffer = Buffer.concat(buffers);
                await sock.sendMessage(sender, {
                    document: pdfBuffer,
                    mimetype: 'application/pdf',
                    fileName: `text_to_pdf-${Date.now()}.pdf`,
                    caption: '✅ PDF berhasil dibuat dari teks Anda.'
                }, { quoted: m });
            });
            doc.fontSize(12).text(textContent, { align: 'left' });
            doc.end();
        } catch (e) {
            console.error("[Text2PDF Error]", e);
            send('❌ Gagal membuat PDF.');
        }
        return;
      }
      
      // Menampilkan total perintah dalam skrip
      if (commandBody === '.totalfeature' || commandBody === '.totalfitur' || commandBody === '.totalcmd' || commandBody === '.totalcommand') {
        try {
            // Membaca file index.js sendiri untuk menghitung kasus
            const scriptContent = fs.readFileSync(__filename, 'utf8');
            const caseMatches = scriptContent.match(/if \(commandBody === '\.[\w-]+'\) \{|if \(commandBody\.startsWith\('\.[\w-]+\s*'\) \{/g); // Menghitung commandBody === .command atau commandBody.startsWith('.command ')
            
            // Perlu disesuaikan untuk menghitung semua case secara akurat
            // Ini adalah pendekatan dasar, mungkin tidak menghitung semua variasi jika ada logika yang sangat kompleks.
            const totalCommands = caseMatches ? caseMatches.length : 'N/A';
            send(`📊 Total perintah dalam bot ini: ${totalCommands}`);
        } catch (e) {
            console.error("[TotalFeatures Error]", e);
            send('❌ Gagal menghitung total fitur.');
        }
        return;
      }

      // Menampilkan waktu di berbagai kota
      if (commandBody === '.worldtime' || commandBody === '.waktuglobal' || commandBody === '.waktudunia') {
        send(mess.wait);
        try {
            const Abella = 'https://onlinealarmkur.com/world/id/'; // URL scrape
            const { data } = await axios.get(Abella);
            const $ = cheerio.load(data);
            let hasil = [];
            
            $('.flex.items-center.space-x-3').each((index, element) => {
                const bndera = $(element).find('.avatar .text-2xl').text().trim();
                const kota = $(element).find('.city-name').text().trim();
                const Zona = $(element).find('.city-time').attr('data-tz');
                
                if (Zona) {
                    const Yatta = { 'Sun': 'Min', 'Mon': 'Sen', 'Tue': 'Sel', 'Wed': 'Rab', 'Thu': 'Kam', 'Fri': 'Jum', 'Sat': 'Sab' };
                    const realTime = moment().tz(Zona).format('ddd - HH:mm').replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/g, match => Yatta[match]);
                    hasil.push({ bndera, kota, waktu: realTime });
                }
            });
            
            let pesan = "*🌍 World Time Information*\n\n";
            // Sort by UTC offset for better readability
            const sortedByTime = hasil.sort((a, b) => {
                const zonaA = moment.tz(a.kota, 'UTC').utcOffset();
                const zonaB = moment.tz(b.kota, 'UTC').utcOffset();
                return zonaA - zonaB;
            });

            sortedByTime.forEach(item => {
                pesan += `${item.bndera} *${item.kota}*: ${item.waktu}\n`;
            });
            await send(pesan);

        } catch (error) {
            console.error("[WorldTime Error]", error);
            send("❌ Maaf, tidak dapat mengambil informasi waktu saat ini.");
        }
        return;
      }

      // --- Akhir Fitur Baru: Informasi & Utilitas Umum ---

      // Keterangan: Menu untuk menampilkan fitur-fitur lain.
      if (commandBody === '.fiturlain') {
        return send(`✨ *Fitur Lain Absensi Bot:*
_Ketik perintah di bawah ini untuk melihat daftar fitur tambahan bot._

*I. Manajemen Bot & Akun (Owner/Admin)*
• *.clearsesi*
• *.backup*
• *.addprem <nomor>*
• *.delprem <nomor>*
• *.setbotname <nama>*
• *.setbotbio <teks>*
• *.addsewa <ID_grup|hari>*
• *.delsewa <ID_grup>*
• *.text-welcome <teks>*
• *.text-left <teks>*
• *.addlist <nama|konten>*
• *.dell-list <nama>*
• *.getlist*
• *.cekidgc*

*II. Manajemen Grup (Admin)*
• *.kick <mention/balas>*
• *.kickall*
• *.hidetag / .h*
• *.tagall*
• *.setnamegc <nama>*
• *.setdesc <teks>*
• *.opengc / .buka*
• *.closegc / .tutup*
• *.antilink-on <kick/yapping>*
• *.antilink-off*

*V. Informasi & Utilitas Umum*
• *.ping*
• *.speedtest*
• *.whois <domain>*
• *.shortlink <url>*
• *.cuaca <kota>*
• *.translate <kalimat> ke <bahasa>*
• *.kalori <makanan>*
• *.cekbmi <berat> <tinggi>*
• *.hitungkata <teks>*
• *.konversimatauang <jumlah> <mata_uang_asal> ke <mata_uang_tujuan>*
• *.encoded / .decoded <teks>*
• *.text2pdf / .txtpdf <teks>*
• *.totalfeature*
• *.worldtime*`)
      }


      // Keterangan: Menu khusus siswa, untuk melihat data dan melakukan absensi.
      if (commandBody === '.siswamenu') {
        return send(`👨‍🎓 *Siswa Menu:*
_Perintah ini dapat diakses oleh Siswa, Guru, Admin, dan Owner. Digunakan untuk melihat data dan melakukan absensi._
• *.listsiswa* – Melihat daftar siswa yang terdaftar.
• *.listguru* – Melihat daftar guru yang terdaftar.
• *.listabsen* – Melihat 10 absensi terakhir.
• *.today / .hariini* – Melihat absensi untuk hari ini.
• *.cek <nama>* – Memeriksa pendaftaran siswa.
• *.stat hariini / .stat <kelas>* – Melihat statistik absensi.
• *.sticker* – Membuat stiker dari gambar.`)
      }
      
      // Keterangan: Melihat daftar absensi yang tercatat untuk hari ini.
      if (commandBody === '.today' || commandBody === '.hariini') {
        const d = readJsonFile(DB, [])
        const today = new Date().toISOString().slice(0, 10)
        const dataToday = d.filter(x => x.waktu.startsWith(today))
        if (dataToday.length === 0) return send('📂 Belum ada absensi hari ini.')
        const list = dataToday.map((x, i) => `${i + 1}. ${x.nama} (${x.kelas})`).join('\n')
        return send(`📅 *Absensi Hari Ini:*\n${list}`)
      }

      // .cek <nama>
      // Keterangan: Memeriksa pendaftaran siswa tertentu.
      if (commandBody.startsWith('.cek ')) {
        const nama = commandBody.split('.cek ')[1].trim().toLowerCase()
        if (!nama) return send('❌ Format salah!\nGunakan: .cek NamaSiswa')
        const s = readJsonFile(SISWA, [])
        const match = s.find(x => x.nama.toLowerCase() === nama)
        return send(match ? `✅ *${match.nama}* terdaftar di kelas ${match.kelas}.` : `❌ *${nama}* tidak ditemukan dalam daftar siswa.`)
      }

      // .stat <kelas>
      // Keterangan: Melihat statistik absensi berdasarkan hari ini atau kelas tertentu.
      if (commandBody.startsWith('.stat ')) {
        const arg = commandBody.split('.stat ')[1].trim()
        const d = readJsonFile(DB, [])
        if (arg.toLowerCase() === 'hariini') {
          const today = new Date().toISOString().slice(0, 10)
          const dataToday = d.filter(x => x.waktu.startsWith(today))
          const kelasStat = {}
          dataToday.forEach(x => {
            if (!kelasStat[x.kelas]) kelasStat[x.kelas] = 0
            kelasStat[x.kelas]++
          })
          if (Object.keys(kelasStat).length === 0) return send('📂 Tidak ada absensi hari ini.')
          const list = Object.entries(kelasStat).map(([k, v]) => `• ${k}: ${v} siswa`).join('\n')
          return send(`📊 *Statistik Absen Hari Ini:*\n${list}`)
        } else {
          const kelas = arg.toLowerCase()
          const dataKelas = d.filter(x => x.kelas.toLowerCase() === kelas)
          if (dataKelas.length === 0) return send(`📂 Tidak ada data absen untuk kelas '${kelas}'.`)
          const count = {}
          dataKelas.forEach(x => {
            if (!count[x.nama]) count[x.nama] = 0
            count[x.nama]++
          })
          const list = Object.entries(count).map(([n, v]) => `• ${n}: ${v}x`).join('\n')
          return send(`📊 *Statistik Absen Kelas ${arg}:*\n${list}`)
        }
      }

      // QR Code scanning for attendance
      // Keterangan: Memicu absensi melalui pemindaian QR Code (kirim gambar dengan caption .absen).
      if (type === 'imageMessage' && commandBody.toLowerCase() === '.absen') {
        console.log(`[QR Scan] QR attendance trigger detected from ${from}.`);
        try {
          const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: P({ level: 'silent' }) });
          console.log('[QR Scan] Image buffer downloaded successfully.');
          const image = await Jimp.read(buffer);
          console.log('[QR Scan] Jimp successfully read image buffer.');
          const qr = new QrCode();
          qr.callback = async (err, value) => {
            if (err) {
              console.error("[QR Scan Error] Error decoding QR:", err);
              if (err.message && err.message.includes('No QR code found')) {
                return send('❌ Tidak ditemukan QR Code dalam gambar. Pastikan QR Code jelas dan tidak terpotong.');
              }
              return send('❌ Gagal membaca QR Code. Pastikan QR Code jelas dan tidak rusak.');
            }
            if (value && value.result) {
              console.log(`[QR Scan Success] QR Code decoded: "${value.result}"`);
              const parts = value.result.split('|');
              if (parts.length < 2) {
                console.warn(`[QR Scan Warning] Invalid QR format: "${value.result}".`);
                return send('❌ Format QR Code tidak valid. Harap gunakan format "Nama|Kelas" (misal: Budi|9A).');
              }

              const qrNama = parts[0].trim();
              const qrKelas = parts[1].trim();
              const qrNomor = parts[2] ? parts[2].trim() : ''; // Ambil nomor jika ada di QR

              const siswaList = readJsonFile(SISWA, []);
              const registeredStudent = siswaList.find(s =>
                (s.nama.toLowerCase() === qrNama.toLowerCase() && s.kelas.toLowerCase() === qrKelas.toLowerCase()) ||
                (qrNomor && s.nomor === qrNomor)
              );

              if (!registeredStudent) {
                return send(`❌ Siswa *${qrNama}* di kelas *${qrKelas}* (nomor ${qrNomor || 'tidak ada'}) tidak terdaftar. Mohon hubungi admin.`);
              }

              const db = readJsonFile(DB, []);
              const now = new Date();
              const dateTime = now.toISOString().slice(0, 19).replace('T', ' ');

              // Check if student already absent today
              const today = now.toISOString().slice(0, 10);
              const alreadyAbsent = db.some(entry =>
                entry.nama.toLowerCase() === registeredStudent.nama.toLowerCase() && entry.kelas.toLowerCase() === registeredStudent.kelas.toLowerCase() && entry.waktu.startsWith(today)
              );

              if (alreadyAbsent) {
                return send(`⚠️ *${registeredStudent.nama}* (${registeredStudent.kelas}) sudah absen hari ini.`);
              }

              db.push({ nama: registeredStudent.nama, kelas: registeredStudent.kelas, waktu: dateTime, sender: from });
              fs.writeFileSync(DB, JSON.stringify(db, null, 2));
              return send(`✅ Absensi *${registeredStudent.nama} (${registeredStudent.kelas})* berhasil dicatat pada ${dateTime}.
Lihat rekap absensi terbaru di: https://absen.unitycloud.my.id/absensi`); // Menggunakan domain baru
            } else {
              return send('❌ QR Code tidak mengandung data absensi yang valid.');
            }
          };
          qr.decode(image.bitmap);
        } catch (e) {
          console.error("Error processing QR image:", e);
          send('❌ Terjadi kesalahan saat memproses gambar QR Code.');
        }
      }
    })
  } catch (err) {
    console.error('❌ Bot error:', err)
    isConnecting = false
  }
}

startSocket()
app.listen(PORT, () => console.log(`🌐 Web aktif: http://localhost:${PORT}`))
