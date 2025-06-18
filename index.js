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

// === Path File
const DB = './database/absensi.json'
const ADMIN = './database/admin.json'
const OWNER = './database/owner.json'
const SISWA = './database/siswa.json'
const GURU = './database/guru.json'
const CONFIG = './config.json'

// === Inisialisasi
if (!fs.existsSync('./database')) fs.mkdirSync('./database')
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '[]')
if (!fs.existsSync(ADMIN)) fs.writeFileSync(ADMIN, '[]')
if (!fs.existsSync(OWNER)) fs.writeFileSync(OWNER, '["6285747334379"]')
if (!fs.existsSync(SISWA)) fs.writeFileSync(SISWA, '[]')
if (!fs.existsSync(GURU)) fs.writeFileSync(GURU, '[]')
if (!fs.existsSync(CONFIG)) fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'public' }))

const getMode = () => JSON.parse(fs.readFileSync(CONFIG)).mode
const isAdminOrOwner = n => {
  const a = JSON.parse(fs.readFileSync(ADMIN))
  const o = JSON.parse(fs.readFileSync(OWNER))
  return a.includes(n) || o.includes(n)
}
const isOwner = n => JSON.parse(fs.readFileSync(OWNER)).includes(n)

app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))
app.get('/generate', (_, res) => res.sendFile(path.join(__dirname, 'public', 'generate.html')))
app.get('/absensi', (req, res) => {
  let db = []
  try {
    db = JSON.parse(fs.readFileSync(DB))
    if (!Array.isArray(db)) throw new Error()
  } catch { db = [] }

  const kelas = req.query.kelas?.toLowerCase()
  const tanggal = req.query.tanggal
  if (kelas) db = db.filter(d => d.kelas.toLowerCase() === kelas)
  if (tanggal) db = db.filter(d => d.waktu.startsWith(tanggal))

  const rows = db.reverse().map(d =>
    `<tr><td>${d.nama}</td><td>${d.kelas}</td><td>${d.waktu}</td><td>${d.sender}</td></tr>`
  ).join('')

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link rel="stylesheet" href="/style.css"><title>Rekap Absensi</title></head><body>
  <main><h2>📋 Rekap Absensi</h2>
  <form><input name="kelas" placeholder="Kelas"/><input type="date" name="tanggal"/><button>🔍 Filter</button></form>
  <table><thead><tr><th>Nama</th><th>Kelas</th><th>Waktu</th><th>Pengirim</th></tr></thead><tbody>${rows}</tbody></table>
  <button class="toggle-mode" onclick="toggleTheme()">🌗 Ganti Mode</button>
  <footer>© 2025 Davin Maritza</footer>
  <script>
    function toggleTheme() {
      const html = document.documentElement
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark"
      html.setAttribute("data-theme", next)
      localStorage.setItem("theme", next)
    }
    document.addEventListener("DOMContentLoaded", () => {
      const saved = localStorage.getItem("theme") || "light"
      document.documentElement.setAttribute("data-theme", saved)
    })
  </script>
  </main></body></html>`)
})

// === BOT WA
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
      if (connection === 'open') console.log('✅ Bot aktif.')
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        if (code !== DisconnectReason.loggedOut) {
          console.log('🔄 Reconnecting...')
          setTimeout(() => { isConnecting = false; startSocket() }, 3000)
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const m = messages[0]
      if (!m.message || m.key.fromMe) return
      const sender = m.key.remoteJid
      const from = (m.key.participant || sender).replace(/@s\.whatsapp\.net/, '')
      const type = Object.keys(m.message)[0]
      const body = m.message[type]?.text || m.message.conversation || ''

      if (getMode() === 'self' && !isOwner(from)) return

      const send = text => sock.sendMessage(sender, { text })

      if (body.startsWith('.menu')) {
        return send(`📖 *MENU ADMIN*\n\n🛠 *Bot Control:*\n• .restart\n• .rekap\n• .info\n• .broadcast <pesan>\n• .self / .public\n\n👥 *Admin & Owner:*\n• .addadmin 628xxxx\n• .deladmin 628xxxx\n• .addowner 628xxxx\n• .delowner 628xxxx\n\n👨‍🏫 *Data:*\n• .addsiswa Nama|Kelas\n• .addguru Nama|Mapel`)
      }

      if (body.startsWith('.addadmin') && isOwner(from)) {
        const num = body.split(' ')[1]
        if (!num) return send('❌ Masukkan nomor admin!')
        const a = JSON.parse(fs.readFileSync(ADMIN))
        if (!a.includes(num)) a.push(num)
        fs.writeFileSync(ADMIN, JSON.stringify(a, null, 2))
        return send(`✅ Admin ${num} ditambahkan.`)
      }

      if (body.startsWith('.deladmin') && isOwner(from)) {
        const num = body.split(' ')[1]
        if (!num) return send('❌ Masukkan nomor admin!')
        let a = JSON.parse(fs.readFileSync(ADMIN))
        a = a.filter(n => n !== num)
        fs.writeFileSync(ADMIN, JSON.stringify(a, null, 2))
        return send(`✅ Admin ${num} dihapus.`)
      }

      if (body.startsWith('.addowner') && isOwner(from)) {
        const num = body.split(' ')[1]
        if (!num) return send('❌ Masukkan nomor owner!')
        const o = JSON.parse(fs.readFileSync(OWNER))
        if (!o.includes(num)) o.push(num)
        fs.writeFileSync(OWNER, JSON.stringify(o, null, 2))
        return send(`✅ Owner ${num} ditambahkan.`)
      }

      if (body.startsWith('.delowner') && isOwner(from)) {
        const num = body.split(' ')[1]
        if (!num) return send('❌ Masukkan nomor owner!')
        let o = JSON.parse(fs.readFileSync(OWNER))
        o = o.filter(n => n !== num)
        fs.writeFileSync(OWNER, JSON.stringify(o, null, 2))
        return send(`✅ Owner ${num} dihapus.`)
      }

      if (body.startsWith('.addsiswa') && isAdminOrOwner(from)) {
        const data = body.split(' ')[1]
        if (!data || !data.includes('|')) return send('❌ Format salah!\nGunakan: .addsiswa Nama|Kelas')
        const [nama, kelas] = data.split('|')
        const siswa = JSON.parse(fs.readFileSync(SISWA))
        siswa.push({ nama, kelas })
        fs.writeFileSync(SISWA, JSON.stringify(siswa, null, 2))
        return send(`✅ Siswa *${nama} (${kelas})* ditambahkan.`)
      }

      if (body.startsWith('.addguru') && isAdminOrOwner(from)) {
        const data = body.split(' ')[1]
        if (!data || !data.includes('|')) return send('❌ Format salah!\nGunakan: .addguru Nama|Mapel')
        const [nama, mapel] = data.split('|')
        const guru = JSON.parse(fs.readFileSync(GURU))
        guru.push({ nama, mapel })
        fs.writeFileSync(GURU, JSON.stringify(guru, null, 2))
        return send(`✅ Guru *${nama} (${mapel})* ditambahkan.`)
      }

      if (body === '.self' && isOwner(from)) {
        fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'self' }))
        return send('✅ Mode diubah ke *SELF*.')
      }

      if (body === '.public' && isOwner(from)) {
        fs.writeFileSync(CONFIG, JSON.stringify({ mode: 'public' }))
        return send('✅ Mode diubah ke *PUBLIC*.')
      }

      if (body === '.info') {
        return send(`🤖 Bot aktif\nMode: *${getMode()}*\nAdmin: ${JSON.parse(fs.readFileSync(ADMIN)).length}`)
      }

      if (type === 'imageMessage') {
        const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: P({ level: 'silent' }) })
        const image = await Jimp.read(buffer)
        image.resize(300, 300)
        const qr = new QrCode()
        qr.callback = (err, v) => {
          if (err || !v?.result) return send('❌ QR gagal dibaca.')
          const [nama, kelas, tanggal] = v.result.split('|')
          if (!nama || !kelas || !tanggal) return send('❌ Format QR salah.')
          const waktu = new Date().toISOString()
          let db = []
          try {
            db = JSON.parse(fs.readFileSync(DB))
            if (!Array.isArray(db)) throw new Error()
          } catch { db = [] }
          db.push({ nama, kelas, waktu, sender: from })
          fs.writeFileSync(DB, JSON.stringify(db, null, 2))
          send(`✅ Absensi *${nama} (${kelas})* pada ${tanggal} dicatat.`)
        }
        qr.decode(image.bitmap)
      }
    })
  } catch (err) {
    console.error('❌ Bot error:', err)
    isConnecting = false
  }
}

startSocket()
app.listen(PORT, () => console.log(`🌐 Web aktif: http://localhost:${PORT}`))
