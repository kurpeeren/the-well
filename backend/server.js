const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = {};
const generateRoomCode = () => Math.floor(100000 + Math.random() * 900000).toString();

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
    rooms[roomCode] = {
      id: roomCode,
      players: [{ socketId: socket.id, name: playerName, role: null, isAlive: true, uses: 0, 
                  isMayorRevealed: false, execTarget: null }],
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
      spectators: [],
      settings: { nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30 }
    };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true, settings: rooms[roomCode].settings });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('createDevRoom', () => {
    const roomCode = generateRoomCode();
    let pool = [
      'Muhtar', 'Dedikoducu', 'Falcı', 'Gassal', 'Tefeci', 'Meyhaneci', 
      'Kan Davalı', 'Kundakçı', 'Yanaşma', 'Şifacı', 'Avcı', 'Bekçi', 
      'Münafık', 'Eşkıya', 'Eşkıya Başı', 'Seri Katil'
    ];
    let fakePlayers = [];
    pool.forEach((role, idx) => {
       fakePlayers.push({
          socketId: `dev_${idx}`, name: `Bot ${idx+1}`, role: role, 
          isAlive: true, uses: 0, isMayorRevealed: false, execTarget: null
       });
    });

    const exec = fakePlayers.find(p => p.role === 'Kan Davalı');
    if (exec) {
       const masumlar = fakePlayers.filter(p => ROLES[p.role]?.team === 'Köylüler');
       if (masumlar.length > 0) exec.execTarget = masumlar[0].socketId;
    }

    rooms[roomCode] = {
      id: roomCode, players: fakePlayers, host: socket.id, status: 'LOBBY', 
      id: roomCode, players: fakePlayers, host: socket.id, status: 'LOBBY', 
      timeRemaining: 0, nightActions: {}, votes: {}, deadJesterVotes: [],
      doused: {}, silenced: {}, isDevMode: true, dayCount: 1, spectators: [],
      settings: { nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30 }
    };
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: true, isDevMode: true, settings: rooms[roomCode].settings });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('joinRoom', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return socket.emit('error', 'Oda bulunamadı.');
    if (rooms[roomCode].status !== 'LOBBY') return socket.emit('error', 'Oyun zaten başlamış.');
    if (rooms[roomCode].players.length >= 16) return socket.emit('error', 'Oda dolu.');

    rooms[roomCode].players.push({ socketId: socket.id, name: playerName, role: null, isAlive: true, uses: 0, isMayorRevealed: false, execTarget: null });
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: false, settings: rooms[roomCode].settings, isSpectator: false });
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('joinAsSpectator', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return socket.emit('error', 'Oda bulunamadı.');
    
    if(!rooms[roomCode].spectators) rooms[roomCode].spectators = [];
    rooms[roomCode].spectators.push({ socketId: socket.id, name: playerName || 'İzleyici' });
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, isHost: false, settings: rooms[roomCode].settings, isSpectator: true, isDevMode: rooms[roomCode].isDevMode });
    // Lobbyi gunceller ama izleyiciler oyuncu listesinde gozukmez
    io.to(roomCode).emit('updateLobby', rooms[roomCode].players);
  });

  socket.on('updateSettings', ({ roomCode, settings }) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
       room.settings = settings;
       // to(roomCode) excluding sender
       socket.to(roomCode).emit('settingsUpdated', settings);
    }
  });

  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
      engine.assignRoles(room);
      room.status = 'GAME_STARTING';
      
      // executioner hedefleri socket event ile gitsin
      // Oyuncu listesi clienta gönderiyoruz
      io.to(roomCode).emit('gameStarted', room.players);
      
      // Kan Davalı (Executioner) Hedef Bilgilendirmesi İçin
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

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      
      // İzleyiciyi sil
      if (room.spectators) {
         const specIndex = room.spectators.findIndex(s => s.socketId === socket.id);
         if (specIndex !== -1) {
            room.spectators.splice(specIndex, 1);
            continue; // Player degilse diger checklere gecis i kolaylasitir
         }
      }

      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomCode).emit('updateLobby', room.players);
        if (room.players.length === 0) {
          clearInterval(room.timerInterval);
          delete rooms[roomCode];
        } else if (room.host === socket.id) {
          room.host = room.players[0].socketId;
          io.to(room.host).emit('hostChanged', true);
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
               // Custom prop `isDeadChatEvent` is better for frontend routing since it was io.to.emit directly
               socket.to(p.socketId).emit('deadChatMessage', { sender: `[Ölü] ${player.name}`, message });
            }
         });
         // In DevMode, send to host explicitly
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

  socket.on('votePlayer', ({ roomCode, targetId, impersonateId }) => {
     const room = rooms[roomCode];
     if (room && room.status === 'VOTING') {
       const actorId = getActorId(room, socket.id, impersonateId);
       const player = room.players.find(p => p.socketId === actorId);
       if(player && player.isAlive) {
         let voteWeight = player.isMayorRevealed ? 3 : 1;
         room.votes[actorId] = { targetId, weight: voteWeight };
         const currentCounts = {};
         const voteDetails = {}; // Kimin kime oy verdiğini tutan detay objesi
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
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`[*] Backend dev port ${PORT}`); });
