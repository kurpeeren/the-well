const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const path = require('path');
app.use(cors());
app.get('/', (req, res) => res.send('Kuyu Backend is running healthy!'));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kuyuadmin';

app.get('/api/admin/stats', (req, res) => {
    if (req.headers.authorization !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
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
            isDevMode: r.isDevMode,
            dayCount: r.dayCount,
            realPlayers: realPlayersCount,
            botPlayers: botPlayersCount,
            spectators: r.spectators.length,
            createdAt: r.createdAt,
            playersList: r.players.filter(p => !p.socketId.startsWith('dev_')).map(p => ({
                name: p.name,
                role: p.role,
                isAlive: p.isAlive
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

const supabase = require('./db');

app.get('/api/admin/history', async (req, res) => {
    if (req.headers.authorization !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { data, error } = await supabase
        .from('game_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = {};
const generateRoomCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const { ROLES } = require('./roles');
const GameEngine = require('./GameEngine');
const engine = new GameEngine(io, rooms);

function getActorId(room, socketId, impersonateId) {
   if (room.isDevMode && impersonateId && room.host === socketId) {
      return impersonateId;
   }
   return socketId;
}

io.on('connection', (socket) => {
  socket.on('createRoom', (playerName) => {
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
      doused: {},     
      silenced: {},  
      isDevMode: false,
      dayCount: 1,
      peacefulDays: 0,
      createdAt: Date.now(),
      spectators: [],
      settings: { nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30 }
    };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true, token, settings: rooms[roomCode].settings });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('createDevRoom', () => {
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
      doused: {},
      silenced: {},
      isDevMode: true,
      dayCount: 1,
      peacefulDays: 0,
      createdAt: Date.now(),
      spectators: [],
      settings: { nightTimer: 3, morningTimer: 3, dayTimer: 5, votingTimer: 3 }
    };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true, token: hostToken, isDevMode: true, settings: rooms[roomCode].settings });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('joinRoom', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return socket.emit('error', 'Oda bulunamadı.');
    if (rooms[roomCode].status !== 'LOBBY') return socket.emit('error', 'Oyun zaten başlamış.');
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

     player.connected = true;
     socket.join(roomCode);

     socket.emit('roomJoined', { roomCode, isHost: room.host === newId, settings: room.settings, isSpectator: false, token: token, reconnected: true });
     
     if (room.status === 'LOBBY') {
        io.to(roomCode).emit('updateLobby', room.players);
     } else {
        socket.emit('gameStarted', room.players);
        socket.emit('phaseChanged', { phase: room.status, timeRemaining: room.timeRemaining, dayCount: room.dayCount });
        io.to(roomCode).emit('updateLobby', room.players);
     }
  });

  socket.on('leaveRoom', ({ roomCode, token }) => {
     const room = rooms[roomCode];
     if (!room) return;
     const playerIndex = room.players.findIndex(p => p.token === token);
     if (playerIndex !== -1) {
        if (room.status === 'LOBBY') {
           const socketId = room.players[playerIndex].socketId;
           room.players.splice(playerIndex, 1);
           if (room.host === socketId && room.players.length > 0) room.host = room.players[0].socketId;
           io.to(roomCode).emit('updateLobby', room.players);
        } else {
           room.players[playerIndex].connected = false;
           io.to(roomCode).emit('updateLobby', room.players);
        }
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
      setTimeout(() => engine.changePhase(roomCode, 'NIGHT', room.settings.nightTimer), 5000);
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
           io.to(roomCode).emit('updateLobby', room.players);
        }
      }
    }
  });

  socket.on('chatMessage', ({ roomCode, message, impersonateId }) => {
    const room = rooms[roomCode];
    if(room && room.status === 'DAY') {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      if (player && player.isAlive) {
         if (room.silenced && room.silenced[actorId]) {
            engine.sendPrivateNews(roomCode, actorId, { text: "Tefeci seni susturduğu için konuşamazsın!", align: 'Kırmızı' });
            return;
         }
         io.to(roomCode).emit('chatMessage', { sender: player.name, message });
      }
    }
  });

  socket.on('deadChatMessage', ({ roomCode, message, impersonateId }) => {
    const room = rooms[roomCode];
    if(room) {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      if (player && !player.isAlive) {
         room.players.forEach(p => {
            if (!p.isAlive || p.role === 'Gassal') {
               engine.sendPrivateNews(roomCode, p.socketId, { text: `[Ölü] ${player.name}: ${message}`, align: 'Gri', isDeadChatEvent: true });
               socket.to(p.socketId).emit('deadChatMessage', { sender: `[Ölü] ${player.name}`, message });
            }
         });
         if (room.isDevMode) io.to(room.host).emit('deadChatMessage', { sender: `[Ölü] ${player.name}`, message });
      }
    }
  });

  socket.on('mayorReveal', ({ roomCode, impersonateId }) => {
    const room = rooms[roomCode];
    if(room && room.status === 'DAY') {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      if (player && player.role === 'Muhtar' && player.isAlive && !player.isMayorRevealed) {
         player.isMayorRevealed = true;
         io.to(roomCode).emit('mayorRevealed', { playerName: player.name });
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
     if (room && room.status === 'VOTING') {
       const actorId = getActorId(room, socket.id, impersonateId);
       const player = room.players.find(p => p.socketId === actorId);
       if(player && player.isAlive) {
         let voteWeight = player.isMayorRevealed ? 3 : 1;
         room.votes[actorId] = { targetId, weight: voteWeight };
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
     }
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`[*] Backend dev port ${PORT}`); });
