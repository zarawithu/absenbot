// === index.js v1.2 EXTENDED by @alfrdvinn ===
// ✅ Semua fitur stabil, ditambah ownermenu, adminmenu, gurumenu, dan lainnya

const express = require('express')
const { ensureUserExists, getUserData } = require('./utils/database'); // <<< PENTING: Tambahkan getUserData
const {
    default: makeWASocket,
    useMultiFileAuthState,
    // fetchLatestBaileysVersion, // Mungkin tidak berfungsi di Baileys lama, akan ditangani
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
const axios = require('axios'); // Untuk HTTP requests (digunakan di banyak fitur)
const cheerio = require('cheerio'); // Untuk web scraping (digunakan di fitur berita, worldtime, dll.)
const moment = require('moment-timezone'); // Untuk waktu global
const { exec, execSync } = require('child_process'); // Untuk menjalankan perintah sistem (speedtest, backup)
const PDFDocument = require('pdfkit'); // Untuk text2pdf: npm install pdfkit
const FormData = require('form-data'); // Untuk request multipart/form-data: npm install form-data
const archiver = require('archiver'); // Untuk fitur backup: npm install archiver
// const { Client } = require('ssh2'); // Tidak diaktifkan secara default karena kompleksitas, hanya jika Anda menginstal panel

// --- Variabel Global/Konstanta ---
// Ini adalah pengganti variabel global dari system.js, sesuaikan jika perlu
const botname = "AbsensiBot"; // Nama bot Anda, akan muncul di beberapa info
const pengembang = "@alfrdvinn"; // Nama pengembang, akan muncul di info stiker, dll.
const host = "https://panel.example.com"; // Ganti dengan link panel Pterodactyl Anda jika menggunakan fitur panel
const host2 = "https://panel2.example.com"; // Link panel kedua, jika ada server panel kedua untuk alokasi
const globalOwnerNumber = "6285747334379"; // Nomor owner utama bot ini (tanpa + dan 0 di depan)
const mess = { // Objek pesan-pesan umum untuk respons bot
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
// --- API Keys Eksternal ---
// PENTING: Ganti 'YOUR_API_KEY' dengan API Key Anda yang sebenarnya dari penyedia layanan.
// Tanpa API Key yang valid, fitur-fitur ini TIDAK AKAN BEKERJA.
const API_KEY_WEATHER = 'YOUR_WEATHER_API_KEY'; // Dapatkan dari https://www.weatherapi.com/
const API_KEY_SPOONACULAR = 'YOUR_SPOONACULAR_API_KEY'; // Dapatkan dari https://spoonacular.com/food-api
const API_KEY_MYMEMORY = 'YOUR_MYMEMORY_API_KEY'; // Dapatkan dari https://mymemory.translated.net/doc/spec.php

// --- Path Database ---
const app = express()
const PORT = 19133 // Port untuk akses web UI, pastikan dibuka di firewall VPS
app.use(express.static('public')) // Menyajikan file statis dari folder public

const DB = './database/absensi.json' // Database utama untuk data absensi
const ADMIN = './database/admin.json' // Database untuk daftar nomor admin
const OWNER = './database/owner.json' // Database untuk daftar nomor owner
const SISWA = './database/siswa.json' // Database untuk daftar siswa
const GURU = './database/guru.json' // Database untuk daftar guru
const CONFIG = './config.json' // Database untuk konfigurasi bot (misal: mode public/self)
const USERS = './database/users.json' // Database baru: untuk data user-specific (limit, premium)
const SEWA = './database/sewa.json' // Database baru: untuk data sewa grup
const ANTILINK = './database/antilink.json' // Database baru: untuk konfigurasi anti-link grup
const STORELIST = './database/store-list.json' // Database baru: untuk daftar teks/konten tersimpan
const WELCOME_TEXT_DB = './database/welcome.json'; // Database baru: untuk teks pesan welcome grup
const LEFT_TEXT_DB = './database/left.json'; // Database baru: untuk teks pesan left grup

if (!fs.existsSync('./database')) fs.mkdirSync('./database') // Buat folder database jika belum ada

// Fungsi untuk membaca dan memastikan file JSON adalah array/objek valid
const readJsonFile = (filePath, defaultContent) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(data);
        // Memastikan tipe data yang dibaca sesuai dengan yang diharapkan (array atau objek)
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
        // Jika file tidak ada, kosong, atau rusak, buat file baru dengan defaultContent
        fs.writeFileSync(filePath, JSON.stringify(defaultContent));
        return defaultContent;
    }
};

// Inisialisasi file-file database (membuat file kosong jika belum ada)
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
if (!fs.existsSync(WELCOME_TEXT_DB)) fs.writeFileSync(WELCOME_TEXT_DB, '{}'); // Inisialisasi WELCOME_TEXT_DB
if (!fs.existsSync(LEFT_TEXT_DB)) fs.writeFileSync(LEFT_TEXT_DB, '{}'); // Inisialisasi LEFT_TEXT_DB

// Fungsi utilitas untuk mengecek peran pengguna
const getMode = () => readJsonFile(CONFIG, { mode: 'public' }).mode
const isAdminOrOwner = n => readJsonFile(ADMIN, []).includes(n) || readJsonFile(OWNER, []).includes(n)
const isOwner = n => readJsonFile(OWNER, []).includes(n)
const isSiswa = n => readJsonFile(SISWA, []).some(s => s.nomor === n);
const isGuru = n => readJsonFile(GURU, []).some(g => g.nomor === n);


// Fungsi untuk format ukuran (bytes ke KB/MB/GB)
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- Express.js untuk Web UI ---
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
        // const { version } = await fetchLatestBaileysVersion() // Baris ini dihapus karena mungkin tidak kompatibel dengan Baileys v5
        const sock = makeWASocket({ auth: state, version: [5, 0, 0], logger: P({ level: 'silent' }) }) // Hardcode versi Baileys untuk v5.0.0

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
            await ensureUserExists(from); 
            const user = await getUserData(from); 
            
            if (!user) {
                console.error(`[Error] Data user untuk ${from} tidak ditemukan setelah ensureUserExists dan getUserData.`);
                return send(mess.error + '\n_Tidak dapat memuat data pengguna._');
            }

            const isPremium = user.premium;
            const userLimit = user.limit; 

            // --- Fungsi untuk mendapatkan salam personal dan info user di awal menu ---
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
                let userRoleText = "Pengguna tidak terdaftar"; // Default peran
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

            // --- Helper function untuk mendapatkan nomor target dari pesan (teks, mention, atau reply) ---
            const getTargetNumber = (messageBody, messageObject) => {
                let target = null;
                // Coba ambil dari argumen teks langsung (misal: .addprem 628xxxx)
                if (messageBody.split(' ')[1]) {
                    let num = messageBody.split(' ')[1].replace(/\D/g, ''); // Bersihkan non-digit
                    if (num.length > 5) { // Validasi sederhana panjang nomor (misal: min 6 digit)
                        target = num + '@s.whatsapp.net';
                    }
                }
                // Jika tidak ditemukan, coba dari mention (jika ada)
                if (!target && messageObject.mentionedJid && messageObject.mentionedJid.length > 0) {
                    target = messageObject.mentionedJid[0];
                }
                // Jika masih tidak ditemukan, coba dari pengirim pesan yang di-reply (jika ada)
                if (!target && messageObject.quoted && messageObject.quoted.sender) {
                    target = messageObject.quoted.sender;
                }
                return target;
            };
            // --- AKHIR Helper function getTargetNumber ---


            // --- DAFTAR COMMANDS UTAMA BOT ---

            // Keterangan: Menu utama bot, dapat diakses semua pengguna.
            // Contoh: .menu
            if (commandBody === '.menu') {
                const greeting = getPersonalizedGreeting(from); // Dapatkan salam personal
                return send(`${greeting}
            
📖 *MENU ABSENSI BOT v1.2 EXTENDED*

_Pilih salah satu menu di bawah ini untuk melihat daftar perintah yang tersedia. Ketik perintah yang diinginkan._

• *.ownermenu* - Menu khusus Owner bot.
• *.adminmenu* - Menu khusus Admin bot.
• *.gurumenu* - Menu khusus Guru.
• *.siswamenu* - Menu khusus Siswa.
• *.info* - Informasi dan statistik bot.
• *.sticker* - Buat stiker dari gambar.
• *.fiturlain* - Fitur-fitur lain bot ini.`)
            }

            // Keterangan: Menu khusus owner bot, untuk manajemen tingkat tinggi.
            // Contoh: .ownermenu
            if (commandBody === '.ownermenu') return send(`👑 *Owner Menu:*
_Perintah ini hanya dapat diakses oleh Owner bot. Digunakan untuk manajemen sistem dan hak akses._
• *.addadmin <nomor>* - Menambahkan nomor ke daftar admin.
• *.deladmin <nomor>* - Menghapus nomor dari daftar admin.
• *.addowner <nomor>* - Menambahkan nomor ke daftar owner (gunakan dengan hati-hati!).
• *.delowner <nomor>* - Menghapus nomor dari daftar owner (gunakan dengan sangat hati-hati!).
• *.broadcast <pesan>* - Mengirim pesan ke semua grup yang diikuti bot.
• *.self* - Mengubah mode bot menjadi 'Self' (hanya owner merespons).
• *.public* - Mengubah mode bot menjadi 'Public' (semua pengguna terdaftar merespons).
• *.owner* - Menampilkan daftar kontak owner bot.
• *.clearsesi* - Membersihkan file sesi WhatsApp bot (memerlukan restart/scan QR).
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


            if (commandBody === '.adminmenu') {
                return send(`🛠 *Admin Menu:*
_Perintah ini dapat diakses oleh Admin dan Owner. Digunakan untuk mengelola data siswa dan guru, serta manajemen grup._
• *.addsiswa <Nama|Kelas|Nomor>* - Menambahkan data siswa baru (contoh: *.addsiswa Budi|9A|628123456789*).
• *.delsiswa <NamaSiswa>* - Menghapus siswa dari database (contoh: *.delsiswa Budi*).
• *.addguru <Nama|Mapel|Nomor>* - Menambahkan data guru baru (contoh: *.addguru PakJoko|Matematika|6285711223344*).
• *.delguru <NamaGuru>* - Menghapus guru dari database (contoh: *.delGuru PakJoko*).
• *.listsiswa* - Menampilkan daftar siswa yang terdaftar.
• *.listguru* - Menampilkan daftar guru yang terdaftar.
• *.listabsen* - Menampilkan 10 absensi terakhir.
• *.kick <mention/balas>* - Mengeluarkan anggota grup.
• *.kickall* - Mengeluarkan semua anggota grup (hanya Owner).
• *.hidetag / .h <pesan>* - Mengirim pesan tersembunyi dengan tag semua anggota.
• *.tagall <pesan>* - Menandai semua anggota grup dengan pesan.
• *.setnamegc <nama>* - Mengubah nama grup.
• *.setdesc <teks>* - Mengubah deskripsi grup.
• *.opengc / .buka* - Membuka grup.
• *.closegc / .tutup* - Menutup grup.
• *.antilink-on <kick/yapping>* - Mengaktifkan anti-link grup.
• *.antilink-off* - Menonaktifkan anti-link grup.`)
            }

            if (commandBody === '.gurumenu') return send(`📚 *Guru Menu:*
_Perintah ini dapat diakses oleh Guru, Admin, dan Owner. Digunakan untuk melihat data siswa dan rekap absensi._
• *.listsiswa* - Melihat daftar siswa yang terdaftar.
• *.listabsen* - Melihat 10 absensi terakhir yang tercatat.
• *.today / .hariini* - Melihat daftar absensi yang tercatat untuk hari ini.
• *.cek <nama>* - Memeriksa pendaftaran siswa tertentu (contoh: *.cek Budi*).
• *.stat hariini / .stat <kelas>* - Melihat statistik absensi (contoh: *.stat hariini* atau *.stat 9A*).`)

            if (commandBody === '.info') {
                const admin = readJsonFile(ADMIN, [])
                const siswa = readJsonFile(SISWA, [])
                const guru = readJsonFile(GURU, [])
                const absen = readJsonFile(DB, [])
                let usersDb = readJsonFile(USERS, {});
                const totalUsers = Object.keys(usersDb).length;
                const totalMem = process.memoryUsage().heapUsed;
                const formattedTotalMem = formatSize(totalMem);
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

            if (commandBody === '.owner') {
                let owners = readJsonFile(OWNER, [])
                const list = Array.isArray(owners) && owners.length > 0
                    ? owners.map(o => `wa.me/${o}`).join('\n')
                    : 'Tidak ada owner terdaftar.'
                return send(`👑 Kontak Owner:\n${list}`)
            }

            if (commandBody.startsWith('.addadmin') && isOwner(from)) {
                const nomor = commandBody.split(' ')[1]?.replace(/\D/g, '')
                if (!nomor) return send('❌ Format salah!\nGunakan: .addadmin 628xxxx')
                const adminList = readJsonFile(ADMIN, [])
                if (!adminList.includes(nomor)) {
                    adminList.push(nomor)
                    fs.writeFileSync(ADMIN, JSON.stringify(adminList, null, 2));
                    return send(`✅ Admin ${nomor} ditambahkan.`);
                }
                return send(`❕ Admin ${nomor} sudah terdaftar.`)
            }

            if (commandBody.startsWith('.deladmin') && isOwner(from)) {
                const nomor = commandBody.split(' ')[1]?.replace(/\D/g, '')
                if (!nomor) return send('❌ Format salah!\nGunakan: .deladmin 628xxxx')
                let adminList = readJsonFile(ADMIN, []);
                const initialLength = adminList.length;
                adminList = adminList.filter(n => n !== nomor);
                fs.writeFileSync(ADMIN, JSON.stringify(adminList, null, 2));
                return send(initialLength !== adminList.length ? `✅ Admin ${nomor} dihapus.` : `❕ Admin ${nomor} tidak ditemukan.`);
            }

            if (commandBody.startsWith('.addowner') && isOwner(from)) {
                const nomor = commandBody.split(' ')[1]?.replace(/\D/g, '')
                if (!nomor) return send('❌ Format salah!\nGunakan: .addowner 628xxxx')
                const ownerList = readJsonFile(OWNER, []);
                if (!ownerList.includes(nomor)) {
                    ownerList.push(nomor);
                    fs.writeFileSync(OWNER, JSON.stringify(ownerList, null, 2));
                    return send(`✅ Owner ${nomor} ditambahkan.`);
                }
                return send(`❕ Owner ${nomor} sudah terdaftar.`)
            }

            if (commandBody.startsWith('.delowner') && isOwner(from)) {
                const nomor = commandBody.split(' ')[1]?.replace(/\D/g, '')
                if (!nomor) return send('❌ Format salah!\nGunakan: .delowner 628xxxx')
                let ownerList = readJsonFile(OWNER, []);
                const initialLength = ownerList.length;
                ownerList = ownerList.filter(n => n !== nomor);
                fs.writeFileSync(OWNER, JSON.stringify(ownerList, null, 2));
                return send(initialLength !== ownerList.length ? `✅ Owner ${nomor} dihapus.` : `❕ Owner ${nomor} tidak ditemukan.`);
            }

            if (commandBody.startsWith('.broadcast ') && isOwner(from)) {
                const pesan = commandBody.replace('.broadcast ', '')
                if (!pesan) return send('❌ Format salah!\nGunakan: .broadcast <pesan>')
                const chats = await sock.groupFetchAllParticipating()
                for (const jid of Object.keys(chats)) {
                    await sock.sendMessage(jid, { text: `📢 *Broadcast:*\n${pesan}` })
                }
                return send('✅ Broadcast dikirim ke semua grup.')
            }

            if (commandBody === '.self' && isOwner(from)) {
                fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'self' }))
                return send('✅ Mode diubah ke *SELF*.')
            }

            if (commandBody === '.public' && isOwner(from)) {
                fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'public' }))
                return send('✅ Mode diubah ke *PUBLIC*.')
            }

            if (commandBody === '.clearsesi' || commandBody === '.delsesi' || commandBody === '.clear' || commandBody === '.cs' || commandBody === '.clearsession') {
                if (!isOwner(from)) return send(mess.owner);
                fs.readdir("./auth", async (err, files) => {
                    if (err) {
                        console.error('Failed to scan auth directory:', err);
                        return send('❌ Gagal memindai folder sesi: ' + err.message);
                    }
                    const filteredFiles = files.filter(file => file !== 'creds.json');
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

            if (commandBody === '.backup') {
                if (!isOwner(from)) return send(mess.owner);
                send(mess.wait);
                try {
                    const filesToBackup = fs.readdirSync('./').filter(item => 
                        item !== 'node_modules' && item !== 'package-lock.json' && item !== 'auth' && item !== '.git'
                    );
                    const backupFileName = `backup-${Date.now()}.zip`;
                    const backupPath = path.join(__dirname, backupFileName);
                    
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
                        fs.unlinkSync(backupPath);
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
            
            if (commandBody.startsWith('.addprem')) {
                if (!isOwner(from)) return send(mess.owner);
                const targetNumber = getTargetNumber(commandBody, m);
                if (!targetNumber) return send('❌ Format salah! Balas pesan, mention, atau gunakan: .addprem 628xxxx');
                
                await ensureUserExists(targetNumber); // Pastikan target juga ada di USERS
                let usersDb = readJsonFile(USERS, {});
                usersDb[targetNumber].premium = true;
                fs.writeFileSync(USERS, JSON.stringify(usersDb, null, 2));
                return send(`✅ Pengguna ${targetNumber.split('@')[0]} sekarang Premium!`);
            }
            if (commandBody.startsWith('.delprem')) {
                if (!isOwner(from)) return send(mess.owner);
                const targetNumber = getTargetNumber(commandBody, m);
                if (!targetNumber) return send('❌ Format salah! Balas pesan, mention, atau gunakan: .delprem 628xxxx');

                await ensureUserExists(targetNumber); // Pastikan target juga ada di USERS
                let usersDb = readJsonFile(USERS, {});
                usersDb[targetNumber].premium = false;
                fs.writeFileSync(USERS, JSON.stringify(usersDb, null, 2));
                return send(`✅ Pengguna ${targetNumber.split('@')[0]} tidak lagi Premium.`);
            }

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
            
            if (commandBody.startsWith('.addsewa') || commandBody.startsWith('.delsewa')) {
                if (!isOwner(from)) return send(mess.owner);
                const data = readJsonFile(SEWA, {});
                const parts = commandBody.split(' ')[1]?.split('|');

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
            
            if (commandBody.startsWith('.text-welcome') || commandBody.startsWith('.text-left')) {
                if (!isOwner(from)) return send(mess.owner);
                const textToSet = commandBody.split(' ').slice(1).join(' ');
                const type = commandBody.split(' ')[0].replace('.', '');
                if (!textToSet) return send(`❌ Format salah!\nGunakan: .${type} <teks_pesan>\n*Gunakan #user untuk menandai member, #group untuk nama grup, #total untuk total member.*`);
                
                let dbPath = `./database/${type}.json`;
                let currentText = {};
                try {
                    currentText = readJsonFile(dbPath, {});
                } catch {
                    fs.writeFileSync(dbPath, '{}');
                }
                currentText.text = textToSet;
                fs.writeFileSync(dbPath, JSON.stringify(currentText, null, 2));
                send(`✅ Teks ${type} berhasil diperbarui.`);
                return;
            }

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

            if (commandBody === '.cekidgc') {
                if (!isOwner(from)) return send(mess.owner);
                let allGroups = await sock.groupFetchAllParticipating();
                let groups = Object.values(allGroups);
                
                if (groups.length === 0) return send('📂 Bot tidak tergabung dalam grup mana pun.');

                let msg = `📋 *Daftar Grup yang Diikuti Bot:*\n\n`;
                groups.forEach((group, i) => {
                    msg += `*${i + 1}. Nama Grup:* ${group.subject}\n`;
                    msg += `    *ID Grup:* ${group.id}\n`;
                    msg += `    *Anggota:* ${group.participants.length}\n\n`;
                });
                send(msg);
                return;
            }

            if (commandBody.startsWith('.kick')) {
                if (!m.isGroup) return send(mess.group);
                if (!isAdminOrOwner(from)) return send(mess.admin);
                const groupMetadata = await sock.groupMetadata(m.chat);
                const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
                if (!botIsAdmin) return send(mess.botadmin);

                let usersToKick = [];
                if (m.quoted && m.quoted.sender) {
                    usersToKick.push(m.quoted.sender);
                } else if (m.mentionedJid && m.mentionedJid.length > 0) {
                    usersToKick = m.mentionedJid;
                } else if (commandBody.split(' ')[1]) {
                    const number = commandBody.split(' ')[1]?.replace(/\D/g, '') + '@s.whatsapp.net';
                    if (number && number.length > '@s.whatsapp.net'.length) usersToKick.push(number);
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

            if (commandBody === '.kickall') {
                if (!m.isGroup) return send(mess.group);
                if (!isOwner(from)) return send(mess.owner);
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
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (e) {
                        console.error(`[KickAll Error] Failed to kick ${user}:`, e);
                    }
                }
                send(`✅ Berhasil mengeluarkan ${kickedCount} anggota non-admin.`);
                return;
            }

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
                } else if (m.quoted && m.quoted.fakeObj) {
                    const quotedMessage = { forward: m.quoted.fakeObj, mentions: participants };
                    await sock.sendMessage(m.chat, quotedMessage);
                } else {
                    send('❌ Format salah! Kirim .hidetag <pesan> atau balas pesan dengan .hidetag');
                }
                return;
            }

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
                } else {
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

            const antiLinkConfig = readJsonFile(ANTILINK, {});
            if (m.isGroup && antiLinkConfig[m.chat]?.active) {
                const groupMetadata = await sock.groupMetadata(m.chat);
                const botIsAdmin = groupMetadata.participants.some(p => p.id === sock.user.id && p.admin === 'admin');
                if (!botIsAdmin && antiLinkConfig[m.chat].method === 'kick') {
                    console.warn(`[AntiLink] Bot bukan admin di ${m.chat}, antilink (kick) tidak berfungsi.`);
                } else {
                    const chatInviteRegex = /(?:https?:\/\/chat\.whatsapp\.com\/)?([a-zA-Z0-9]{22})/;
                    if (commandBody.match(chatInviteRegex) && !isAdminOrOwner(from)) {
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

            if (commandBody === '.ping') {
                const startTime = process.hrtime.bigint();
                await send('Pong!');
                const endTime = process.hrtime.bigint();
                const latency = Number(endTime - startTime) / 1_000_000;
                send(`Pong! Latensi: ${latency.toFixed(2)} ms`);
                return;
            }

            if (commandBody === '.speedtest') {
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

            if (commandBody.startsWith('.whois ')) {
                const domain = commandBody.split(' ')[1];
                if (!domain) return send('❌ Format salah! Contoh: .whois google.com');
                try {
                    const res = await axios.get(`https://api.whoislookupapi.com/?domain=${domain}`);
                    send(`*Whois for ${domain}:*\n\n${JSON.stringify(res.data, null, 2)}`);
                } catch (e) {
                    console.error("[Whois Error]", e);
                    send('❌ Gagal mengambil info domain atau domain tidak ditemukan.');
                }
                return;
            }

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

            if (commandBody.startsWith('.kalori ')) {
                const query = commandBody.split(' ').slice(1).join(' ');
                if (!query) return send('❌ Format salah! Contoh: .kalori nasi goreng');
                try {
                    const res = await axios.get(`https://api.spoonacular.com/food/ingredients/search?query=${encodeURIComponent(query)}&apiKey=${API_KEY_SPOONACULAR}`);
                    if (res.data.results.length === 0) return send('❕ Data kalori tidak ditemukan.');
                    const item = res.data.results[0];
                    send(`🍽️ *Kalori untuk ${item.name}:*\n` +
                        `Mungkin sekitar ${item.estimatedCost?.value || 'N/A'} kkal per ${item.estimatedCost?.unit || 'satuan'}.`);
                } catch (e) {
                    console.error("[Kalori Error]", e);
                    send('❌ Gagal mengambil data kalori. Pastikan API Key benar.');
                }
                return;
            }

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

            if (commandBody.startsWith('.hitungkata ')) {
                const textCount = commandBody.split(' ').slice(1).join(' ');
                if (!textCount) return send('❌ Format salah! Contoh: .hitungkata Halo dunia!');
                const wordCount = textCount.split(/\s+/).filter(word => word.length > 0).length;
                send(`📝 Jumlah kata: ${wordCount}`);
                return;
            }

            if (commandBody.startsWith('.konversimatauang ')) {
                const parts = commandBody.split(' ').slice(1).join(' ').split(' ');
                if (parts.length < 4 || parts[2].toLowerCase() !== 'ke') return send('❌ Format salah!\nGunakan: .konversimatauang <jumlah> <mata_uang_asal> ke <mata_uang_tujuan>\nContoh: .konversimatauang 100 USD ke IDR');
                
                const amount = parseFloat(parts[0]);
                const fromCurrency = parts[1].toUpperCase();
                const toCurrency = parts[3].toUpperCase();

                if (isNaN(amount) || amount <= 0) return send('❌ Jumlah tidak valid.');
                
                try {
                    const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
                    const rate = res.data.rates[toCurrency];
                    if (!rate) return send('❌ Mata uang tujuan tidak valid.');
                    send(`💰 ${amount} ${fromCurrency} = ${(amount * rate).toFixed(2)} ${toCurrency}`);
                } catch (e) {
                    console.error("[KonversiMataUang Error]", e);
                    send('❌ Gagal mengambil kurs mata uang. Pastikan kode mata uang benar (contoh: USD, IDR).');
                }
                return;
            }

            if (commandBody.startsWith('.encoded ') || commandBody.startsWith('.decoded ')) {
                const action = commandBody.split(' ')[0];
                const textToProcess = commandBody.split(' ').slice(1).join(' ');
                if (!textToProcess) return send('❌ Format salah! Masukkan teks yang akan di-encode/decode.');

                try {
                    if (action === '.encoded') {
                        const encodedText = Buffer.from(textToProcess).toString('base64');
                        send(`🔐 *Base64 Encoded:*\n\`\`\`${encodedText}\`\`\``);
                    } else {
                        const decodedText = Buffer.from(textToProcess, 'base64').toString('utf8');
                        send(`🔓 *Base64 Decoded:*\n\`\`\`${decodedText}\`\`\``);
                    }
                } catch (e) {
                    console.error("[EncodeDecode Error]", e);
                    send('❌ Gagal memproses teks. Pastikan format Base64 valid untuk decode.');
                }
                return;
            }

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
            
            if (commandBody === '.totalfeature' || commandBody === '.totalfitur' || commandBody === '.totalcmd' || commandBody === '.totalcommand') {
                try {
                    const scriptContent = fs.readFileSync(__filename, 'utf8');
                    const commandRegex = /if \(commandBody === '\.[\w-]+'\) \{|if \(commandBody\.startsWith\('\.[\w-]+\s*'\) \{/g;
                    const matches = scriptContent.match(commandRegex);
                    const totalCommands = matches ? matches.length : 'N/A';
                    send(`📊 Total perintah dalam bot ini: ${totalCommands}`);
                } catch (e) {
                    console.error("[TotalFeatures Error]", e);
                    send('❌ Gagal menghitung total fitur.');
                }
                return;
            }

            if (commandBody === '.worldtime' || commandBody === '.waktuglobal' || commandBody === '.waktudunia') {
                send(mess.wait);
                try {
                    const Abella = 'https://onlinealarmkur.com/world/id/';
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
                    const sortedByTime = hasil.sort((a, b) => {
                        // Anda perlu mengimpor 'moment-timezone' di file ini untuk menggunakan .tz().utcOffset()
                        // Jika tidak, ini bisa menyebabkan error jika kota tidak dikenal oleh moment-timezone
                        const zonaA = moment().tz(a.kota).utcOffset(); 
                        const zonaB = moment().tz(b.kota).utcOffset();
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

            if (commandBody === '.fiturlain') {
                return send(`✨ *Fitur Lain Absensi Bot:*
_Ketik perintah di bawah ini untuk melihat daftar fitur tambahan bot._

*I. Manajemen Bot & Akun (Owner/Admin)*
• *.clearsesi* - Membersihkan file sesi WhatsApp bot (memerlukan restart).
• *.backup* - Membuat dan mengirim backup file proyek bot.
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
• *.cekidgc* - Menampilkan ID dan info grup bot.

*II. Manajemen Grup (Admin)*
• *.kick <mention/balas>* - Mengeluarkan anggota grup.
• *.kickall* - Mengeluarkan semua anggota grup (hanya Owner).
• *.hidetag / .h <pesan>* - Mengirim pesan tersembunyi dengan tag semua anggota.
• *.tagall <pesan>* - Menandai semua anggota grup dengan pesan.
• *.setnamegc <nama>* - Mengubah nama grup.
• *.setdesc <teks>* - Mengubah deskripsi grup.
• *.opengc / .buka* - Membuka grup.
• *.closegc / .tutup* - Menutup grup.
• *.antilink-on <kick/yapping>* - Mengaktifkan anti-link grup.
• *.antilink-off* - Menonaktifkan anti-link grup.

*V. Informasi & Utilitas Umum*
• *.ping* - Menguji respons bot.
• *.speedtest* - Mengukur kecepatan internet VPS.
• *.whois <domain>* - Mencari info domain.
• *.shortlink <url>* - Mempersingkat URL.
• *.cuaca <kota>* - Mengecek kondisi cuaca.
• *.translate <kalimat> ke <bahasa>* - Menerjemahkan teks.
• *.kalori <makanan>* - Mengecek kalori makanan.
• *.cekbmi <berat> <tinggi>* - Menghitung BMI.
• *.hitungkata <teks>* - Menghitung jumlah kata.
• *.konversimatauang <jumlah> <mata_uang_asal> ke <mata_uang_tujuan>* - Konversi mata uang.
• *.encoded / .decoded <teks>* - Encode/Decode teks ke Base64.
• *.text2pdf / .txtpdf <teks>* - Mengubah teks menjadi file PDF.
• *.totalfeature* - Menampilkan total perintah dalam bot ini.
• *.worldtime* - Menampilkan waktu di berbagai kota.`)
            }


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
            
            // === START FITUR STICKER BARU DITAMBAHKAN ===
            if (commandBody.toLowerCase() === '.sticker' || commandBody.toLowerCase() === '.stiker') {
                let media = null;
                // 'm' adalah objek pesan yang diterima. Jika ada balasan, quoted akan jadi pesan yang dibalas.
                // Jika tidak ada balasan, maka kita ambil pesan itu sendiri (m)
                let quotedMsg = m.quoted ? m.quoted : m; 

                // Periksa apakah pesan adalah gambar (baik pesan langsung atau balasan)
                if (quotedMsg && (quotedMsg.mtype === 'imageMessage' || (quotedMsg.message && quotedMsg.message.imageMessage))) {
                    send(mess.wait); 

                    try {
                        // Unduh media (gambar) dari pesan yang dikutip/langsung
                        media = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: P({ level: 'silent' }) });

                        // Buat stiker
                        const sticker = new Sticker(media, {
                            pack: 'Davin', // Nama pack stiker
                            author: pengembang,        // Nama author stiker (dari variabel global)
                            type: 'full', // Menggunakan string 'full' secara langsung
                            quality: 100,              // Kualitas stiker (0-100)
                        });

                        const stickerBuffer = await sticker.toBuffer(); // Konversi ke buffer

                        // Kirim stiker
                        await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: m });
                        send(mess.success);
                    } catch (e) {
                        console.error("[Sticker Error]", e);
                        send('❌ Gagal membuat stiker. Pastikan gambar jelas atau coba lagi.');
                    }
                } else {
                    send('❌ Kirim gambar dengan caption *.sticker* atau balas gambar dengan *.sticker*.');
                }
                return; // Penting: hentikan eksekusi command lain setelah ini
            }
            // === END FITUR STICKER BARU DITAMBAHKAN ===

            // === START FITUR MANAJEMEN SISWA BARU DITAMBAHKAN ===
            if (commandBody.startsWith('.addsiswa')) {
                if (!isAdminOrOwner(from)) return send(mess.admin);
                const parts = commandBody.split(' ').slice(1).join(' ').split('|');
                if (parts.length < 3) {
                    return send('❌ Format salah!\nGunakan: .addsiswa <Nama|Kelas|Nomor>\nContoh: .addsiswa Budi|9A|628123456789');
                }
                const [nama, kelas, nomor] = parts.map(p => p.trim());
                if (!nama || !kelas || !nomor) {
                    return send('❌ Nama, kelas, atau nomor tidak boleh kosong.');
                }
                const formattedNomor = nomor.replace(/\D/g, ''); // Hapus non-digit

                let siswaList = readJsonFile(SISWA, []);
                const existingSiswa = siswaList.find(s => s.nomor === formattedNomor);
                if (existingSiswa) {
                    return send(`❕ Siswa dengan nomor ${formattedNomor} (${existingSiswa.nama}) sudah terdaftar.`);
                }

                siswaList.push({ nama, kelas, nomor: formattedNomor });
                fs.writeFileSync(SISWA, JSON.stringify(siswaList, null, 2));
                return send(`✅ Siswa *${nama}* kelas *${kelas}* dengan nomor *${formattedNomor}* berhasil ditambahkan.`);
            }

            if (commandBody === '.listsiswa') {
                const siswaList = readJsonFile(SISWA, []);
                if (siswaList.length === 0) {
                    return send('📂 Belum ada siswa terdaftar.');
                }
                let msg = '📋 *Daftar Siswa Terdaftar:*\n\n';
                siswaList.forEach((s, i) => {
                    msg += `${i + 1}. Nama: *${s.nama}*\n`;
                    msg += `    Kelas: ${s.kelas}\n`;
                    msg += `    Nomor: ${s.nomor}\n\n`;
                });
                return send(msg);
            }
            // === END FITUR MANAJEMEN SISWA BARU DITAMBAHKAN ===

            // === SISA PERINTAH LAINNYA ===
            if (commandBody === '.today' || commandBody === '.hariini') {
                const d = readJsonFile(DB, [])
                const today = new Date().toISOString().slice(0, 10)
                const dataToday = d.filter(x => x.waktu.startsWith(today))
                if (dataToday.length === 0) return send('📂 Belum ada absensi hari ini.')
                const list = dataToday.map((x, i) => `${i + 1}. ${x.nama} (${x.kelas})`).join('\n')
                return send(`📅 *Absensi Hari Ini:*\n${list}`)
            }

            if (commandBody.startsWith('.cek ')) {
                const nama = commandBody.split('.cek ')[1].trim().toLowerCase()
                if (!nama) return send('❌ Format salah!\nGunakan: .cek NamaSiswa')
                const s = readJsonFile(SISWA, [])
                const match = s.find(x => x.nama.toLowerCase() === nama)
                return send(match ? `✅ *${match.nama}* terdaftar di kelas ${match.kelas}.` : `❌ *${nama}* tidak ditemukan dalam daftar siswa.`)
            }

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
                            console.error("[QR Scan Error]", err);
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
                            const qrNomor = parts[2] ? parts[2].trim() : '';

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
Lihat rekap absensi terbaru di: https://absen.unitycloud.my.id/absensi`);
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
