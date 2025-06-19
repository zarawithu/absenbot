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
const Jimp = require('jimp')
const QrCode = require('qrcode-reader')

const app = express()
const PORT = 3111
app.use(express.static('public'))

const DB = './database/absensi.json'
const ADMIN = './database/admin.json'
const OWNER = './database/owner.json'
const SISWA = './database/siswa.json'
const GURU = './database/guru.json'
const CONFIG = './config.json'

// Memastikan folder database ada dan membuat file JSON jika belum ada
if (!fs.existsSync('./database')) fs.mkdirSync('./database')

// Fungsi untuk membaca dan memastikan file JSON adalah array valid
// Default content untuk CONFIG adalah objek, yang lain array
const readJsonFile = (filePath, defaultContent) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(data);
        // Periksa apakah parsedData adalah tipe yang diharapkan (array atau objek)
        if (Array.isArray(defaultContent) && !Array.isArray(parsedData)) {
            console.warn(`[Warning] ${filePath} expected array but got different type. Resetting.`);
            fs.writeFileSync(filePath, JSON.stringify(defaultContent));
            return defaultContent;
        }
        if (typeof defaultContent === 'object' && !Array.isArray(defaultContent) && typeof parsedData !== 'object') {
             console.warn(`[Warning] ${filePath} expected object but got different type. Resetting.`);
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

// Inisialisasi file-file database menggunakan readJsonFile
// Pastikan defaultContent sesuai dengan struktur yang diharapkan (array atau objek)
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '[]')
if (!fs.existsSync(ADMIN)) fs.writeFileSync(ADMIN, '[]')
// Inisialisasi OWNER dengan nomor default jika file belum ada atau kosong/rusak
let currentOwners = readJsonFile(OWNER, []);
if (currentOwners.length === 0) {
    fs.writeFileSync(OWNER, JSON.stringify(["6285747334379"])); // Contoh nomor owner default
}
if (!fs.existsSync(SISWA)) fs.writeFileSync(SISWA, '[]')
if (!fs.existsSync(GURU)) fs.writeFileSync(GURU, '[]')
// Inisialisasi CONFIG dengan objek default
let currentConfig = readJsonFile(CONFIG, { mode: 'public' });
if (Object.keys(currentConfig).length === 0 || !currentConfig.mode) {
    fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'public' }));
}


// Fungsi utilitas untuk membaca konfigurasi dan daftar pengguna
const getMode = () => readJsonFile(CONFIG, { mode: 'public' }).mode // Default mode public jika config rusak atau kosong
const isAdminOrOwner = n => readJsonFile(ADMIN, []).includes(n) || readJsonFile(OWNER, []).includes(n)
const isOwner = n => readJsonFile(OWNER, []).includes(n)

// Rute Express untuk halaman web
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))
app.get('/generate', (_, res) => res.sendFile(path.join(__dirname, 'public', 'generate.html')))
app.get('/absensi', (req, res) => {
  let db = readJsonFile(DB, []); // Gunakan fungsi readJsonFile
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
        // Jika status loggedOut, tidak perlu mencoba koneksi ulang otomatis
        if (statusCode === DisconnectReason.loggedOut) {
          isConnecting = false; // Setel ke false agar bisa startSocket() lagi secara manual jika diperlukan
          console.log('Bot disconnected because it was logged out. Please rescan QR if needed.');
        } else {
          // Coba koneksi ulang setelah 3 detik untuk error lainnya
          console.log(`Connection closed due to ${lastDisconnect?.error?.message || 'unknown reason'}, retrying...`);
          setTimeout(() => { isConnecting = false; startSocket() }, 3000)
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return // Abaikan pesan kosong atau dari bot sendiri
      const sender = m.key.remoteJid // JID pengirim (bisa grup atau personal)
      const from = (m.key.participant || sender).replace(/@s\.whatsapp\.net/, '') // Nomor telepon pengirim
      const type = Object.keys(m.message)[0] // Tipe pesan (misal: conversation, imageMessage)
      const msg = m.message[type]
      const body = msg?.text || msg?.caption || '' // Isi pesan teks atau caption
      const send = t => sock.sendMessage(sender, { text: t }) // Fungsi singkat untuk mengirim pesan teks
      
      // Mode bot: 'self' hanya owner yang bisa pakai, 'public' semua bisa (setelah terdaftar)
      if (getMode() === 'self' && !isOwner(from)) {
        return send('🤖 Bot dalam mode *SELF*. Hanya Owner yang dapat menggunakan.')
      }

      // --- COMMANDS ---

      if (body === '.ownermenu') return send(`👑 *Owner Menu:*
• .addadmin <nomor>
• .deladmin <nomor>
• .addowner <nomor>
• .delowner <nomor>
• .broadcast <pesan>
• .self / .public
• .owner`)

      if (body === '.adminmenu') return send(`🛠 *Admin Menu:*
• .addsiswa Nama|Kelas
• .delsiswa Nama
• .addguru Nama|Mapel
• .delguru Nama
• .listsiswa
• .listguru
• .listabsen`)

      if (body === '.gurumenu') return send(`📚 *Guru Menu:*
• .listsiswa
• .listabsen
• .today / .hariini
• .cek <nama>
• .stat hariini / .stat <kelas>`)

      if (body === '.menu') {
        return send(`📖 *MENU ABSENSI BOT v1.2 EXTENDED*

Ketik salah satu:
• .ownermenu (khusus owner)
• .adminmenu (khusus admin & owner)
• .gurumenu (khusus guru, admin & owner)
• .siswamenu (khusus siswa, guru, admin & owner)
• .info (info bot)
• .sticker (kirim gambar lalu reply .sticker)`)
      }

      if (body === '.info') {
        const admin = readJsonFile(ADMIN, [])
        const siswa = readJsonFile(SISWA, [])
        const guru = readJsonFile(GURU, [])
        const absen = readJsonFile(DB, [])
        return send(`🤖 *Info Bot:*
👤 Mode: *${getMode().toUpperCase()}*
👮 Admin: ${admin.length}
👨‍🎓 Siswa: ${siswa.length}
👨‍🏫 Guru: ${guru.length}
📅 Absen Total: ${absen.length}`)
      }

      // .owner dengan penanganan error
      if (body === '.owner') {
        const owners = readJsonFile(OWNER, []); // Gunakan readJsonFile
        const list = Array.isArray(owners) && owners.length > 0
          ? owners.map(o => `wa.me/${o}`).join('\n')
          : 'Tidak ada owner terdaftar.';
        return send(`👑 Kontak Owner:\n${list}`);
      }

      // Tambah admin (hanya owner)
      if (body.startsWith('.addadmin') && isOwner(from)) {
        const nomor = body.split(' ')[1]?.replace(/\D/g, '') // Ambil nomor, hapus non-digit
        if (!nomor) return send('❌ Format salah!\nGunakan: .addadmin 628xxxx')
        const adminList = readJsonFile(ADMIN, []) // Gunakan readJsonFile
        if (!adminList.includes(nomor)) {
          adminList.push(nomor)
          fs.writeFileSync(ADMIN, JSON.stringify(adminList, null, 2))
          return send(`✅ Admin ${nomor} ditambahkan.`)
        }
        return send(`❕ Admin ${nomor} sudah terdaftar.`)
      }

      // Hapus admin (hanya owner)
      if (body.startsWith('.deladmin') && isOwner(from)) {
        const nomor = body.split(' ')[1]?.replace(/\D/g, '')
        if (!nomor) return send('❌ Format salah!\nGunakan: .deladmin 628xxxx')
        let adminList = readJsonFile(ADMIN, []) // Gunakan readJsonFile
        const initialLength = adminList.length
        adminList = adminList.filter(n => n !== nomor)
        fs.writeFileSync(ADMIN, JSON.stringify(adminList, null, 2))
        return send(initialLength !== adminList.length ? `✅ Admin ${nomor} dihapus.` : `❕ Admin ${nomor} tidak ditemukan.`)
      }

      // Tambah owner (hanya owner)
      if (body.startsWith('.addowner') && isOwner(from)) {
        const nomor = body.split(' ')[1]?.replace(/\D/g, '')
        if (!nomor) return send('❌ Format salah!\nGunakan: .addowner 628xxxx')
        const ownerList = readJsonFile(OWNER, []) // Gunakan readJsonFile
        if (!ownerList.includes(nomor)) {
          ownerList.push(nomor)
          fs.writeFileSync(OWNER, JSON.stringify(ownerList, null, 2))
          return send(`✅ Owner ${nomor} ditambahkan.`)
        }
        return send(`❕ Owner ${nomor} sudah terdaftar.`)
      }

      // Hapus owner (hanya owner)
      if (body.startsWith('.delowner') && isOwner(from)) {
        const nomor = body.split(' ')[1]?.replace(/\D/g, '')
        if (!nomor) return send('❌ Format salah!\nGunakan: .delowner 628xxxx')
        let ownerList = readJsonFile(OWNER, []) // Gunakan readJsonFile
        const initialLength = ownerList.length
        ownerList = ownerList.filter(n => n !== nomor)
        fs.writeFileSync(OWNER, JSON.stringify(ownerList, null, 2))
        return send(initialLength !== ownerList.length ? `✅ Owner ${nomor} dihapus.` : `❕ Owner ${nomor} tidak ditemukan.`)
      }

      // Broadcast pesan ke semua grup bot (hanya owner)
      if (body.startsWith('.broadcast ') && isOwner(from)) {
        const pesan = body.replace('.broadcast ', '')
        if (!pesan) return send('❌ Format salah!\nGunakan: .broadcast <pesan>')
        const chats = await sock.groupFetchAllParticipating() // Ambil semua grup yang diikuti bot
        for (const jid of Object.keys(chats)) {
          await sock.sendMessage(jid, { text: `📢 *Broadcast:*\n${pesan}` })
        }
        return send('✅ Broadcast dikirim ke semua grup.')
      }

      // Ubah mode bot ke 'self' (hanya owner)
      if (body === '.self' && isOwner(from)) {
        fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'self' }))
        return send('✅ Mode diubah ke *SELF*. Bot hanya merespon perintah dari Owner.')
      }

      // Ubah mode bot ke 'public' (hanya owner)
      if (body === '.public' && isOwner(from)) {
        fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'public' }))
        return send('✅ Mode diubah ke *PUBLIC*. Bot merespon perintah dari semua pengguna terdaftar.')
      }

      // Tambah siswa (admin atau owner)
      if (body.startsWith('.addsiswa') && isAdminOrOwner(from)) {
        const data = body.split(' ')[1]
        if (!data || !data.includes('|')) return send('❌ Format salah!\nGunakan: .addsiswa Nama|Kelas')
        const [nama, kelas] = data.split('|')
        const s = readJsonFile(SISWA, []) // Gunakan readJsonFile
        // Cek duplikat siswa
        if (s.some(student => student.nama.toLowerCase() === nama.toLowerCase() && student.kelas.toLowerCase() === kelas.toLowerCase())) {
          return send(`❕ Siswa *${nama} (${kelas})* sudah terdaftar.`)
        }
        s.push({ nama, kelas })
        fs.writeFileSync(SISWA, JSON.stringify(s, null, 2))
        return send(`✅ Siswa *${nama} (${kelas})* ditambahkan.`)
      }

      // Hapus siswa (admin atau owner)
      if (body.startsWith('.delsiswa') && isAdminOrOwner(from)) {
        const namaToDelete = body.split(' ')[1]
        if (!namaToDelete) return send('❌ Format salah!\nGunakan: .delsiswa Nama')
        let s = readJsonFile(SISWA, []) // Gunakan readJsonFile
        const initialLength = s.length
        s = s.filter(x => x.nama.toLowerCase() !== namaToDelete.toLowerCase())
        fs.writeFileSync(SISWA, JSON.stringify(s, null, 2))
        return send(initialLength !== s.length ? `✅ Siswa '${namaToDelete}' dihapus.` : `❕ Siswa '${namaToDelete}' tidak ditemukan.`)
      }

      // Lihat daftar siswa
      if (body === '.listsiswa') {
        const s = readJsonFile(SISWA, []) // Gunakan readJsonFile
        if (s.length === 0) return send('📂 Tidak ada data siswa.')
        const list = s.map((x, i) => `${i + 1}. ${x.nama} (${x.kelas})`).join('\n')
        return send(`📚 *Daftar Siswa:*\n${list}`)
      }

      // Tambah guru (admin atau owner)
      if (body.startsWith('.addguru') && isAdminOrOwner(from)) {
        const data = body.split(' ')[1]
        if (!data || !data.includes('|')) return send('❌ Format salah!\nGunakan: .addguru Nama|Mapel')
        const [nama, mapel] = data.split('|')
        const g = readJsonFile(GURU, []) // Gunakan readJsonFile
        // Cek duplikat guru
        if (g.some(teacher => teacher.nama.toLowerCase() === nama.toLowerCase())) {
          return send(`❕ Guru *${nama}* sudah terdaftar.`)
        }
        g.push({ nama, mapel })
        fs.writeFileSync(GURU, JSON.stringify(g, null, 2))
        return send(`✅ Guru *${nama} (${mapel})* ditambahkan.`)
      }

      // Hapus guru (admin atau owner)
      if (body.startsWith('.delguru') && isAdminOrOwner(from)) {
        const namaToDelete = body.split(' ')[1]
        if (!namaToDelete) return send('❌ Format salah!\nGunakan: .delguru Nama')
        let g = readJsonFile(GURU, []) // Gunakan readJsonFile
        const initialLength = g.length
        g = g.filter(x => x.nama.toLowerCase() !== namaToDelete.toLowerCase())
        fs.writeFileSync(GURU, JSON.stringify(g, null, 2))
        return send(initialLength !== g.length ? `✅ Guru '${namaToDelete}' dihapus.` : `❕ Guru '${namaToDelete}' tidak ditemukan.`)
      }

      // Lihat daftar guru
      if (body === '.listguru') {
        const g = readJsonFile(GURU, []) // Gunakan readJsonFile
        if (g.length === 0) return send('📂 Tidak ada data guru.')
        const list = g.map((x, i) => `${i + 1}. ${x.nama} (${x.mapel})`).join('\n')
        return send(`👨‍🏫 *Daftar Guru:*\n${list}`)
      }

      // Lihat 10 absensi terakhir
      if (body === '.listabsen') {
        const d = readJsonFile(DB, []) // Gunakan readJsonFile
        if (d.length === 0) return send('📂 Tidak ada data absen.')
        // Ambil 10 data absen terbaru, balik urutan untuk menampilkan yang terbaru duluan
        const list = d.slice(-10).reverse().map((x, i) => `${i + 1}. Nama: ${x.nama}\nKelas: ${x.kelas}\nWaktu: ${x.waktu}\nPengirim: ${x.sender}`).join('\n\n')
        return send(`📑 *10 Absensi Terakhir:*\n\n${list}`)
      }

      // Buat stiker dari gambar
      if (type === 'imageMessage' && body.toLowerCase().includes('.sticker')) { // Gunakan toLowerCase()
        try {
          const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: P({ level: 'silent' }) })
          await sock.sendMessage(sender, {
            sticker: buffer,
            packname: 'AbsensiBot',
            author: '@alfrdvinn'
          }, { quoted: m })
        } catch (e) {
          console.error("Error creating sticker:", e)
          send('❌ Gagal buat stiker. Pastikan format gambar didukung atau coba lagi.')
        }
      }

      // Cek apakah pengguna terdaftar (siswa, guru, admin, owner) untuk akses fitur tertentu
      const siswaList = readJsonFile(SISWA, []) // Gunakan readJsonFile
      const guruList = readJsonFile(GURU, []) // Gunakan readJsonFile
      const isSiswa = siswaList.some(s => s.nama.toLowerCase() === from.toLowerCase())
      const isGuru = guruList.some(g => g.nama.toLowerCase() === from.toLowerCase())
      const allowedUserForStudentFeatures = isAdminOrOwner(from) || isSiswa || isGuru;

      const userWarning = '⚠️ Kamu belum terdaftar atau tidak memiliki akses untuk fitur ini! Minta owner/admin untuk menambahkan kamu ke daftar.'

      // Batasi akses perintah siswa/guru jika belum terdaftar
      if (
        (body.toLowerCase().startsWith('.listsiswa') || // toLowerCase()
        body.toLowerCase().startsWith('.listguru') || // toLowerCase()
        body.toLowerCase().startsWith('.listabsen') || // toLowerCase()
        body.toLowerCase() === '.siswamenu' || // toLowerCase()
        body.toLowerCase().includes('.sticker') || // toLowerCase()
        body.toLowerCase() === '.today' || // toLowerCase()
        body.toLowerCase() === '.hariini' || // toLowerCase()
        body.toLowerCase().startsWith('.cek ') || // toLowerCase()
        body.toLowerCase().startsWith('.stat ')) && !allowedUserForStudentFeatures // toLowerCase()
      ) {
        return send(userWarning)
      }

      // SISWA MENU
      if (body === '.siswamenu') {
        return send(`👨‍🎓 *Siswa Menu:*
• .listsiswa – Lihat daftar siswa
• .listguru – Lihat daftar guru
• .listabsen – Lihat 10 absensi terakhir
• .today / .hariini – Lihat absensi hari ini
• .cek <nama> – Cek pendaftaran siswa (misal: .cek Budi)
• .stat hariini / .stat <kelas> – Statistik absensi (misal: .stat hariini atau .stat 9A)
• .sticker – Buat stiker dari gambar (kirim gambar lalu reply dengan .sticker)`)
      }

      // Absensi hari ini
      if (body === '.today' || body === '.hariini') {
        const d = readJsonFile(DB, []) // Gunakan readJsonFile
        const today = new Date().toISOString().slice(0, 10) // Format: YYYY-MM-DD
        const dataToday = d.filter(x => x.waktu.startsWith(today))
        if (dataToday.length === 0) return send('📂 Belum ada absensi hari ini.')
        const list = dataToday.map((x, i) => `${i + 1}. ${x.nama} (${x.kelas})`).join('\n')
        return send(`📅 *Absensi Hari Ini:*\n${list}`)
      }

      // Cek pendaftaran siswa
      if (body.startsWith('.cek ')) {
        const nama = body.split('.cek ')[1].trim().toLowerCase()
        if (!nama) return send('❌ Format salah!\nGunakan: .cek NamaSiswa')
        const s = readJsonFile(SISWA, []) // Gunakan readJsonFile
        const match = s.find(x => x.nama.toLowerCase() === nama)
        return send(match ? `✅ *${match.nama}* terdaftar di kelas ${match.kelas}.` : `❌ *${nama}* tidak ditemukan dalam daftar siswa.`)
      }

      // Statistik absensi
      if (body.startsWith('.stat ')) {
        const arg = body.split('.stat ')[1].trim().toLowerCase()
        if (!arg) return send('❌ Format salah!\nGunakan: .stat hariini atau .stat NamaKelas (misal: .stat 9A)')
        const d = readJsonFile(DB, []) // Gunakan readJsonFile

        if (arg === 'hariini') {
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
          const kelas = arg
          const dataKelas = d.filter(x => x.kelas.toLowerCase() === kelas)
          if (dataKelas.length === 0) return send(`📂 Tidak ada data absen untuk kelas '${kelas}'.`)
          const count = {}
          dataKelas.forEach(x => {
            if (!count[x.nama]) count[x.nama] = 0
            count[x.nama]++
          })
          const list = Object.entries(count).map(([n, v]) => `• ${n}: ${v}x`).join('\n')
          return send(`📊 *Statistik Absen Kelas ${arg.toUpperCase()}:*\n${list}`)
        }
      }

      // QR Code scanning untuk absensi
      if (type === 'imageMessage' && body.toLowerCase().includes('absensi')) {
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
              const nama = parts[0].trim();
              const kelas = parts[1].trim();

              const siswaList = readJsonFile(SISWA, []); // Gunakan readJsonFile
              const registeredStudent = siswaList.find(s =>
                s.nama.toLowerCase() === nama.toLowerCase() && s.kelas.toLowerCase() === kelas.toLowerCase()
              );

              if (!registeredStudent) {
                return send(`❌ Siswa *${nama}* di kelas *${kelas}* tidak terdaftar. Mohon hubungi admin.`);
              }

              const db = readJsonFile(DB, []); // Gunakan readJsonFile
              const now = new Date();
              const dateTime = now.toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS

              // Cek apakah siswa sudah absen hari ini
              const today = now.toISOString().slice(0, 10);
              const alreadyAbsent = db.some(entry =>
                entry.nama.toLowerCase() === registeredStudent.nama.toLowerCase() &&
                entry.kelas.toLowerCase() === registeredStudent.kelas.toLowerCase() &&
                entry.waktu.startsWith(today)
              );

              if (alreadyAbsent) {
                return send(`⚠️ *${registeredStudent.nama}* (${registeredStudent.kelas}) sudah absen hari ini.`);
              }

              db.push({ nama: registeredStudent.nama, kelas: registeredStudent.kelas, waktu: dateTime, sender: from });
              fs.writeFileSync(DB, JSON.stringify(db, null, 2));
              return send(`✅ Absensi *${registeredStudent.nama} (${registeredStudent.kelas})* berhasil dicatat pada ${dateTime}.`);
            } else {
              console.warn('[QR Scan Warning] QR Code found but no valid result.');
              return send('❌ QR Code tidak mengandung data absensi yang valid.');
            }
          };
          qr.decode(image.bitmap);
        } catch (e) {
          console.error("[QR Scan Processing Error] Terjadi kesalahan saat memproses gambar QR Code:", e);
          send('❌ Terjadi kesalahan saat memproses gambar QR Code. Pastikan Anda mengirimkan gambar QR Code yang valid.');
        }
      }
    })
  } catch (err) {
    console.error('❌ Bot error (startSocket):', err)
    isConnecting = false
  }
}

// Mulai bot dan server web
startSocket()
app.listen(PORT, () => console.log(`🌐 Web aktif: http://localhost:${PORT}`))
