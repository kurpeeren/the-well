const { ROLES, getColorAlignment, getInvestResults } = require('./roles');

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
    let enabledRoles = room.settings?.roles || {};
    Object.keys(ROLES).forEach(r => {
        if (enabledRoles[r] === undefined) {
            enabledRoles[r] = true;
        }
    });
    console.log('[Dev] Enabled Roles for this game:', enabledRoles);

    if (room.isDevMode) {
        let pool = Object.keys(enabledRoles).filter(r => enabledRoles[r]);
        if (pool.length === 0) pool = Object.keys(ROLES);

        let finalPool = [];
        while(finalPool.length < count) {
            let p = [...pool];
            p.sort(() => Math.random() - 0.5);
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
        });

        room.players.forEach((player) => {
          if (player.role === 'Kan Davalı') {
             const masumlar = room.players.filter(p => ROLES[p.role]?.team === 'Köylüler' && p.socketId !== player.socketId);
             if (masumlar.length > 0) player.execTarget = masumlar[Math.floor(Math.random() * masumlar.length)].socketId;
             else player.role = 'Köy Delisi';
          }
        });
        return;
    }
  
    let poolEvil = Object.keys(enabledRoles).filter(r => enabledRoles[r] && (ROLES[r]?.team === 'Eşkıyalar' || r === 'Kundakçı'));
    let poolNeutral = Object.keys(enabledRoles).filter(r => enabledRoles[r] && ROLES[r]?.team === 'Bireysel' && r !== 'Kundakçı' && r !== 'Seri Katil');
    let poolTown = Object.keys(enabledRoles).filter(r => enabledRoles[r] && ROLES[r]?.team === 'Köylüler');

    // Eğer tamamen bütün roller kapatılmışsa fallback olarak tüm rolleri aç
    if (poolEvil.length === 0 && poolNeutral.length === 0 && poolTown.length === 0) {
        poolEvil = ['Münafık', 'Eşkıya', 'Tefeci', 'Meyhaneci', 'Kundakçı'];
        poolNeutral = ['Köy Delisi', 'Kan Davalı', 'Kaçak'];
        poolTown = ['Muhtar', 'Gözcü', 'Falcı', 'Gassal', 'Şifacı', 'Avcı', 'Bekçi', 'Eskort'];
        enabledRoles['Eşkıya Başı'] = true;
        enabledRoles['Seri Katil'] = true;
    }
  
    let { kirmizi, gri, yesil } = room.settings;
    kirmizi = kirmizi ?? 4;
    gri = gri ?? 2;
    yesil = yesil ?? 9;
  
    let activeRoles = [];

    // Çekiliş havuzlarını kopyarak oluştur
    let currentEvil = [];
    let currentNeutral = [];
    let currentTown = [];
    
    const getNextRole = (originalPool, currentPool) => {
        if (originalPool.length === 0) return null;
        if (currentPool.length === 0) {
            currentPool.push(...originalPool);
            currentPool.sort(() => Math.random() - 0.5);
        }
        return currentPool.pop();
    };
  
    // 1. Kırmızı Takım (Kötüler)
    for (let i = 0; i < kirmizi && activeRoles.length < count; i++) {
       if (i === 0 && enabledRoles['Eşkıya Başı']) activeRoles.push('Eşkıya Başı');
       else if (i === 1 && enabledRoles['Seri Katil']) activeRoles.push('Seri Katil');
       else {
           let r = getNextRole(poolEvil, currentEvil);
           if (r) activeRoles.push(r);
       }
    }
  
    // 2. Gri Takım (Tarafsızlar)
    for (let i = 0; i < gri && activeRoles.length < count; i++) {
       let r = getNextRole(poolNeutral, currentNeutral);
       if (r) activeRoles.push(r);
    }
  
    // 3. Yeşil Takım (Masumlar)
    for (let i = 0; i < yesil && activeRoles.length < count; i++) {
       let r = getNextRole(poolTown, currentTown);
       if (r) activeRoles.push(r);
    }
  
    // Eğer toplam sayı oyuncu sayısına ulaşmadıysa eksikleri eldeki havuzlardan rastgele doldur
    let allAvailable = [...poolTown, ...poolEvil, ...poolNeutral];
    if (enabledRoles['Eşkıya Başı']) allAvailable.push('Eşkıya Başı');
    if (enabledRoles['Seri Katil']) allAvailable.push('Seri Katil');
    let currentAll = [];
    
    while (activeRoles.length < count) {
        if (allAvailable.length > 0) {
            let r = getNextRole(allAvailable, currentAll);
            if (r) activeRoles.push(r);
        } else {
            activeRoles.push('Muhtar'); // Tamamen boş kalma durumuna son çare
        }
    }
  
    // Eğer fazlalık varsa kırp
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
    });
  
    room.players.forEach((player) => {
      if (player.role === 'Kan Davalı') {
         const masumlar = room.players.filter(p => ROLES[p.role]?.team === 'Köylüler' && p.socketId !== player.socketId);
         if (masumlar.length > 0) {
            player.execTarget = masumlar[Math.floor(Math.random() * masumlar.length)].socketId;
         } else {
            player.role = 'Köy Delisi';
         }
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
    this.io.to(roomCode).emit('phaseChanged', { phase, timeRemaining: timeInSeconds, dayCount: room.dayCount, doused: Object.keys(room.doused || {}) });
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
              this.sendPrivateNews(roomCode, a.targetId, { text: `${a.role} aklını çeldi! Bu gece görevini yapamadın.`, align: 'Kırmızı' });

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
                  for (let dousedId in room.doused) {
                     deaths.push(dousedId);
                     this.sendPrivateNews(roomCode, dousedId, { text: "Evini ateşe verdiler!", align: 'Kırmızı' });
                  }
                  this.sendPrivateNews(roomCode, a.actorId, { text: "Evleri ateşe verdin, ortalığı küle çevirdin!", align: 'Yeşil' });
                  room.doused = {};
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
               let fRole = targetP.role;
               if (framed[a.targetId] || (targetP.framedDay !== undefined && room.dayCount <= targetP.framedDay + 1)) fRole = 'Münafık';
               let msg = `${targetP.name} için kehanet: ${getInvestResults(fRole)}!`;
               this.sendPrivateNews(roomCode, a.actorId, { text: msg, align: 'Yarı' });
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
          } else if (gfPlayer && !roleblocked[gfPlayer.socketId]) {
              killerId = gfPlayer.socketId;
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
                 } else if(vested[mTargetId]) {
                   this.sendPrivateNews(roomCode, mTargetId, { text: "Vahşice bir saldırıya uğradın ama direncini kıramadılar, ucuz atlattın!", align: 'Yeşil' });
                   this.sendPrivateNews(roomCode, killerId, { text: "Saldırdığın kişinin savunması çok güçlüydü, silahın işlemedi!", align: 'Kırmızı' });
                   if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Tetikçinin saldırdığı ${targetP?.name || 'kişi'} çok dirençli çıktı, silah işlemedi!`, align: 'Kırmızı' });
                 } else if(targetP && ROLES[targetP.role]?.nightImmune) {
                   this.sendPrivateNews(roomCode, killerId, { text: `${targetP?.name || 'Saldırdığın kişi'} gece saldırılarına karşı çok güçlü, ölmedi!`, align: 'Kırmızı' });
                   if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Adamının saldırdığı ${targetP?.name || 'kişi'} gece saldırılarına karşı çok güçlü, ölmedi!`, align: 'Kırmızı' });
                 } else {
                   deaths.push(mTargetId);
                   this.sendPrivateNews(roomCode, killerId, { text: `${targetP?.name || 'Hedef'} ortadan kaldırıldı, saldırın başarılı oldu.`, align: 'Yeşil' });
                   if (gfPlayer && killerId !== gfPlayer.socketId) this.sendPrivateNews(roomCode, gfPlayer.socketId, { text: `Adamın ${targetP?.name || 'hedefi'} ortadan kaldırdı, saldırı başarılı oldu.`, align: 'Yeşil' });
                   const killerP = getPlayer(killerId);
                   if (killerP && killerP.role === 'Eşkıya Başı') killerP.hasBloodOnHands = true;
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
          this.sendPrivateNews(roomCode, randomVictim, { text: "Dün asılan Köy Delisi'nin laneti üzerine çöktü! Suçluluk duygusundan kahrından öldün.", align: 'Kırmızı' });
          room.deadJesterVotes = [];
      }
  
      // RESOLVE DEATHS
      deaths = [...new Set(deaths)]; 
      let killedInfos = [];

      // Arsonist kills'i ayırmak için doused olanları kontrol et
      const ignitedIds = actions.filter(a => a.role === 'Kundakçı' && a.actionType === 'ignite' && !roleblocked[a.actorId]).length > 0 ? Object.keys(room.doused) : [];

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
          if (p.framedDay !== undefined && room.dayCount <= p.framedDay + 1) p.displayRole = 'Eşkıya';
          
          killedInfos.push({ name: p.name, align: getColorAlignment(p.role), personalNote: p.personalNote, cause });
        }
      });
  
      // Check Executioner target conversion
      room.players.forEach(p => {
          if (p.role === 'Kan Davalı' && p.execTarget && deaths.includes(p.execTarget) && p.isAlive) {
             p.role = 'Köy Delisi';
             this.sendPrivateNews(roomCode, p.socketId, { text: `Kan davalın ${getPlayer(p.execTarget)?.name || 'hedefin'} gece vakti öldürüldü. Amacını kaybederek delirdin... Artık amacın kendini heba ettirmek!`, align: 'Kırmızı' });
          }
      });
  
      // Temizlik
      if (actions.some(a => a.role === 'Kundakçı' && a.actionType === 'ignite' && !roleblocked[a.actorId])) {
         room.doused = {};
      }
      room.nightActions = {}; 
      
      if (killedInfos.length === 0) {
          room.peacefulDays = (room.peacefulDays || 0) + 1;
      } else {
          room.peacefulDays = 0;
      }

      if (this.checkWinCondition(roomCode)) return;
  
      if (killedInfos.length > 0) {
         killedInfos.forEach(info => {
            this.io.to(roomCode).emit('morningNews', { killedPlayerName: info.name, killedPlayerAlignment: info.align, personalNote: info.personalNote, cause: info.cause });
         });
      } else {
         this.io.to(roomCode).emit('morningNews', { killedPlayerName: null });
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
      room.votes = {}; 
      this.changePhase(roomCode, 'VOTING', room.settings.votingTimer);
    }
    else if (oldPhase === 'VOTING') {
      const counts = {};
      for (let v in room.votes) {
        const t = room.votes[v].targetId;
        if (t !== 'SKIP') {
          counts[t] = (counts[t] || 0) + room.votes[v].weight;
        }
      }
      
      let topTarget = null;
      let max = 0;
      let tie = false;
      for (let t in counts) {
         if(counts[t] > max) { max = counts[t]; topTarget = t; tie = false; }
         else if(counts[t] === max) { tie = true; }
      }
  
      if (topTarget && !tie) {
         const lynched = room.players.find(p => p.socketId === topTarget);
         if (lynched) {
           lynched.isAlive = false;
           room.peacefulDays = 0; // Birisi linç edilerek öldü
           if (lynched.framedDay !== undefined && room.dayCount <= lynched.framedDay + 1) lynched.displayRole = 'Eşkıya';
           this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: lynched.name, lynchedPlayerAlignment: getColorAlignment(lynched.role), personalNote: lynched.personalNote, voteTally: max });
  
           if (lynched.role === 'Köy Delisi') {
              const guilty = Object.keys(room.votes).filter(id => room.votes[id].targetId === topTarget);
              room.deadJesterVotes = guilty;
              lynched.won = true;
           }
           
           // Kan Davalı (Executioner) kazandı mı?
           room.players.forEach(p => {
               if (p.role === 'Kan Davalı' && p.execTarget === topTarget) {
                   this.sendPrivateNews(roomCode, p.socketId, { text: `İntikamını aldın! Kan davalın ${room.players.find(x => x.socketId === p.execTarget)?.name || 'hedefini'} ipe götürdün, OYUNU SEN KAZANDIN! Artık arkanı yaslayıp rahatlayabilirsin.`, align: 'Yeşil' });
                   p.won = true;
               }
           });
         }
      } else {
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: null });
      }
  
      if (this.checkWinCondition(roomCode)) return;
      setTimeout(() => { 
         room.dayCount = (room.dayCount || 1) + 1;
         this.changePhase(roomCode, 'NIGHT', room.settings.nightTimer); 
      }, 5000); 
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

    // A. Beraberlik (15 gün kuralı)
    if (room.peacefulDays >= 15) {
       winningTeam = 'Beraberlik';
    }
    // B. Kundakçı Tek Başına
    else if (aruCount > 0 && alivePlayers.length === aruCount) {
       winningTeam = 'Kundakçı';
    }
    // C. Eşkıyalar Kazanır (Sayıca üstünlük ve tehdit kalmaması)
    else if (esiCount > 0 && esiCount >= alivePlayers.length / 2 && cCount === 0 && aruCount === 0) {
       winningTeam = 'Eşkıyalar';
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
       
       const supabase = require('./db');
       supabase.from('game_history').insert([{
           room_code: roomCode,
           game_mode: room.isDevMode ? 'DEV_MODE' : 'NORMAL',
           winner: winningTeam,
           players: results
       }]).then(({ error }) => {
           if (error) console.error("Supabase'e oyun kaydedilirken hata oluştu:", error);
       });

       return true;
    }
    return false;
  }
}

module.exports = GameEngine;
