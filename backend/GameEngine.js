const { ROLES, getColorAlignment, getInvestResults, getProphecy } = require('./roles');
const voteLogic = require('./voteLogic');
const { pushEvent } = require('./gameLog');

class GameEngine {
  constructor(io, rooms) {
    this.io = io;
    this.rooms = rooms;
  }

  sendPrivateNews(roomCode, playerId, messageObj) {
    const room = this.rooms[roomCode];
    if (!room) return;
    if (room.isDevMode && playerId.startsWith('dev_')) {
        const p = room.players.find(x => x.socketId === playerId);
        const taggedMsg = { ...messageObj, text: `[${p ? p.name : 'Bot'}] ${messageObj.text}` };
        this.io.to(room.host).emit('privateNews', taggedMsg);
    } else {
        this.io.to(playerId).emit('privateNews', messageObj);
    }
  }

  assignRoles(room) {
    const count = room.players.length;

    // Ozel mod: Deli Koyu — 1 Seri Katil + 1 rastgele gercek masum + geri kalan Deli.
    // Tum oyuncular bilgi rolu sandiklari kostum giyer; gercek bilgi yalnizca tek masumda.
    if (room.settings?.gameMode === 'deli_koyu' && count >= 4) {
        const masumPool = ['Şifacı', 'Bekçi', 'Avcı', 'Muhtar', 'Gözcü', 'Falcı', 'Gassal', 'Eskort'];
        const realMasum = masumPool[Math.floor(Math.random() * masumPool.length)];
        const activeRoles = ['Seri Katil', realMasum];
        while (activeRoles.length < count) activeRoles.push('Deli');
        for (let i = activeRoles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [activeRoles[i], activeRoles[j]] = [activeRoles[j], activeRoles[i]];
        }
        room.players.forEach((player, i) => {
            player.role = activeRoles[i];
            player.uses = 0;
            player.execTarget = null;
            player.deliDisguise = null;
        });
        room.players.forEach(player => {
            if (player.role === 'Deli') {
                const infoPool = ['Falcı', 'Bekçi', 'Gözcü'];
                player.deliDisguise = infoPool[Math.floor(Math.random() * infoPool.length)];
            }
        });
        console.log(`[Deli Koyu] 1 SK + 1 ${realMasum} + ${count - 2} Deli atandi`);
        return;
    }

    let enabledRoles = room.settings?.roles || {};
    Object.keys(ROLES).forEach(r => {
        if (enabledRoles[r] === undefined) {
            enabledRoles[r] = 1;
        }
    });

    // Ağırlık normalize: legacy boolean (true/false) → 1/0, sayisal → 0-5 arasi clamp.
    // Agirlik 0 = kapali; 2+ = havuza birden fazla kopya ekler, secilme sansi catlanir.
    const weightOf = (v) => {
        if (v === undefined) return 1;
        if (typeof v === 'boolean') return v ? 1 : 0;
        const n = Math.floor(Number(v) || 0);
        return Math.max(0, Math.min(5, n));
    };
    console.log('[Dev] Enabled Roles for this game:', enabledRoles);

    if (room.isDevMode) {
        // Dev mode: agirlik destekli havuz — weight 2 ise rol havuza 2 kez girer
        let pool = [];
        Object.keys(enabledRoles).forEach(r => {
            const w = weightOf(enabledRoles[r]);
            for (let i = 0; i < w; i++) pool.push(r);
        });
        if (pool.length === 0) pool = Object.keys(ROLES);

        let finalPool = [];
        while(finalPool.length < count) {
            let p = [...pool];
            for (let i = p.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [p[i], p[j]] = [p[j], p[i]];
            }
            for(let r of p) {
                if(finalPool.length < count) finalPool.push(r);
            }
        }
        
        for (let i = finalPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [finalPool[i], finalPool[j]] = [finalPool[j], finalPool[i]];
        }
        
        room.players.forEach((player, i) => {
          player.role = finalPool[i];
          player.uses = 0;
          player.execTarget = null;
          player.deliDisguise = null;
        });

        room.players.forEach((player) => {
          if (player.role === 'Kan Davalı') {
             const masumlar = room.players.filter(p => ROLES[p.role]?.team === 'Köylüler' && p.socketId !== player.socketId);
             if (masumlar.length > 0) player.execTarget = masumlar[Math.floor(Math.random() * masumlar.length)].socketId;
             else player.role = 'Garip';
          }
          if (player.role === 'Deli') {
             const infoPool = ['Falcı', 'Bekçi', 'Gözcü'].filter(r => weightOf(enabledRoles[r]) > 0);
             player.deliDisguise = infoPool.length > 0
                ? infoPool[Math.floor(Math.random() * infoPool.length)]
                : 'Falcı';
          }
        });
        return;
    }

    // Normal mod: her rolun weight'i o rolden EN FAZLA kac kopya gelebilecegini soyler (sert tavan).
    // Takim toplamlari (kirmizi/gri/yesil) de sert kisittir — bu kadarini gecmez.
    // Eskiya Basi ve Seri Katil iki ayri zorunlu slottur; bu yuzden takim havuzlarinin disinda tutulur
    // ve weight=1 olmasi durumunda tekrar cikmaz.
    const roleCap = {};
    Object.keys(enabledRoles).forEach(r => { roleCap[r] = weightOf(enabledRoles[r]); });
    // Eskiya Basi: aktifse tam olarak 1 — tavanini 1'e zorla, zorunlu slot olarak ayrilir.
    if ((roleCap['Eşkıya Başı'] || 0) > 0) roleCap['Eşkıya Başı'] = 1;
    const roleCount = {};
    const remaining = (r) => (roleCap[r] || 0) - (roleCount[r] || 0);

    let poolEvil = [];
    let poolNeutral = [];
    let poolTown = [];
    Object.keys(enabledRoles).forEach(r => {
        if ((roleCap[r] || 0) <= 0) return;
        if (r === 'Eşkıya Başı') return; // zorunlu slot, takim havuzunda yok
        const team = ROLES[r]?.team;
        if (team === 'Eşkıyalar' || r === 'Kundakçı') poolEvil.push(r);
        else if (team === 'Bireysel') poolNeutral.push(r);
        else if (team === 'Köylüler') poolTown.push(r);
    });

    // Tum roller kapatilmissa fallback
    if (poolEvil.length === 0 && poolNeutral.length === 0 && poolTown.length === 0
        && (roleCap['Eşkıya Başı'] || 0) === 0) {
        ['Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci', 'Kundakçı'].forEach(r => { roleCap[r] = 1; poolEvil.push(r); });
        ['Garip', 'Kan Davalı', 'Kaçak', 'Seri Katil'].forEach(r => { roleCap[r] = 1; poolNeutral.push(r); });
        ['Muhtar', 'Gözcü', 'Falcı', 'Gassal', 'Şifacı', 'Avcı', 'Bekçi', 'Eskort'].forEach(r => { roleCap[r] = 1; poolTown.push(r); });
        roleCap['Eşkıya Başı'] = 1;
        enabledRoles['Eşkıya Başı'] = 1;
    }

    let { kirmizi, gri, yesil } = room.settings;
    kirmizi = kirmizi ?? 4;
    gri = gri ?? 2;
    yesil = yesil ?? 9;

    let activeRoles = [];

    // Kalan kapasiteye gore weighted-without-replacement cekilis.
    // Bir rol tavanini doldurdu mu havuzdan dusuyor — yani weight=1 ise en fazla 1 kez gelir.
    const drawFromPool = (pool) => {
        const candidates = pool.filter(r => remaining(r) > 0);
        if (candidates.length === 0) return null;
        const weights = candidates.map(r => remaining(r));
        const total = weights.reduce((a, b) => a + b, 0);
        let pick = Math.random() * total;
        for (let i = 0; i < candidates.length; i++) {
            pick -= weights[i];
            if (pick <= 0) {
                roleCount[candidates[i]] = (roleCount[candidates[i]] || 0) + 1;
                return candidates[i];
            }
        }
        const r = candidates[candidates.length - 1];
        roleCount[r] = (roleCount[r] || 0) + 1;
        return r;
    };

    const tryAddForced = (r) => {
        if (remaining(r) <= 0) return false;
        roleCount[r] = (roleCount[r] || 0) + 1;
        activeRoles.push(r);
        return true;
    };

    // 1. Kirmizi (Kotuler) — Eskiya Basi aktifse tam 1 kez zorunlu, geri kalan poolEvil'den
    for (let i = 0; i < kirmizi && activeRoles.length < count; i++) {
       if (i === 0 && (roleCap['Eşkıya Başı'] || 0) > 0 && tryAddForced('Eşkıya Başı')) continue;
       const r = drawFromPool(poolEvil);
       if (r) activeRoles.push(r);
       else break; // havuz tukendi — kirmizi kotasini bos birak, takim toplami sert kisit
    }

    // 2. Gri (Tarafsizlar)
    for (let i = 0; i < gri && activeRoles.length < count; i++) {
       const r = drawFromPool(poolNeutral);
       if (r) activeRoles.push(r);
       else break;
    }

    // 3. Yesil (Masumlar)
    for (let i = 0; i < yesil && activeRoles.length < count; i++) {
       const r = drawFromPool(poolTown);
       if (r) activeRoles.push(r);
       else break;
    }

    // Takim havuzlari tukendi ama oyuncu acigi var ise: tavanlari korumak icin
    // tum havuzlardan (forced slotlar dahil) kalan kapasiteden cek. Tavan asilamaz.
    if (activeRoles.length < count) {
        const fallbackPool = [...poolEvil, ...poolNeutral, ...poolTown];
        if ((roleCap['Eşkıya Başı'] || 0) > 0) fallbackPool.push('Eşkıya Başı');
        while (activeRoles.length < count) {
            const r = drawFromPool(fallbackPool);
            if (!r) break;
            activeRoles.push(r);
        }
    }

    // Hala eksikse son care olarak Muhtar (sadece tavan/role yoksa)
    while (activeRoles.length < count) {
        activeRoles.push('Muhtar');
    }

    if (activeRoles.length > count) {
        activeRoles = activeRoles.slice(0, count);
    }
  
    // Fisher-Yates Shuffle ile Karıştır
    for (let i = activeRoles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [activeRoles[i], activeRoles[j]] = [activeRoles[j], activeRoles[i]];
    }
  
    // Atamalar ve Kan Davalı mantığı
    room.players.forEach((player, i) => {
      player.role = activeRoles[i];
      player.uses = 0;
      player.deliDisguise = null;
    });

    room.players.forEach((player) => {
      if (player.role === 'Kan Davalı') {
         const masumlar = room.players.filter(p => ROLES[p.role]?.team === 'Köylüler' && p.socketId !== player.socketId);
         if (masumlar.length > 0) {
            player.execTarget = masumlar[Math.floor(Math.random() * masumlar.length)].socketId;
         } else {
            player.role = 'Garip';
         }
      }
      // Deli: aktif info-roller arasindan kostum sec. Hicbiri aktif degilse Falci varsayilan.
      if (player.role === 'Deli') {
         const infoPool = ['Falcı', 'Bekçi', 'Gözcü'].filter(r => weightOf(enabledRoles[r]) > 0);
         player.deliDisguise = infoPool.length > 0
            ? infoPool[Math.floor(Math.random() * infoPool.length)]
            : 'Falcı';
      }
    });
  }

  changePhase(roomCode, phase, timeInSeconds) {
    const room = this.rooms[roomCode];
    if (!room) return;
  
    room.status = phase;
    room.timeRemaining = timeInSeconds;
    room.skipDayVotes = [];
  
    this.io.to(roomCode).emit('updateLobby', room.players);
    this.io.to(roomCode).emit('phaseChanged', { phase, timeRemaining: timeInSeconds, dayCount: room.dayCount, doused: Object.keys(room.doused || {}), trial: room.trial ? { accusedId: room.trial.accusedId, accusedName: room.trial.accusedName } : null });
    const _phaseTR = { DAY: 'Gündüz', NIGHT: 'Gece', MORNING: 'Sabah', DEFENSE: 'Savunma', JUDGMENT: 'Hüküm' }[phase] || phase;
    const _dayLabel = phase === 'NIGHT' ? `${room.dayCount}. Gece` : `${room.dayCount}. Gün`;
    pushEvent(room, { type: 'phase', text: `${_dayLabel} — ${_phaseTR}`, day: room.dayCount, phase, ts: Date.now(), meta: { phase } });
    this.io.to(roomCode).emit('skipDayUpdate', { count: 0, total: room.players.filter(p => p.isAlive && p.connected).length });
    if (room.timerInterval) clearInterval(room.timerInterval);
  
    room.timerInterval = setInterval(() => {
      room.timeRemaining -= 1;
      this.io.to(roomCode).emit('timerUpdate', room.timeRemaining);
  
      if (room.timeRemaining <= 0) {
        clearInterval(room.timerInterval);
        this.processPhaseEnd(roomCode, phase);
      }
    }, 1000);
  }

  startDefense(roomCode, accusedId) {
    const room = this.rooms[roomCode];
    if (!room || room.status !== 'DAY') return;
    const accused = room.players.find(p => p.socketId === accusedId);
    if (!accused || !accused.isAlive) return;
    room.dayRemaining = room.timeRemaining;          // kalan gündüzü sakla
    room.trial = { accusedId, accusedName: accused.name };
    room.votes = {};                                  // suçlama oyları sıfırlanır
    room.judgmentVotes = {};
    this.changePhase(roomCode, 'DEFENSE', room.settings.defenseTimer || 60);
  }

  processPhaseEnd(roomCode, oldPhase) {
    const room = this.rooms[roomCode];
    if(!room) return;
  
    if (oldPhase === 'NIGHT') {
      let deaths = [];
      let healed = {}; 
      let vested = {};
      let framed = {}; 
      let alerts = {}; 
      let roleblocked = {};
      let visits = {};
      let ignitedIds = []; // ignite anindaki gazli ev listesi (room.doused temizlenmeden once yakalanir)

      const getPlayer = (id) => room.players.find(p => p.socketId === id);
      const actions = Object.values(room.nightActions);
  
      actions.forEach(a => {
          if (a.targetId) {
              if(!visits[a.targetId]) visits[a.targetId] = [];
              visits[a.targetId].push(a.actorId);
          }
      });
  
      // Priority 1: Avcı (Pusu) -- IMMUNE
      actions.filter(a => a.role === 'Avcı' && a.actionType === 'pusu').forEach(a => {
          const p = getPlayer(a.actorId);
          if(p && p.uses < 3) {
              p.uses++;
              alerts[a.actorId] = true;
              healed[a.actorId] = true;
          }
      });
  
      // Priority 2: Kaçak Self Protect -- IMMUNE
      actions.filter(a => a.role === 'Kaçak' && a.actionType === 'protect').forEach(a => {
          const p = getPlayer(a.actorId);
          if(p && p.uses < 4) {
              p.uses++;
              vested[a.actorId] = true; 
          }
      });
  
      // Priority 3: Meyhaneci ve Eskort
      let skPassiveAttacks = [];
      actions.filter(a => (a.role === 'Meyhaneci' || a.role === 'Eskort') && a.targetId).forEach(a => {
          if (!alerts[a.targetId]) {
              roleblocked[a.targetId] = true;
              this.sendPrivateNews(roomCode, a.targetId, { text: "Oldukça 'hareketli' bir gece geçirdin ve aklın başından gitti... Haliyle görevini de yapamadın!", align: 'Kırmızı' });

              // Seri Katil engelleyeni öldürür (Town of Salem mekaniği)
              const targetP = getPlayer(a.targetId);
              if (targetP && targetP.role === 'Seri Katil') {
                  skPassiveAttacks.push({ killerId: a.targetId, targetId: a.actorId });
              }
          }
      });

      // Priority 4: Kundakçı
      actions.filter(a => a.role === 'Kundakçı').forEach(a => {
          if (!roleblocked[a.actorId]) {
              if (a.actionType === 'douse' && a.targetId && !alerts[a.targetId]) {
                  room.doused[a.targetId] = true;
                  this.sendPrivateNews(roomCode, a.actorId, { text: `${getPlayer(a.targetId)?.name || 'Hedefin'} adlı kişinin evini gazyağına buladın.`, align: 'Yeşil' });
              } else if (a.actionType === 'ignite') {
                  // Guard: hic gazli ev yokken ates yakilamaz, oyuncuyu uyar
                  if (Object.keys(room.doused).length === 0) {
                     this.sendPrivateNews(roomCode, a.actorId, { text: "Henuz hicbir evi gazlamadin! Once gazla, sonra yak.", align: 'Kırmızı' });
                  } else {
                     ignitedIds = Object.keys(room.doused); // arson death cause icin yakala
                     for (let dousedId in room.doused) {
                        deaths.push(dousedId);
                        this.sendPrivateNews(roomCode, dousedId, { text: "Evini ateşe verdiler!", align: 'Kırmızı' });
                     }
                     this.sendPrivateNews(roomCode, a.actorId, { text: "Evleri ateşe verdin, ortalığı küle çevirdin!", align: 'Yeşil' });
                     room.doused = {};
                  }
              }
          }
      });

      // Kill visitors to Alerting Avcı
      for (let targetId in visits) {
          if (alerts[targetId]) {
              visits[targetId].forEach(visitorId => {
                 deaths.push(visitorId);
                 this.sendPrivateNews(roomCode, visitorId, { text: "Girdiğin evde pusuya düşürüldün!", align: 'Kırmızı' });
                 this.sendPrivateNews(roomCode, targetId, { text: "Pusuna biri düştü!", align: 'Yeşil' });
              });
          }
      }

      // Priority 5: Tefeci
      room.silenced = {}; 
      actions.filter(a => a.role === 'Tefeci' && a.targetId).forEach(a => {
          if(!roleblocked[a.actorId] && !alerts[a.targetId]) {
              const targetP = getPlayer(a.targetId);
              if (targetP && ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'].includes(targetP.role)) {
                  this.sendPrivateNews(roomCode, a.actorId, { text: "Kendi takımından birini susturamazsın!", align: 'Kırmızı' });
              } else {
                  room.silenced[a.targetId] = true;
                  const tefTargetP = getPlayer(a.targetId);
                  this.sendPrivateNews(roomCode, a.actorId, { text: `${tefTargetP?.name || 'Hedef'} adlı kişiyi susturdun, yarın konuşamayacak.`, align: 'Yeşil' });
              }
          }
      });

      // Priority 6: Münafık
      actions.filter(a => a.role === 'Münafık' && a.targetId).forEach(a => {
          if(!roleblocked[a.actorId] && !alerts[a.targetId]) {
              const targetP = getPlayer(a.targetId);
              if (targetP && ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'].includes(targetP.role)) {
                  this.sendPrivateNews(roomCode, a.actorId, { text: "Kendi adamına iftira atamazsın!", align: 'Kırmızı' });
              } else {
                  framed[a.targetId] = true;
                  const munTargetP = getPlayer(a.targetId);
                  if (munTargetP) munTargetP.framedDay = room.dayCount;
                  this.sendPrivateNews(roomCode, a.actorId, { text: `${munTargetP?.name || 'Hedef'} adlı kişinin kapısına suç aletleri bıraktın.`, align: 'Gri' });
              }
          }
      });

      // Priority 7: Şifacı
      actions.filter(a => a.role === 'Şifacı' && a.targetId).forEach(a => {
          if(!roleblocked[a.actorId] && !alerts[a.targetId]) {
              const targetP = getPlayer(a.targetId);
              if(targetP && targetP.isMayorRevealed && a.actorId !== a.targetId) {
                  this.sendPrivateNews(roomCode, a.actorId, { text: "Muhtar çok göz önünde, onu koruyamazsın!", align: 'Kırmızı' });
              } else if (a.actorId === a.targetId && targetP && (targetP.uses || 0) >= 2) {
                  this.sendPrivateNews(roomCode, a.actorId, { text: "Kendini iyileştirme hakkın bitti!", align: 'Kırmızı' });
              } else {
                  healed[a.targetId] = true;
                  if (a.actorId === a.targetId) {
                     const healer = getPlayer(a.actorId);
                     if (healer) healer.uses = (healer.uses || 0) + 1;
                  }
                  const sifTargetP = getPlayer(a.targetId);
                  const wasAttacked = Object.values(actions).some(x => x.targetId === a.targetId && ['Eşkıya Başı','Eşkıya','Seri Katil'].includes(x.role));
                  this.sendPrivateNews(roomCode, a.actorId, { text: a.actorId === a.targetId ? "Bütün gece kapını kilitledin ve kendini korudun." : `${sifTargetP?.name || 'Hedef'} adlı kişiyi korudun${wasAttacked ? ' — iyi ki oradaydın, saldırı oldu ama kurtardın!' : ', gece boyunca güvende kaldı.'}`, align: 'Yeşil' });
              }
          }
      });

      // Priority 7.5: Deli (sahte sonuc, gercek kacma efekti yok ama ziyaret gercek — Avci pusu/Gozcu izleme isler)
      actions.filter(a => a.role === 'Deli' && a.targetId).forEach(a => {
         if (roleblocked[a.actorId] || alerts[a.targetId]) return;
         const p = getPlayer(a.actorId);
         const targetP = getPlayer(a.targetId);
         if (!p || !targetP) return;
         const disguise = p.deliDisguise || 'Falcı';

         if (disguise === 'Falcı') {
            const allRoles = Object.keys(ROLES);
            const fakeAnchor = allRoles[Math.floor(Math.random() * allRoles.length)];
            const prophecy = getProphecy(fakeAnchor, false);
            this.sendPrivateNews(roomCode, a.actorId, { text: `${targetP.name} için kehanet: ${prophecy}!`, align: 'Yarı' });
         } else if (disguise === 'Bekçi') {
            const fakeAlign = Math.random() < 0.5 ? 'Masum' : 'Eşkıya';
            this.sendPrivateNews(roomCode, a.actorId, {
               text: `${targetP.name} incelendi: ${fakeAlign === 'Masum' ? 'Temiz görünüyor.' : 'Eşkıya!'}`,
               align: fakeAlign === 'Masum' ? 'Gri' : 'Kırmızı'
            });
         } else if (disguise === 'Gözcü') {
            const candidates = room.players.filter(x => x.isAlive && x.socketId !== a.actorId && x.socketId !== a.targetId);
            const numFake = Math.floor(Math.random() * 4); // 0,1,2,3 sahte ziyaretci
            const pool = [...candidates];
            const fakeVisitors = [];
            for (let i = 0; i < numFake && pool.length > 0; i++) {
               const idx = Math.floor(Math.random() * pool.length);
               fakeVisitors.push(pool[idx]);
               pool.splice(idx, 1);
            }
            const msg = fakeVisitors.length > 0
               ? `${targetP.name} evini ziyaret edenler: ${fakeVisitors.map(v => v.name).join(', ')}`
               : `${targetP.name} evini dün gece kimse ziyaret etmedi.`;
            this.sendPrivateNews(roomCode, a.actorId, { text: msg, align: 'Yeşil' });
         }
      });

      // Priority 8: Bekçi, Gözcü, Falcı
      actions.filter(a => ['Bekçi', 'Gözcü', 'Falcı'].includes(a.role) && a.targetId).forEach(a => {
         if(!roleblocked[a.actorId] && !alerts[a.targetId]) {
            const targetP = getPlayer(a.targetId);
            if(!targetP) return;

            if (a.role === 'Bekçi') {
                let tAlign = ROLES[targetP.role]?.align;
                if (framed[a.targetId] || (targetP.framedDay !== undefined && room.dayCount <= targetP.framedDay + 1)) tAlign = 'Eşkıya';
                if (targetP.role === 'Eşkıya Başı') {
                   tAlign = targetP.hasBloodOnHands ? 'Eşkıya' : 'Masum';
                }

                let msg = `${targetP.name} incelendi: ${tAlign === 'Masum' ? 'Temiz görünüyor.' : 'Eşkıya!'}`;
                this.sendPrivateNews(roomCode, a.actorId, { text: msg, align: tAlign === 'Masum' ? 'Gri' : 'Kırmızı' });
            } 
            else if (a.role === 'Gözcü') {
               const targetVisits = (visits[a.targetId] || []).filter(vid => vid !== a.actorId);
               const visNames = targetVisits.map(vid => getPlayer(vid)?.name).join(', ');
               let msg = targetVisits.length > 0 ? `${targetP.name} evini ziyaret edenler: ${visNames}` : `${targetP.name} evini dün gece kimse ziyaret etmedi.`;
               this.sendPrivateNews(roomCode, a.actorId, { text: msg, align: 'Yeşil' });
            }
            else if (a.role === 'Falcı') {
               // Kehanet hedef icin bir kez uretilip cache'lenir — ayni hedefe N gece gidip
               // kesisim kumesinden gercek rolu bulma sömürüsünu engeller.
               // Hedefin rolu degisirse (orn. Kan Davali → Garip) cache invalide olur.
               if (!room.prophecyByTarget) room.prophecyByTarget = {};
               const cached = room.prophecyByTarget[a.targetId];
               let prophecy;
               if (cached && cached.role === targetP.role) {
                  prophecy = cached.prophecy;
               } else {
                  const isFramed = framed[a.targetId] || (targetP.framedDay !== undefined && room.dayCount <= targetP.framedDay + 1);
                  prophecy = getProphecy(targetP.role, isFramed);
                  room.prophecyByTarget[a.targetId] = { role: targetP.role, prophecy };
               }
               this.sendPrivateNews(roomCode, a.actorId, { text: `${targetP.name} için kehanet: ${prophecy}!`, align: 'Yarı' });
            }
         }
      });

      // Priority 9: Attacks
      let gfPlayer = room.players.find(p => p.role === 'Eşkıya Başı' && p.isAlive);
      let mafPlayer = room.players.find(p => p.role === 'Eşkıya' && p.isAlive);

      let mTargetId = null;
      let gfAction = actions.find(a => a.role === 'Eşkıya Başı' && a.targetId);
      let mafAction = actions.find(a => a.role === 'Eşkıya' && a.targetId);

      // Hedef önceliği: Eşkıya Başı'nın emri önceliklidir
      mTargetId = (gfAction ? gfAction.targetId : null) || (mafAction ? mafAction.targetId : null);

      if (mTargetId) {
          // Katil seçimi: Eşkıya öncelikli tetikçidir, o engelliyse veya yoksa Eşkıya Başı bizzat gider
          let killerId = null;
          if (mafPlayer && !roleblocked[mafPlayer.socketId]) {
              killerId = mafPlayer.socketId;
              
              // Eşkıya Başı'nın emriyle gidiyorsa bilgilendir
              if (gfAction && gfAction.targetId && (!mafAction || mafAction.targetId !== gfAction.targetId)) {
                  this.sendPrivateNews(roomCode, killerId, { text: `Eşkıya Başı'nın emriyle kendi fikrin reddedildi ve ${getPlayer(gfAction.targetId)?.name || 'hedefe'} saldırmaya gönderildin!`, align: 'Kırmızı' });
              }
          } else if (gfPlayer && !roleblocked[gfPlayer.socketId] && gfAction) {
              // EB sadece kendi hedef sectiyse devreye girer.
              // Eskıya kendi inisiyatifle gidip engellenirse EB pasiftir; kan bulasmaz.
              killerId = gfPlayer.socketId;
              if (mafPlayer && roleblocked[mafPlayer.socketId]) {
                  this.sendPrivateNews(roomCode, mafPlayer.socketId, {
                      text: 'Engellendiğin için tetiği çekemedin — Eşkıya Başı hedefi bizzat üstüne aldı.',
                      align: 'Kırmızı'
                  });
              }
          } else if (mafPlayer && roleblocked[mafPlayer.socketId] && mafAction && !gfAction) {
              // Eskıya kendi inisiyatifle gitmis, engellenmis, EB emir vermemis → cinayet duser
              this.sendPrivateNews(roomCode, mafPlayer.socketId, {
                  text: 'Engellendiğin için bu gece tetiği çekemedin — Eşkıya Başı\'ndan emir gelmediği için hedef sağ kaldı.',
                  align: 'Kırmızı'
              });
          }

          if (killerId) {
              const targetP = getPlayer(mTargetId);
              if(!alerts[mTargetId]) {
                 if (targetP && ['Eşkıya Başı', 'Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci'].includes(targetP.role)) {
                     this.sendPrivateNews(roomCode, killerId, { text: "Kendi takımından birine saldırmaya çalıştın ve vazgeçtin!", align: 'Kırmızı' });
                     if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: "Adamın kendi takımından birine saldırmaya çalıştı ve vazgeçti!", align: 'Kırmızı' });
                 } else if(healed[mTargetId]) {
                   this.sendPrivateNews(roomCode, mTargetId, { text: "Bu gece biri sana saldırdı... Ama tam son anda birinin müdahalesiyle kurtarıldın!", align: 'Yeşil' });
                   this.sendPrivateNews(roomCode, killerId, { text: `${targetP?.name || 'Hedef'} adlı kişiye saldırdın ama biri araya girdi, o kişi kurtarıldı!`, align: 'Kırmızı' });
                   if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Adamın ${targetP?.name || 'hedefe'} saldırdı ama biri araya girdi, o kişi kurtarıldı!`, align: 'Kırmızı' });
                 } else if(vested[mTargetId] || (targetP && targetP.role === 'Muhtar' && targetP.uses > 0)) {
                   if (targetP && targetP.role === 'Muhtar' && targetP.uses > 0) targetP.uses = 0; // Muhtar yelegini tuket
                   this.sendPrivateNews(roomCode, mTargetId, { text: "Vahşice bir saldırıya uğradın ama direncini kıramadılar, ucuz atlattın!", align: 'Yeşil' });
                   this.sendPrivateNews(roomCode, killerId, { text: "Saldırdığın kişinin savunması çok güçlüydü, silahın işlemedi!", align: 'Kırmızı' });
                   if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Tetikçinin saldırdığı ${targetP?.name || 'kişi'} çok dirençli çıktı, silah işlemedi!`, align: 'Kırmızı' });
                 } else if(targetP && ROLES[targetP.role]?.nightImmune) {
                   this.sendPrivateNews(roomCode, killerId, { text: `${targetP?.name || 'Saldırdığın kişi'} gece saldırılarına karşı çok güçlü, ölmedi!`, align: 'Kırmızı' });
                   if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Adamının saldırdığı ${targetP?.name || 'kişi'} gece saldırılarına karşı çok güçlü, ölmedi!`, align: 'Kırmızı' });
                 } else {
                   deaths.push(mTargetId);
                   const killerP = getPlayer(killerId);
                   const isGFKill = killerP && killerP.role === 'Eşkıya Başı';
                   if (isGFKill) {
                     // EB bizzat oldurdu — Bekci sorgusunda artik 'Eskıya' gorunecek
                     this.sendPrivateNews(roomCode, killerId, {
                       text: `${targetP?.name || 'Hedef'} ortadan kaldırıldı — tetiği bizzat çektin. Ellerin kana bulandı; Bekçi seni sorgularsa artık "Eşkıya" olarak okuyacak.`,
                       align: 'Kırmızı'
                     });
                     killerP.hasBloodOnHands = true;
                   } else {
                     this.sendPrivateNews(roomCode, killerId, { text: `${targetP?.name || 'Hedef'} ortadan kaldırıldı, saldırın başarılı oldu.`, align: 'Yeşil' });
                     if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Adamın ${targetP?.name || 'hedefi'} ortadan kaldırdı, saldırı başarılı oldu.`, align: 'Yeşil' });
                   }
                 }
              }
          }
      }  
      // Execute SK
      actions.filter(a => a.role === 'Seri Katil' && a.targetId).forEach(a => {
          if(!roleblocked[a.actorId] && !alerts[a.targetId]) {
             if(healed[a.targetId]) {
                const skTargetHealed = getPlayer(a.targetId);
                this.sendPrivateNews(roomCode, a.targetId, { text: "Bu gece biri sana saldırdı... Ama tam son anda birinin müdahalesiyle kurtarıldın!", align: 'Yeşil' });
                this.sendPrivateNews(roomCode, a.actorId, { text: `${skTargetHealed?.name || 'Hedef'} adlı kişiye saldırdın ama biri araya girdi, o kişi kurtarıldı!`, align: 'Kırmızı' });
             } else if(vested[a.targetId] || (getPlayer(a.targetId) && getPlayer(a.targetId).role === 'Muhtar' && getPlayer(a.targetId).uses > 0)) {
                const p = getPlayer(a.targetId);
                if (p && p.role === 'Muhtar' && p.uses > 0) p.uses = 0; // Consume the vest
                this.sendPrivateNews(roomCode, a.targetId, { text: "Seri Katil vahşice saldırdı ama direncini kıramadı, ucuz atlattın!", align: 'Yeşil' });
                this.sendPrivateNews(roomCode, a.actorId, { text: "Saldırdığın kişiyi biri hayatta tuttu veya çelik gibi bir iradesi var!", align: 'Kırmızı' });
             } else if (getPlayer(a.targetId) && ROLES[getPlayer(a.targetId).role]?.nightImmune) {
                this.sendPrivateNews(roomCode, a.actorId, { text: `${getPlayer(a.targetId)?.name || 'Saldırdığın kişi'} ölmedi! Bıçağın işe yaramadı.`, align: 'Kırmızı' });
             } else {
                deaths.push(a.targetId);
                const skTarget = getPlayer(a.targetId);
                this.sendPrivateNews(roomCode, a.actorId, { text: `${skTarget?.name || 'Hedef'} adlı kişiyi vahşice katlettin.`, align: 'Yeşil' });
             }
          }
      });
  
      // Resolve SK Passive Attacks (Eskort/Meyhaneci roleblocked SK)
      skPassiveAttacks.forEach(attack => {
          if (!healed[attack.targetId] && !vested[attack.targetId]) {
              deaths.push(attack.targetId);
              this.sendPrivateNews(roomCode, attack.targetId, { text: "Girdiğin evde bir Seri Katil ile karşılaştın ve vahşice katledildin!", align: 'Kırmızı' });
              this.sendPrivateNews(roomCode, attack.killerId, { text: "Seni engellemeye çalışan kişiyi acımadan deştin!", align: 'Yeşil' });
          } else {
              this.sendPrivateNews(roomCode, attack.targetId, { text: "Girdiğin evde bir Seri Katil ile karşılaştın ama son anda kurtarıldın!", align: 'Yeşil' });
              this.sendPrivateNews(roomCode, attack.killerId, { text: "Seni engellemeye çalışan kişiyi deşecektin ama hayatta kalmayı başardı!", align: 'Kırmızı' });
          }
      });

      // 10. Jester Kill
      if (room.deadJesterVotes && room.deadJesterVotes.length > 0) {
          const randomVictim = room.deadJesterVotes[Math.floor(Math.random() * room.deadJesterVotes.length)];
          deaths.push(randomVictim);
          this.sendPrivateNews(roomCode, randomVictim, { text: "Dün asılan Garip'in laneti üzerine çöktü! Suçluluk duygusundan kahrından öldün.", align: 'Kırmızı' });
          room.deadJesterVotes = [];
      }
  
      // RESOLVE DEATHS
      deaths = [...new Set(deaths)]; 
      let killedInfos = [];

      deaths.forEach(dId => {
        const p = getPlayer(dId);
        if(p && p.isAlive) {
          
          let cause = 'normal';
          if (ignitedIds.includes(dId)) {
             cause = 'arsonist';
             // Kaçak (Survivor) yelek giymişse (vested) veya Muhtar'ın tek kullanımlık yeleği varsa yanmaktan kurtulur
             if (vested[dId]) {
                 this.sendPrivateNews(roomCode, dId, { text: "Evin alev alev yandı ancak sen güvenli sığınağında olduğun için yanmaktan kurtuldun!", align: 'Yeşil' });
                 return; // Ölümden kurtar
             }
          }
          
          p.isAlive = false;
          p.diedDay = room.dayCount;
          p.diedPhase = 'NIGHT';
          if (p.framedDay !== undefined && room.dayCount <= p.framedDay + 1) p.displayRole = 'Eşkıya';

          killedInfos.push({ name: p.name, align: getColorAlignment(p.role), personalNote: p.personalNote, cause });
        }
      });
  
      // Check Executioner target conversion
      room.players.forEach(p => {
          if (p.role === 'Kan Davalı' && p.execTarget && deaths.includes(p.execTarget) && p.isAlive) {
             p.role = 'Garip';
             this.sendPrivateNews(roomCode, p.socketId, { text: `Kan davalın ${getPlayer(p.execTarget)?.name || 'hedefin'} gece vakti öldürüldü. Amacını kaybederek delirdin... Artık amacın kendini heba ettirmek!`, align: 'Kırmızı' });
          }
      });
  
      // Temizlik
      if (actions.some(a => a.role === 'Kundakçı' && a.actionType === 'ignite' && !roleblocked[a.actorId])) {
         room.doused = {};
      }
      room.nightActions = {}; 
      
      // Yangin denemesi olduysa (hedefler yelekle kurtulsa bile) gece "huzurlu" sayilmaz.
      const arsonAttempted = ignitedIds.length > 0;
      if (killedInfos.length === 0 && !arsonAttempted) {
          room.peacefulDays = (room.peacefulDays || 0) + 1;
      } else {
          room.peacefulDays = 0;
      }

      if (this.checkWinCondition(roomCode)) return;

      if (killedInfos.length > 0) {
         killedInfos.forEach(info => {
            this.io.to(roomCode).emit('morningNews', { killedPlayerName: info.name, killedPlayerAlignment: info.align, personalNote: info.personalNote, cause: info.cause });
            pushEvent(room, { type: 'death', text: `${info.name} gece öldürüldü${info.cause === 'arsonist' ? ' (yangın)' : ''}`, day: room.dayCount, phase: 'NIGHT', ts: Date.now(), meta: { name: info.name, cause: info.cause } });
         });
      } else {
         this.io.to(roomCode).emit('morningNews', { killedPlayerName: null });
         pushEvent(room, { type: 'death', text: `${room.dayCount}. gece kimse ölmedi`, day: room.dayCount, phase: 'NIGHT', ts: Date.now(), meta: { name: null } });
      }
  
      Object.keys(room.silenced).forEach(sId => {
          const p = getPlayer(sId);
          if (p && p.isAlive) {
             this.sendPrivateNews(roomCode, sId, { text: "Bir Tefeci tarafından tehdit edildin! Bugün konuşamazsın.", align: 'Kırmızı' });
             if (!room.isDevMode || !sId.startsWith('dev_')) {
                this.io.to(sId).emit('youAreSilenced');
             }
          }
      });
  
      this.changePhase(roomCode, 'MORNING', room.settings.morningTimer);
    }
    else if (oldPhase === 'MORNING') {
      this.changePhase(roomCode, 'DAY', room.settings.dayTimer);
    }
    else if (oldPhase === 'DAY') {
      if (this.checkWinCondition(roomCode)) return;
      room.dayCount = (room.dayCount || 1) + 1;
      room.votes = {};
      room.judgmentVotes = {};
      room.acquittedToday = [];
      room.skipDayVotes = [];
      room.trial = null;
      this.changePhase(roomCode, 'NIGHT', room.settings.nightTimer);
    }
    else if (oldPhase === 'DEFENSE') {
      this.changePhase(roomCode, 'JUDGMENT', room.settings.votingTimer);
    }
    else if (oldPhase === 'JUDGMENT') {
      const trial = room.trial;
      const judgmentVotes = room.judgmentVotes || {};
      const verdict = trial ? voteLogic.evaluateVerdict(judgmentVotes) : 'SPARE';
      const accused = trial ? room.players.find(p => p.socketId === trial.accusedId) : null;

      let guiltyW = 0;
      for (const v in judgmentVotes) if (judgmentVotes[v].verdict === 'GUILTY') guiltyW += (judgmentVotes[v].weight || 0);

      let gameEnded = false;
      if (verdict === 'HANG' && accused && accused.isAlive) {
         accused.isAlive = false;
         accused.diedDay = room.dayCount;
         accused.diedPhase = 'JUDGMENT';
         room.peacefulDays = 0;
         if (accused.framedDay !== undefined && room.dayCount <= accused.framedDay + 1) accused.displayRole = 'Eşkıya';
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: accused.name, lynchedPlayerAlignment: getColorAlignment(accused.role), personalNote: accused.personalNote, voteTally: guiltyW });
         pushEvent(room, { type: 'lynch', text: `${accused.name} kuyuya atıldı (oy ${guiltyW})`, day: room.dayCount, phase: 'JUDGMENT', ts: Date.now(), meta: { name: accused.name, role: accused.role, hanged: true, tally: guiltyW } });

         if (accused.role === 'Garip') {
            const guilty = Object.keys(judgmentVotes).filter(id => judgmentVotes[id].verdict === 'GUILTY');
            room.deadJesterVotes = guilty;
            accused.won = true;
         }
         room.players.forEach(p => {
            if (p.role === 'Kan Davalı' && p.execTarget === accused.socketId) {
               this.sendPrivateNews(roomCode, p.socketId, { text: `İntikamını aldın! Kan davalın ${accused.name} ipe götürdün, OYUNU SEN KAZANDIN! Artık arkanı yaslayıp rahatlayabilirsin.`, align: 'Yeşil' });
               p.won = true;
            }
         });

         if (this.checkWinCondition(roomCode)) gameEnded = true;
      } else {
         if (trial) {
            if (!room.acquittedToday) room.acquittedToday = [];
            room.acquittedToday.push(trial.accusedId);
         }
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: null });
         pushEvent(room, { type: 'lynch', text: `Köylüler bağışladı, kimse kuyuya atılmadı`, day: room.dayCount, phase: 'JUDGMENT', ts: Date.now(), meta: { hanged: false } });
      }

      room.trial = null;
      room.judgmentVotes = {};
      if (gameEnded) return;

      if (room.dayRemaining > 0) {
         this.changePhase(roomCode, 'DAY', room.dayRemaining);
      } else {
         this.processPhaseEnd(roomCode, 'DAY');
      }
    }
  }

  checkWinCondition(roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return false;

    const alivePlayers = room.players.filter(p => p.isAlive);
    const connectedAlive = alivePlayers.filter(p => p.connected);

    // 1. Herkes oyundan çıktıysa (Aktif canlı ve bağlı oyuncu yoksa)
    if (connectedAlive.length === 0 && alivePlayers.length > 0) {
       this.io.to(roomCode).emit('gameOver', { winnerTitle: 'Beraberlik', results: [] });
       room.status = 'END';
       return true;
    }

    const esiCount = alivePlayers.filter(p => ROLES[p.role]?.team === 'Eşkıyalar').length;
    const cCount = alivePlayers.filter(p => p.role === 'Seri Katil').length;
    const aruCount = alivePlayers.filter(p => p.role === 'Kundakçı').length;
    // Masumlar ve Survivor/Kaçak gibi "Tehdit Olmayan" roller
    const masumCount = alivePlayers.filter(p => ROLES[p.role]?.team === 'Köylüler').length;
    const kacakCount = alivePlayers.filter(p => p.role === 'Kaçak').length;
 
    let winningTeam = null;

    // A. Beraberlik (20 gün kuralı)
    if (room.peacefulDays >= 20) {
       winningTeam = 'Beraberlik';
    }
    // B. Kundakçı Tek Başına
    else if (aruCount > 0 && alivePlayers.length === aruCount) {
       winningTeam = 'Kundakçı';
    }
    // C. Eşkıyalar Kazanır (Sayıca üstünlük ve tehdit kalmaması)
    else if (esiCount > 0 && esiCount >= alivePlayers.length / 2 && cCount === 0 && aruCount === 0) {
       // 1+1 (1 masum + 1 eşkıya): majority kuralı kazanç vermez.
       // Eşkıya gerçekten saldırınca biter (gece kill → 0+1 → eşkıya zaferi).
       // Avcı pusu kurarsa pusu tetiklenip eşkıya ölebilir → masum zaferi.
       // Kimse vurmazsa günler devam, 15 peacefulDays → beraberlik.
       if (alivePlayers.length === 2 && esiCount === 1 && masumCount === 1) {
          // Win atlanır — döngü normal akışta devam eder
       } else {
          winningTeam = 'Eşkıyalar';
       }
    }
    // D. Seri Katil Kazanır (Sona kalma veya son 2 kişi)
    else if (cCount > 0 && alivePlayers.length <= 2 && esiCount === 0 && aruCount === 0) {
       winningTeam = 'Seri Katil';
    }
    // E. Sadece Kaçak (Survivor) Kaldıysa (Veya sadece Survivorlar kaldıysa)
    else if (kacakCount > 0 && masumCount === 0 && esiCount === 0 && cCount === 0 && aruCount === 0) {
       winningTeam = 'Kaçak';
    }
    // F. Masumlar Kazanır (Tüm tehditler bittiğinde masum veya kaçak varsa)
    else if (esiCount === 0 && cCount === 0 && aruCount === 0 && masumCount > 0) {
       winningTeam = 'Masumlar';
    }
    // G. Herkes Öldüyse (Son kalanlar aynı gece birbirini öldürdüyse)
    else if (alivePlayers.length === 0) {
       winningTeam = 'Beraberlik';
    }
 
    if (winningTeam) {
       room.status = 'END';
       
       const results = room.players.map(p => {
           let wonStatus = false;
           // Bireysel Kazanma Şartları (Kaçak, vb.)
           if (p.role === 'Kaçak') {
               wonStatus = p.isAlive && winningTeam !== 'Beraberlik';
           } else {
               const pTeam = ROLES[p.role]?.team;
               if (winningTeam === 'Masumlar' && pTeam === 'Köylüler') wonStatus = true;
               else if (winningTeam === 'Eşkıyalar' && pTeam === 'Eşkıyalar') wonStatus = true;
               else if (winningTeam === 'Seri Katil' && p.role === 'Seri Katil') wonStatus = true;
               else if (winningTeam === 'Kundakçı' && p.role === 'Kundakçı') wonStatus = true;
               else if (winningTeam === 'Kaçak' && p.role === 'Kaçak') wonStatus = true; // Sadece survivor kazandıysa
           }
           
           if (p.won === true) wonStatus = true; // Jester/Exec özel kazançları
 
           return {
              name: p.name,
              role: p.role,
              won: wonStatus,
              isBot: p.socketId.startsWith('dev_')
           };
       });
 
       this.io.to(roomCode).emit('gameOver', { winnerTitle: winningTeam, results });
       
       pushEvent(room, { type: 'end', text: `Oyun bitti — Kazanan: ${winningTeam}`, day: room.dayCount, phase: room.status, ts: Date.now(), meta: { winner: winningTeam } });

       if (!room.isDevMode) {
          const supabase = require('./db');
          const deaths = room.players
             .filter(p => !p.isAlive)
             .map(p => ({ name: p.name, role: p.role, day: p.diedDay ?? null, phase: p.diedPhase ?? null, isBot: p.socketId.startsWith('dev_') }))
             .sort((a, b) => (a.day ?? 99) - (b.day ?? 99));
          supabase.from('game_history').insert([{
              room_code: roomCode,
              game_mode: 'NORMAL',
              winner: winningTeam,
              players: results,
              chat_log: room.chatLog || [],
              event_log: room.eventLog || [],
              deaths
          }]).then(({ error }) => {
              if (error) console.error("Supabase'e oyun kaydedilirken hata oluştu:", error);
          });
       }

       return true;
    }
    return false;
  }
}

module.exports = GameEngine;
