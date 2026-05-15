const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const voteLogic = require('./voteLogic');
const { pushChat, pushEvent } = require('./gameLog');

const app = express();
const path = require('path');
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.get('/', (req, res) => res.send('Kuyu Backend is running healthy!'));

// ─── Geri bildirim (feedback) — public endpoint, IP rate-limit + supabase'a yaz ───
const feedbackByIp = new Map(); // ip -> [timestamps]
app.post('/api/feedback', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const stamps = (feedbackByIp.get(ip) || []).filter(t => now - t < 60 * 60 * 1000); // son 1 saat

    if (stamps.length >= 5) {
        return res.status(429).json({ error: 'Bir saatte en fazla 5 geri bildirim. Bana abone gibi yazıyorsun :)' });
    }
    if (stamps.length > 0 && now - stamps[stamps.length - 1] < 60 * 1000) {
        return res.status(429).json({ error: 'Çok hızlı, lütfen 1 dakika bekle.' });
    }

    const name = String(req.body?.name || '').trim().slice(0, 50);
    const email = String(req.body?.email || '').trim().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    const gameState = String(req.body?.gameState || '').trim().slice(0, 20) || null;

    if (name.length < 1) return res.status(400).json({ error: 'İsim gerekli.' });
    if (message.length < 5) return res.status(400).json({ error: 'Mesaj en az 5 karakter olmalı.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'E-posta formatı geçersiz.' });
    }

    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    try {
        const supabase = require('./db');
        const { error } = await supabase.from('feedbacks').insert([{
            name, email: email || null, message, game_state: gameState, ip_hash: ipHash,
        }]);
        if (error) {
            console.error('[feedback] supabase error:', error);
            return res.status(500).json({ error: 'Kaydedilemedi, biraz sonra tekrar dene.' });
        }
        stamps.push(now);
        feedbackByIp.set(ip, stamps);
        res.json({ ok: true });
    } catch (e) {
        console.error('[feedback] error:', e);
        res.status(500).json({ error: 'Sunucu hatası.' });
    }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
    console.warn('[admin] UYARI: ADMIN_PASSWORD env değişkeni tanımlı değil — admin paneline erişim DEVRE DIŞI.');
}

// Sabit-zamanlı (timing-safe) şifre karşılaştırma — brute force timing attack'ı engeller
function checkAdminAuth(req) {
    if (!ADMIN_PASSWORD) return false;
    const provided = req.headers.authorization || '';
    const a = Buffer.from(provided);
    const b = Buffer.from(ADMIN_PASSWORD);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// Basit in-memory rate limiter: IP başına 60s pencerede 10 başarısız deneme = 5dk lock
const failedAttempts = new Map(); // ip -> { count, lockedUntil }
function rateLimit(req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil > now) return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
    return { allowed: true, ip, entry };
}
function recordFailedAuth(req) {
    const { ip, entry } = rateLimit(req);
    if (!ip) return;
    entry.count += 1;
    if (entry.count >= 10) {
        entry.lockedUntil = Date.now() + 5 * 60 * 1000;
        entry.count = 0;
    }
    failedAttempts.set(ip, entry);
}

// Server health & traffic metrics
const startTime = Date.now();
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();
const metrics = {
    socketEmitCount: 0,
    socketReceiveCount: 0,
    errorCount: 0,
    adminAuthFailures: 0,
};

// ─── Tarihsel metrikler — halka tampon + diske JSON kalıcılığı (1 hafta) ───
const fs = require('fs');
const METRICS_FILE = path.join(__dirname, '.metrics-history.json');
const METRICS_SAMPLE_MS = 30 * 1000;           // 30s'de bir örnek
const METRICS_MAX_SAMPLES = 7 * 24 * 60 * 2;   // 1 hafta = 20160 örnek (~1MB JSON)
const metricsRing = [];
let metricsRingCpuBase = process.cpuUsage();
let metricsRingCpuTime = Date.now();

function loadMetricsHistory() {
    try {
        const raw = fs.readFileSync(METRICS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            metricsRing.push(...data.filter(s => s.ts >= cutoff));
            console.log(`[metrics] ${metricsRing.length} geçmiş örnek yüklendi`);
        }
    } catch { /* ilk açılış veya bozuk dosya — sessizce geç */ }
}
function persistMetricsHistory() {
    fs.writeFile(METRICS_FILE, JSON.stringify(metricsRing), () => {});
}
function sampleMetrics() {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuDiff = process.cpuUsage(metricsRingCpuBase);
    const elapsed = now - metricsRingCpuTime;
    const cpuPct = elapsed > 0 ? ((cpuDiff.user + cpuDiff.system) / 1000 / elapsed * 100) : 0;
    metricsRingCpuBase = process.cpuUsage();
    metricsRingCpuTime = now;

    // Ortalama ping — pingMap'teki tüm RTT'lerin ortalaması
    let avgPing = null;
    if (pingMap && pingMap.size > 0) {
        let sum = 0, count = 0;
        for (const v of pingMap.values()) {
            if (v?.ms != null) { sum += v.ms; count++; }
        }
        if (count > 0) avgPing = Math.round(sum / count);
    }

    metricsRing.push({
        ts: now,
        cpu: +cpuPct.toFixed(1),
        heapMB: +(memUsage.heapUsed / 1024 / 1024).toFixed(1),
        rssMB: +(memUsage.rss / 1024 / 1024).toFixed(1),
        sockets: io.engine.clientsCount,
        rooms: Object.keys(rooms).length,
        avgPing,
    });
    while (metricsRing.length > METRICS_MAX_SAMPLES) metricsRing.shift();
}
loadMetricsHistory();
setInterval(sampleMetrics, METRICS_SAMPLE_MS);
setInterval(persistMetricsHistory, 60 * 1000);  // 1dk'da bir diske yaz
process.on('SIGTERM', persistMetricsHistory);
process.on('SIGINT', persistMetricsHistory);

function adminAuth(req, res, next) {
    const rl = rateLimit(req);
    if (!rl.allowed) {
        res.set('Retry-After', String(rl.retryAfter));
        return res.status(429).json({ error: 'Rate limited', retryAfter: rl.retryAfter });
    }
    if (!checkAdminAuth(req)) {
        recordFailedAuth(req);
        metrics.adminAuthFailures += 1;
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/api/admin/stats', adminAuth, (req, res) => {
    const roomKeys = Object.keys(rooms);
    let totalRealPlayers = 0;

    const roomsData = roomKeys.map(key => {
        const r = rooms[key];
        const realPlayersCount = r.players.filter(p => !p.socketId.startsWith('dev_')).length;
        const botPlayersCount = r.players.filter(p => p.socketId.startsWith('dev_')).length;
        totalRealPlayers += realPlayersCount;

        return {
            id: r.id,
            status: r.status,
            phase: r.phase || null,
            timeRemaining: r.timeRemaining || 0,
            isDevMode: r.isDevMode,
            dayCount: r.dayCount,
            realPlayers: realPlayersCount,
            botPlayers: botPlayersCount,
            spectators: r.spectators.length,
            createdAt: r.createdAt,
            lastActivity: r.lastActivity,
            host: r.host,
            playersList: r.players.filter(p => !p.socketId.startsWith('dev_')).map(p => ({
                socketId: p.socketId,
                name: p.name,
                role: p.role,
                isAlive: p.isAlive,
                connected: p.connected,
                ping: pingMap.get(p.socketId) || null,
            }))
        };
    });

    res.json({
        totalRooms: roomKeys.length,
        totalRealPlayers,
        totalSockets: io.engine.clientsCount,
        rooms: roomsData
    });
});

// Server health metrics — CPU, memory, uptime, traffic
app.get('/api/admin/health', adminAuth, (req, res) => {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuDiff = process.cpuUsage(lastCpuUsage);
    const elapsedMs = now - lastCpuTime;
    const cpuPercent = elapsedMs > 0
        ? ((cpuDiff.user + cpuDiff.system) / 1000) / elapsedMs * 100
        : 0;
    lastCpuUsage = process.cpuUsage();
    lastCpuTime = now;

    res.json({
        uptimeSeconds: Math.floor((now - startTime) / 1000),
        memory: {
            rssMB: +(memUsage.rss / 1024 / 1024).toFixed(1),
            heapUsedMB: +(memUsage.heapUsed / 1024 / 1024).toFixed(1),
            heapTotalMB: +(memUsage.heapTotal / 1024 / 1024).toFixed(1),
            externalMB: +(memUsage.external / 1024 / 1024).toFixed(1),
        },
        cpuPercent: +cpuPercent.toFixed(1),
        traffic: {
            emitCount: metrics.socketEmitCount,
            receiveCount: metrics.socketReceiveCount,
        },
        errorCount: metrics.errorCount,
        adminAuthFailures: metrics.adminAuthFailures,
        totalSockets: io.engine.clientsCount,
        totalRooms: Object.keys(rooms).length,
        nodeVersion: process.version,
        platform: process.platform,
    });
});

// Tarihsel metrikler — Saat/Gün/Hafta görünümü için
app.get('/api/admin/metrics', adminAuth, (req, res) => {
    const range = req.query.range || 'hour';
    const now = Date.now();
    let cutoff = 0;
    let maxPoints = 200;  // Frontend'e gönderilen örnek sayısı — chart için makul
    if (range === 'hour') { cutoff = now - 60 * 60 * 1000; maxPoints = 120; }
    else if (range === 'day') { cutoff = now - 24 * 60 * 60 * 1000; maxPoints = 200; }
    else if (range === 'week') { cutoff = now - 7 * 24 * 60 * 60 * 1000; maxPoints = 240; }

    const filtered = metricsRing.filter(s => s.ts >= cutoff);
    // Downsample — fazla nokta UI'ı yavaşlatır
    let sampled = filtered;
    if (filtered.length > maxPoints) {
        const stride = Math.ceil(filtered.length / maxPoints);
        sampled = filtered.filter((_, i) => i % stride === 0);
    }
    res.json({ range, count: sampled.length, samples: sampled });
});

// Admin aksiyon: oda kapat
app.post('/api/admin/rooms/:code/close', adminAuth, (req, res) => {
    const code = req.params.code;
    const room = rooms[code];
    if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });
    io.to(code).emit('error', 'Oda yönetici tarafından kapatıldı.');
    io.to(code).emit('returnedToLobby');
    if (room.timer) clearInterval(room.timer);
    delete rooms[code];
    console.log(`[admin] Oda ${code} kapatıldı`);
    res.json({ ok: true });
});

// Admin aksiyon: oyuncu at
app.post('/api/admin/rooms/:code/kick', adminAuth, (req, res) => {
    const code = req.params.code;
    const { socketId } = req.body || {};
    const room = rooms[code];
    if (!room) return res.status(404).json({ error: 'Oda bulunamadı' });
    if (!socketId) return res.status(400).json({ error: 'socketId gerekli' });

    const idx = room.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return res.status(404).json({ error: 'Oyuncu odada değil' });

    const playerName = room.players[idx].name;
    room.players.splice(idx, 1);
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
        targetSocket.emit('error', 'Yönetici tarafından odadan atıldın.');
        targetSocket.leave(code);
    }
    io.to(code).emit('updateLobby', room.players);
    console.log(`[admin] ${playerName} (${socketId}) ${code} odasından atıldı`);
    res.json({ ok: true });
});

// Admin aksiyon: tüm aktif odalara duyuru
app.post('/api/admin/broadcast', adminAuth, (req, res) => {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || message.length > 280) {
        return res.status(400).json({ error: 'Geçerli mesaj gerekli (max 280 karakter)' });
    }
    io.emit('adminBroadcast', { message, timestamp: Date.now() });
    console.log(`[admin] Duyuru gönderildi: ${message}`);
    res.json({ ok: true, deliveredTo: io.engine.clientsCount });
});

const supabase = require('./db');

app.get('/api/admin/feedbacks', adminAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    try {
        const supabase = require('./db');
        const { data, error, count } = await supabase
            .from('feedbacks')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            console.error('[admin/feedbacks] supabase error:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json({ items: data || [], total: count || 0, limit, offset });
    } catch (e) {
        console.error('[admin/feedbacks] error:', e);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.get('/api/admin/history', adminAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const { data, error } = await supabase
        .from('game_history')
        .select('id,created_at,room_code,game_mode,winner,players,deaths')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

app.get('/api/admin/history/:id/logs', adminAuth, async (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id || id.length > 64) return res.status(400).json({ error: 'Geçersiz id' });
    const { data, error } = await supabase
        .from('game_history')
        .select('chat_log,event_log')
        .eq('id', id)
        .single();
    if (error) {
        return res.json({ chat_log: [], event_log: [] });
    }
    res.json({ chat_log: data?.chat_log || [], event_log: data?.event_log || [] });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    // Ping interval kısa (hızlı RTT örnekleme) ama timeout uzun:
    // mobil oyuncu uygulama değiştirip dönerken offline işaretlenmesin (1-2dk tolerans)
    pingInterval: 20000,   // 20s'de bir ping
    pingTimeout: 90000,    // 90s pong beklenir → toplam ~90-110s'de offline tespiti
    // Sadece WebSocket — long-polling upgrade adımını atla (ilk bağlantı 30-50ms hızlanır)
    transports: ['websocket'],
    // Sıkıştırma — büyük payload'larda etkin, küçük olanlarda bypass
    perMessageDeflate: { threshold: 1024 },
});

const rooms = {};
// Karışan harfler/rakamlar çıkarıldı: 0/O, 1/I/L, B/8 (B bırakıldı), S/5 (ikisi de)
// Excluded: 0, 1, I, L, O — toplam 31 karakter, 6 hane ≈ 887M kombinasyon
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generateRoomCode = () => {
    let result = '';
    for (let i = 0; i < 6; i++) result += ROOM_CODE_ALPHABET.charAt(Math.floor(Math.random() * ROOM_CODE_ALPHABET.length));
    // Eğer çakışırsa (çok düşük ihtimal) yeniden üret
    if (rooms[result]) return generateRoomCode();
    return result;
};
const generateToken = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Simple rate limiter map: socketId -> lastMessageTime
const chatRateLimitMap = {};

const { ROLES } = require('./roles');
const GameEngine = require('./GameEngine');
const engine = new GameEngine(io, rooms);

function getActorId(room, socketId, impersonateId) {
   if (room.isDevMode && impersonateId && room.host === socketId) {
      return impersonateId;
   }
   return socketId;
}

function emitVoteCounts(roomCode) {
   const room = rooms[roomCode];
   if (!room) return;
   const currentCounts = {};
   const voteDetails = {};
   for (const v in room.votes) {
      const t = room.votes[v].targetId;
      const voterName = room.players.find(p => p.socketId === v)?.name;
      voteDetails[voterName] = t;
      currentCounts[t] = (currentCounts[t] || 0) + room.votes[v].weight;
   }
   io.to(roomCode).emit('voteCounts', { counts: currentCounts, details: voteDetails });
}

function emitJudgmentCounts(roomCode) {
   const room = rooms[roomCode];
   if (!room) return;
   let guiltyW = 0, spareW = 0;
   const details = {};
   for (const v in (room.judgmentVotes || {})) {
      const jv = room.judgmentVotes[v];
      const voterName = room.players.find(p => p.socketId === v)?.name;
      details[voterName] = jv.verdict;
      if (jv.verdict === 'GUILTY') guiltyW += (jv.weight || 0); else if (jv.verdict === 'SPARE') spareW += (jv.weight || 0);
   }
   io.to(roomCode).emit('judgmentCounts', { guiltyW, spareW, details });
}

// Per-socket ping tracking (manuel RTT — Socket.IO yerleşik pingi latency expose etmiyor)
const pingMap = new Map(); // socketId -> { ms, ts }
const pingPending = new Map(); // socketId -> sendTimestamp
function startPingTracking(socket) {
    const interval = setInterval(() => {
        if (!io.sockets.sockets.has(socket.id)) {
            clearInterval(interval);
            return;
        }
        const ts = Date.now();
        pingPending.set(socket.id, ts);
        socket.emit('adminPing', ts);
    }, 5000);
    socket.on('disconnect', () => {
        clearInterval(interval);
        pingMap.delete(socket.id);
        pingPending.delete(socket.id);
    });
    socket.on('adminPong', (ts) => {
        const sent = pingPending.get(socket.id);
        if (sent && sent === ts) {
            pingMap.set(socket.id, { ms: Date.now() - sent, ts: Date.now() });
            pingPending.delete(socket.id);
        }
    });
}

// Traffic metrics — emit ve receive sayaçları
const _origIoEmit = io.emit.bind(io);
io.emit = (...args) => { metrics.socketEmitCount += 1; return _origIoEmit(...args); };

io.on('connection', (socket) => {
  startPingTracking(socket);

  // Her gelen event'i say
  socket.onAny(() => { metrics.socketReceiveCount += 1; });

  // Per-socket emit sayacı için override
  const _socketEmit = socket.emit.bind(socket);
  socket.emit = (...args) => { metrics.socketEmitCount += 1; return _socketEmit(...args); };

  socket.on('createRoom', (playerName) => {
    const existingRoom = Object.values(rooms).find(r => r.host === socket.id && r.status === 'LOBBY');
    if (existingRoom) {
      const hostPlayer = existingRoom.players.find(p => p.socketId === socket.id);
      socket.emit('roomJoined', { roomCode: existingRoom.id, isHost: true, token: hostPlayer?.token, settings: existingRoom.settings, isDevMode: existingRoom.isDevMode });
      return;
    }
    const roomCode = generateRoomCode();
    const token = generateToken();
    rooms[roomCode] = {
      id: roomCode,
      players: [{ socketId: socket.id, token, name: playerName, role: null, isAlive: true, uses: 0, 
                  isMayorRevealed: false, execTarget: null, connected: true }],
      host: socket.id,
      status: 'LOBBY', 
      timeRemaining: 0,
      nightActions: {},
      votes: {},
      deadJesterVotes: [],
      chatLog: [],
      eventLog: [],
      dayRemaining: 0,
      trial: null,
      judgmentVotes: {},
      acquittedToday: [],
      doused: {},
      silenced: {},
      isDevMode: false,
      dayCount: 1,
      peacefulDays: 0,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      spectators: [],
      settings: { nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30, defenseTimer: 60 }
    };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true, token, settings: rooms[roomCode].settings });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('createDevRoom', () => {
    const existingRoom = Object.values(rooms).find(r => r.host === socket.id && r.status === 'LOBBY');
    if (existingRoom) {
      const hostPlayer = existingRoom.players.find(p => p.socketId === socket.id);
      socket.emit('roomJoined', { roomCode: existingRoom.id, isHost: true, token: hostPlayer?.token, settings: existingRoom.settings, isDevMode: existingRoom.isDevMode });
      return;
    }
    const roomCode = generateRoomCode();
    const hostToken = generateToken();
    let pool = [
      'Muhtar', 'Gözcü', 'Falcı', 'Gassal', 'Tefeci', 'Meyhaneci', 
      'Kan Davalı', 'Kundakçı', 'Kaçak', 'Şifacı', 'Avcı', 'Bekçi', 
      'Münafık', 'Eşkıya', 'Eşkıya Başı', 'Seri Katil'
    ];
    
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    let fakePlayers = [];
    console.log('[Dev] Karıştırılmış roller:', pool.join(', '));
    pool.forEach((role, idx) => {
       fakePlayers.push({
          socketId: idx === 0 ? socket.id : `dev_${idx}`, 
          token: idx === 0 ? hostToken : generateToken(),
          name: idx === 0 ? 'Dev Host' : `Bot ${idx}`, role: role, 
          isAlive: true, uses: 0, isMayorRevealed: false, execTarget: null, connected: true
       });
    });

    const exec = fakePlayers.find(p => p.role === 'Kan Davalı');
    if (exec) {
       // Dev Host (socket.id) ve Kan Davalı'nın kendisini hariç tut
       const masumlar = fakePlayers.filter(p => 
           ROLES[p.role]?.team === 'Köylüler' && 
           p.socketId !== exec.socketId &&
           p.socketId !== socket.id  // Dev Host hiçbir zaman hedef olmasın
       );
       if (masumlar.length > 0) {
           const randomMasum = masumlar[Math.floor(Math.random() * masumlar.length)];
           exec.execTarget = randomMasum.socketId;
       }
    }

    rooms[roomCode] = {
      id: roomCode,
      players: fakePlayers,
      host: socket.id,
      status: 'LOBBY',
      timeRemaining: 0,
      nightActions: {},
      votes: {},
      deadJesterVotes: [],
      chatLog: [],
      eventLog: [],
      dayRemaining: 0,
      trial: null,
      judgmentVotes: {},
      acquittedToday: [],
      doused: {},
      silenced: {},
      isDevMode: true,
      dayCount: 1,
      peacefulDays: 0,
      createdAt: Date.now(),
      spectators: [],
      settings: { nightTimer: 30, morningTimer: 10, dayTimer: 45, votingTimer: 25, defenseTimer: 60 }
    };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true, token: hostToken, isDevMode: true, settings: rooms[roomCode].settings });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('joinRoom', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return socket.emit('error', 'Oda bulunamadı.');
    if (rooms[roomCode].status !== 'LOBBY') return socket.emit('error', 'Oyun zaten başlamış.');

    const existing = rooms[roomCode].players.find(p => p.socketId === socket.id);
    if (existing) {
      socket.join(roomCode);
      socket.emit('roomJoined', { roomCode, isHost: rooms[roomCode].host === socket.id, token: existing.token, settings: rooms[roomCode].settings, isSpectator: false });
      return;
    }

    if (rooms[roomCode].players.length >= 16) return socket.emit('error', 'Oda dolu.');

    const token = generateToken();
    rooms[roomCode].players.push({ socketId: socket.id, token, name: playerName, role: null, isAlive: true, uses: 0, isMayorRevealed: false, execTarget: null, connected: true });
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: false, token, settings: rooms[roomCode].settings, isSpectator: false });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('joinAsSpectator', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return socket.emit('error', 'Oda bulunamadı.');

    if(!rooms[roomCode].spectators) rooms[roomCode].spectators = [];

    if (rooms[roomCode].spectators.some(s => s.socketId === socket.id)) {
      socket.join(roomCode);
      socket.emit('roomJoined', { roomCode, isHost: false, settings: rooms[roomCode].settings, isSpectator: true, isDevMode: rooms[roomCode].isDevMode });
      return;
    }

    rooms[roomCode].spectators.push({ socketId: socket.id, name: playerName || 'İzleyici' });
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: false, settings: rooms[roomCode].settings, isSpectator: true, isDevMode: rooms[roomCode].isDevMode });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('reconnectRoom', ({ roomCode, token }) => {
     const room = rooms[roomCode];
     if (!room) return socket.emit('reconnectFailed');
     const player = room.players.find(p => p.token === token);
     if (!player) return socket.emit('reconnectFailed');

     const oldId = player.socketId;
     const newId = socket.id;

     if (room.host === oldId) room.host = newId;
     room.players.forEach(p => {
        if (p.socketId === oldId) p.socketId = newId;
        if (p.execTarget === oldId) p.execTarget = newId;
     });
     if (room.doused[oldId]) { room.doused[newId] = room.doused[oldId]; delete room.doused[oldId]; }
     if (room.silenced[oldId]) { room.silenced[newId] = room.silenced[oldId]; delete room.silenced[oldId]; }
     if (room.votes[oldId]) { room.votes[newId] = room.votes[oldId]; delete room.votes[oldId]; }
     for (let v in room.votes) {
        if (room.votes[v].targetId === oldId) room.votes[v].targetId = newId;
     }
     if (room.nightActions[oldId]) { 
        room.nightActions[newId] = room.nightActions[oldId]; 
        room.nightActions[newId].actorId = newId;
        delete room.nightActions[oldId]; 
     }
     for (let a in room.nightActions) {
        if (room.nightActions[a].targetId === oldId) room.nightActions[a].targetId = newId;
     }
     const idx = room.deadJesterVotes.indexOf(oldId);
     if (idx !== -1) room.deadJesterVotes[idx] = newId;
     if (room.trial && room.trial.accusedId === oldId) room.trial.accusedId = newId;
     if (room.judgmentVotes && room.judgmentVotes[oldId]) { room.judgmentVotes[newId] = room.judgmentVotes[oldId]; delete room.judgmentVotes[oldId]; }
     if (Array.isArray(room.acquittedToday)) { const _ai = room.acquittedToday.indexOf(oldId); if (_ai !== -1) room.acquittedToday[_ai] = newId; }

     player.connected = true;
     socket.join(roomCode);

     socket.emit('roomJoined', { roomCode, isHost: room.host === newId, settings: room.settings, isSpectator: false, token: token, reconnected: true });
     
     if (room.status === 'LOBBY') {
        io.to(roomCode).emit('updateLobby', room.players);
     } else {
        socket.emit('gameStarted', room.players);
        socket.emit('phaseChanged', { phase: room.status, timeRemaining: room.timeRemaining, dayCount: room.dayCount, trial: room.trial ? { accusedId: room.trial.accusedId, accusedName: room.trial.accusedName } : null });
        io.to(roomCode).emit('updateLobby', room.players);
     }
  });

  socket.on('leaveRoom', ({ roomCode, token }) => {
     const room = rooms[roomCode];
     if (!room) return;
     const playerIndex = room.players.findIndex(p => p.token === token);
     if (playerIndex !== -1) {
        const socketId = room.players[playerIndex].socketId;
        if (room.status === 'LOBBY') {
           room.players.splice(playerIndex, 1);
           if (room.host === socketId && room.players.length > 0) room.host = room.players[0].socketId;
        } else {
           room.players[playerIndex].connected = false;
           if (room.host === socketId) {
               const nextHost = room.players.find(p => p.connected);
               if (nextHost) room.host = nextHost.socketId;
           }
        }
        io.to(roomCode).emit('updateLobby', room.players);
     }
  });

  socket.on('updateSettings', ({ roomCode, settings }) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
       room.settings = settings;
       socket.to(roomCode).emit('settingsUpdated', settings);
    }
  });

  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
      engine.assignRoles(room);
      room.chatLog = [];
      room.eventLog = [];
      room.status = 'GAME_STARTING';
      io.to(roomCode).emit('gameStarted', room.players);
      
      room.players.forEach(p => {
         if (p.role === 'Kan Davalı' && p.execTarget) {
            const t = room.players.find(x => x.socketId === p.execTarget);
            if(t) {
               engine.sendPrivateNews(roomCode, p.socketId, { 
                  text: `Senin kan hasımın: ${t.name}. Ne yap ne et onu kuyuya attır!`, 
                  align: 'Kırmızı' 
               });
            }
         }
      });
      setTimeout(() => engine.changePhase(roomCode, 'DAY', room.settings.dayTimer), 5000);
    }
  });

  socket.on('forceNextPhase', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.isDevMode && room.host === socket.id && room.timerInterval && room.status !== 'GAME_STARTING' && room.status !== 'END') {
       clearInterval(room.timerInterval);
       engine.processPhaseEnd(roomCode, room.status);
    }
  });

  socket.on('returnToLobby', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id && room.status === 'END') {
       room.status = 'LOBBY';
       room.dayCount = 1;
       room.timeRemaining = 0;
       room.peacefulDays = 0;
       room.createdAt = Date.now();
       room.nightActions = {};
       room.votes = {};
       room.deadJesterVotes = [];
       room.doused = {};
       room.silenced = {};
       room.skipDayVotes = [];
       room.dayRemaining = 0;
       room.trial = null;
       room.judgmentVotes = {};
       room.acquittedToday = [];
       room.chatLog = [];
       room.eventLog = [];
       room.players.forEach(p => {
           p.role = null;
           p.isAlive = true;
           p.uses = 0;
           p.isMayorRevealed = false;
           p.execTarget = null;
           p.won = false;
       });
       io.to(roomCode).emit('returnedToLobby');
       io.to(roomCode).emit('updateLobby', room.players);
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.spectators) {
         const specIndex = room.spectators.findIndex(s => s.socketId === socket.id);
         if (specIndex !== -1) {
            room.spectators.splice(specIndex, 1);
            continue;
         }
      }
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        if (room.status === 'LOBBY') {
           room.players.splice(playerIndex, 1);
           io.to(roomCode).emit('updateLobby', room.players);
           if (room.players.length === 0) {
             clearInterval(room.timerInterval);
             delete rooms[roomCode];
           } else if (room.host === socket.id) {
             room.host = room.players[0].socketId;
             io.to(room.host).emit('hostChanged', true);
           }
        } else {
           room.players[playerIndex].connected = false;
           if (room.host === socket.id) {
               const nextHost = room.players.find(p => p.connected);
               if (nextHost) {
                   room.host = nextHost.socketId;
                   io.to(room.host).emit('hostChanged', true);
               }
           }
           io.to(roomCode).emit('updateLobby', room.players);
        }
      }
    }
  });

  socket.on('chatMessage', ({ roomCode, message, impersonateId }) => {
    const now = Date.now();
    if (chatRateLimitMap[socket.id] && now - chatRateLimitMap[socket.id] < 500) return;
    chatRateLimitMap[socket.id] = now;

    const room = rooms[roomCode];
    if (room && (room.status === 'DAY' || room.status === 'JUDGMENT' || (room.status === 'DEFENSE' && room.trial))) {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      if (room.status === 'DEFENSE' && actorId !== room.trial.accusedId) return; // savunmada yalnız sanık
      if (player && player.isAlive) {
         if (room.silenced && room.silenced[actorId]) {
            engine.sendPrivateNews(roomCode, actorId, { text: "Tefeci seni susturduğu için konuşamazsın!", align: 'Kırmızı' });
            return;
         }
         io.to(roomCode).emit('chatMessage', { sender: player.name, message, ts: now });
         pushChat(room, { ch: 'day', sender: player.name, msg: String(message).slice(0, 1000), day: room.dayCount, phase: room.status, ts: now });
      }
    }
  });

  socket.on('deadChatMessage', ({ roomCode, message, impersonateId }) => {
    const now = Date.now();
    if (chatRateLimitMap[socket.id] && now - chatRateLimitMap[socket.id] < 500) return;
    chatRateLimitMap[socket.id] = now;

    const room = rooms[roomCode];
    if(room) {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      // Gassal hayatta olsa bile ölüler boyutuna mesaj gönderebilir
      if (player && (!player.isAlive || player.role === 'Gassal')) {
         const senderLabel = player.role === 'Gassal' && player.isAlive ? `[Gassal] ${player.name}` : `[Ölü] ${player.name}`;
         room.players.forEach(p => {
            if (!p.isAlive || p.role === 'Gassal') {
               io.to(p.socketId).emit('chatMessage', { sender: senderLabel, message, type: 'dead', ts: now });
            }
         });
         if (room.isDevMode) io.to(room.host).emit('chatMessage', { sender: senderLabel, message, type: 'dead', ts: now });
         pushChat(room, { ch: 'dead', sender: senderLabel, msg: String(message).slice(0, 1000), day: room.dayCount, phase: room.status, ts: now });
      }
    }
  });

  // Çete chat her fazda açık. Sadece ALIVE eşkıya yazabilir; ölü eşkıya
  // READ-ONLY olarak alır (kendi takım sohbetini izler ama yazamaz).
  socket.on('mafiaChatMessage', ({ roomCode, message, impersonateId }) => {
    const now = Date.now();
    if (chatRateLimitMap[socket.id] && now - chatRateLimitMap[socket.id] < 500) return;
    chatRateLimitMap[socket.id] = now;

    const room = rooms[roomCode];
    if(room) {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      // Yazma izni: yalnız hayatta eşkıya
      if (player && player.isAlive && ROLES[player.role]?.team === 'Eşkıyalar') {
         // Okuma kapsamı: tüm eşkıyalar (hayatta + ölü) — ölü ex-çete üyesi de izler
         room.players.forEach(p => {
            if (ROLES[p.role]?.team === 'Eşkıyalar') {
               io.to(p.socketId).emit('chatMessage', { sender: `[Çete] ${player.name}`, message, type: 'mafia', ts: now });
            }
         });
         if (room.isDevMode) io.to(room.host).emit('chatMessage', { sender: `[Çete] ${player.name}`, message, type: 'mafia', ts: now });
         pushChat(room, { ch: 'mafia', sender: `[Çete] ${player.name}`, msg: String(message).slice(0, 1000), day: room.dayCount, phase: room.status, ts: now });
      }
    }
  });

  socket.on('mayorReveal', ({ roomCode, impersonateId }) => {
    const room = rooms[roomCode];
    if(room && room.status === 'DAY') {
      const actorId = getActorId(room, socket.id, impersonateId);
      if (room.silenced && room.silenced[actorId]) return; // Exploit önlemi: Susturulmuş muhtar mührünü vuramaz
      const player = room.players.find(p => p.socketId === actorId);
      if (player && player.role === 'Muhtar' && player.isAlive && !player.isMayorRevealed) {
         player.isMayorRevealed = true;
         player.uses = 1; // 1 = Has Vest, 0 = Used Vest or None
         io.to(roomCode).emit('mayorRevealed', { playerName: player.name });
         pushEvent(room, { type: 'mayor', text: `${player.name} Muhtar olduğunu açıkladı`, day: room.dayCount, phase: room.status, ts: Date.now(), meta: { name: player.name } });
      }
    }
  });

  socket.on('nightAction', ({ roomCode, actionObj, impersonateId }) => {
     const room = rooms[roomCode];
     if (room && room.status === 'NIGHT') {
       const actorId = getActorId(room, socket.id, impersonateId);
       const player = room.players.find(p => p.socketId === actorId);
       if (player && player.isAlive) {
         room.nightActions[actorId] = { ...actionObj, role: player.role, actorId: actorId };
       }
     }
  });

  socket.on('skipDayVote', ({ roomCode, impersonateId }) => {
     const room = rooms[roomCode];
     if (room && room.status === 'DAY') {
       const actorId = getActorId(room, socket.id, impersonateId);
       const player = room.players.find(p => p.socketId === actorId);
       if (!room.skipDayVotes) room.skipDayVotes = [];
       if (player && player.isAlive && !room.skipDayVotes.includes(actorId)) {
          room.skipDayVotes.push(actorId);
          const alivePlayersCount = room.players.filter(p => p.isAlive && p.connected).length;
          io.to(roomCode).emit('skipDayUpdate', { count: room.skipDayVotes.length, total: alivePlayersCount });
          
          if (room.skipDayVotes.length >= alivePlayersCount) {
             if (room.timerInterval) clearInterval(room.timerInterval);
             engine.processPhaseEnd(roomCode, 'DAY');
          }
       }
     }
   });

  socket.on('votePlayer', ({ roomCode, targetId, impersonateId }) => {
     const room = rooms[roomCode];
     if (!(room && room.status === 'DAY')) return;        // oy yalnız gündüz; mahkemede kilitli
     const actorId = getActorId(room, socket.id, impersonateId);
     const player = room.players.find(p => p.socketId === actorId);
     if (!(player && player.isAlive)) return;
     if (targetId === actorId) return;                     // kendine oy verilemez
     const voteWeight = voteLogic.weightFor(player);
     room.votes[actorId] = { targetId, weight: voteWeight };
     emitVoteCounts(roomCode);

     const aliveCount = room.players.filter(p => p.isAlive).length;
     const nomineeId = voteLogic.findNominee(room.votes, aliveCount);
     if (nomineeId && nomineeId !== 'SKIP'
         && !(room.acquittedToday || []).includes(nomineeId)
         && room.players.find(p => p.socketId === nomineeId && p.isAlive)) {
        engine.startDefense(roomCode, nomineeId);          // startDefense kendi içinde status==='DAY' guard'lı
     }
  });

  socket.on('withdrawVote', ({ roomCode, impersonateId }) => {
     const room = rooms[roomCode];
     if (!room) return;
     const actorId = getActorId(room, socket.id, impersonateId);
     if (room.status === 'DAY') {
        if (room.votes[actorId]) { delete room.votes[actorId]; emitVoteCounts(roomCode); }
     } else if (room.status === 'JUDGMENT') {
        if (room.judgmentVotes && room.judgmentVotes[actorId]) {
           delete room.judgmentVotes[actorId];
           emitJudgmentCounts(roomCode);
        }
     }
  });

  socket.on('judgmentVote', ({ roomCode, verdict, impersonateId }) => {
     const room = rooms[roomCode];
     if (!(room && room.status === 'JUDGMENT' && room.trial)) return;
     if (verdict !== 'GUILTY' && verdict !== 'SPARE') return;
     const actorId = getActorId(room, socket.id, impersonateId);
     if (actorId === room.trial.accusedId) return;         // sanık oy veremez
     const player = room.players.find(p => p.socketId === actorId);
     if (!(player && player.isAlive)) return;
     if (!room.judgmentVotes) room.judgmentVotes = {};
     room.judgmentVotes[actorId] = { verdict, weight: voteLogic.weightFor(player) };
     emitJudgmentCounts(roomCode);
  });

  socket.on('savePersonalNote', ({ roomCode, note, impersonateId }) => {
     const room = rooms[roomCode];
     if (room) {
        const actorId = getActorId(room, socket.id, impersonateId);
        const player = room.players.find(p => p.socketId === actorId);
        if (player) {
           player.personalNote = note;
        }
     }
  });

});

// Garbage Collector: Remove old inactive rooms to prevent memory leaks
setInterval(() => {
   const now = Date.now();
   const THREE_HOURS = 3 * 60 * 60 * 1000;
   let deletedCount = 0;
   
   for (const roomCode in rooms) {
      const room = rooms[roomCode];
      // Oda 3 saatten eskiyse ve (LOBBY veya END durumundaysa ya da aktif kimse yoksa) sil
      if (now - room.createdAt > THREE_HOURS) {
         if (room.timerInterval) clearInterval(room.timerInterval);
         delete rooms[roomCode];
         deletedCount++;
      }
   }
   if (deletedCount > 0) {
      console.log(`[GC] Temizlendi: ${deletedCount} adet hayalet oda silindi. Mevcut oda sayısı: ${Object.keys(rooms).length}`);
   }
}, 60 * 60 * 1000); // Saatte bir çalışır

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`[*] Backend dev port ${PORT}`); });
