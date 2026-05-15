# Mahkeme Sistemi (Suçlama → Savunma → Hüküm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gündüz linçini "en çok oyu alan otomatik asılır" modelinden, eşik tabanlı canlı suçlama + savunma + hüküm mahkemesine çevir.

**Architecture:** Saf karar mantığı yeni `backend/voteLogic.js` modülüne çıkarılır (birim testli, sıfır bağımlılık — `node --test`). `GameEngine` FSM'ine `DEFENSE` ve `JUDGMENT` fazları eklenir; gündüz timer'ı mahkemede `room.dayRemaining` ile duraklatılıp kaldığı yerden devam eder. `server.js` canlı suçlama oyunu DAY'e taşır, eşik aşılınca mahkemeyi tetikler. Frontend yeni faz panellerini ve "oyu geri al" butonunu render eder.

**Tech Stack:** Node.js (CommonJS) + socket.io 4.8 (backend), React 19 + Vite (frontend). Birim test: Node yerleşik `node:test` + `node:assert` (yeni paket yok). FSM/socket entegrasyonu: dev-mod manuel test (Task 7).

**Spec:** `docs/superpowers/specs/2026-05-15-trial-voting-design.md`

**Test stratejisi (oku, önemli):** Bu kod tabanında test koşucusu yok (`backend/package.json` test = `exit 1`). Saf, off-by-one riski taşıyan eşik/hüküm matematiği (kullanıcının asıl derdi) TDD ile birim testlenir (Task 1). Socket.io timer'larına bağlı durum geçişleri ağır mock gerektirir; bunlar Task 7'deki dev-mod manuel checklist ile doğrulanır. Bu, kod tabanı gerçeğine dürüst, TDD'yi değerli olduğu yerde uygular.

**Commit kuralları:** Düz `git add` / `git commit` kullan. Git hook'larını **asla** atlama (`--no-verify`, `core.hooksPath` vb. yasak). Commit mesajına `Co-Authored-By: Claude` **ekleme** (kullanıcı tüm geçmişten temizledi). Yalnız ilgili dosyaları stage'le (repoda alakasız untracked/deleted dosyalar var — `git add -A` kullanma).

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `backend/voteLogic.js` | Saf fonksiyonlar: eşik, ağırlık, suçlu aday bulma, hüküm değerlendirme | **Create** |
| `backend/voteLogic.test.js` | `voteLogic.js` birim testleri (`node --test`) | **Create** |
| `backend/GameEngine.js` | FSM: `DEFENSE`/`JUDGMENT` dalları, `startDefense`, `changePhase` trial alanı, DAY→NIGHT, VOTING dalı kaldırma | **Modify** |
| `backend/server.js` | Settings default ×2, `votePlayer`→DAY+tetik, `withdrawVote`, `judgmentVote`, DEFENSE sohbet, reset blokları | **Modify** |
| `frontend/src/App.jsx` | `defenseTimer` default+lobi input, `phaseChanged` trial passthrough | **Modify** |
| `frontend/src/components/GameBoard.jsx` | DAY canlı oy, DEFENSE/JUDGMENT panelleri, geri-al butonu, faz görselleri, `diedPhase` ikonu | **Modify** |
| `game-engine.md` | FSM dokümanı güncelleme | **Modify** |

---

## Task 1: Saf oy-mantığı modülü + birim testler (TDD)

**Files:**
- Create: `backend/voteLogic.js`
- Test: `backend/voteLogic.test.js`

- [ ] **Step 1: Failing test dosyasını yaz**

`backend/voteLogic.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nominationThreshold, weightFor, tallyNomination, findNominee, evaluateVerdict } = require('./voteLogic');

test('nominationThreshold = floor(alive/2)', () => {
  assert.equal(nominationThreshold(8), 4);
  assert.equal(nominationThreshold(7), 3);
  assert.equal(nominationThreshold(6), 3);
  assert.equal(nominationThreshold(5), 2);
  assert.equal(nominationThreshold(4), 2);
});

test('weightFor: açık Muhtar 3, diğerleri 1', () => {
  assert.equal(weightFor({ isMayorRevealed: true }), 3);
  assert.equal(weightFor({ isMayorRevealed: false }), 1);
  assert.equal(weightFor({}), 1);
});

test('tallyNomination ağırlıkları toplar, SKIP/null hariç', () => {
  const votes = {
    a: { targetId: 'X', weight: 1 },
    b: { targetId: 'X', weight: 3 },
    c: { targetId: 'Y', weight: 1 },
    d: { targetId: 'SKIP', weight: 1 },
    e: { targetId: null, weight: 1 },
  };
  assert.deepEqual(tallyNomination(votes), { X: 4, Y: 1 });
});

test('findNominee: ağırlıklı oy eşiği KESİN aşınca aday döner', () => {
  // 7 yaşıyor → eşik 3 → >3 gerekir
  const votes7 = { a:{targetId:'X',weight:3}, b:{targetId:'X',weight:1} }; // X=4 > 3
  assert.equal(findNominee(votes7, 7), 'X');
});

test('findNominee: eşiğe eşit yeterli değil (kesin büyük)', () => {
  const votes = { a:{targetId:'X',weight:3} }; // 7 yaşıyor, eşik 3, X=3, 3>3 değil
  assert.equal(findNominee(votes, 7), null);
});

test('findNominee: Muhtar(3) tek başına 4 kişide yeter (eşik 2)', () => {
  const votes = { m:{targetId:'X',weight:3} }; // alive 4 → eşik 2 → 3>2 ✓
  assert.equal(findNominee(votes, 4), 'X');
});

test('findNominee: kimse aşmazsa null', () => {
  const votes = { a:{targetId:'X',weight:1}, b:{targetId:'Y',weight:1} };
  assert.equal(findNominee(votes, 7), null);
});

test('evaluateVerdict: guiltyW > spareW → HANG', () => {
  const jv = { a:{verdict:'GUILTY',weight:3}, b:{verdict:'SPARE',weight:1}, c:{verdict:'SPARE',weight:1} };
  assert.equal(evaluateVerdict(jv), 'HANG'); // 3 > 2
});

test('evaluateVerdict: eşitlik → SPARE', () => {
  const jv = { a:{verdict:'GUILTY',weight:2}, b:{verdict:'SPARE',weight:2} };
  assert.equal(evaluateVerdict(jv), 'SPARE');
});

test('evaluateVerdict: oy yok → SPARE', () => {
  assert.equal(evaluateVerdict({}), 'SPARE');
});
```

- [ ] **Step 2: Testi çalıştır, FAIL gör**

Run: `cd backend && node --test voteLogic.test.js`
Expected: FAIL — `Cannot find module './voteLogic'`.

- [ ] **Step 3: `voteLogic.js`'i yaz (minimal implementasyon)**

`backend/voteLogic.js`:

```js
// Saf oy karar mantığı. Socket/IO/state yok — birim testlenebilir.

function nominationThreshold(aliveCount) {
  return Math.floor(aliveCount / 2);
}

function weightFor(player) {
  return player && player.isMayorRevealed ? 3 : 1;
}

// votes: { [voterId]: { targetId, weight } }  →  { [targetId]: toplamAğırlık }
function tallyNomination(votes) {
  const counts = {};
  for (const v in votes) {
    const t = votes[v].targetId;
    if (!t || t === 'SKIP') continue;
    counts[t] = (counts[t] || 0) + (votes[v].weight || 0);
  }
  return counts;
}

// Eşiği KESİN aşan ilk hedefi döndürür, yoksa null.
function findNominee(votes, aliveCount) {
  const threshold = nominationThreshold(aliveCount);
  const counts = tallyNomination(votes);
  for (const targetId in counts) {
    if (counts[targetId] > threshold) return targetId;
  }
  return null;
}

// judgmentVotes: { [voterId]: { verdict: 'GUILTY'|'SPARE', weight } }
function evaluateVerdict(judgmentVotes) {
  let guiltyW = 0, spareW = 0;
  for (const v in judgmentVotes) {
    const jv = judgmentVotes[v];
    if (jv.verdict === 'GUILTY') guiltyW += (jv.weight || 0);
    else if (jv.verdict === 'SPARE') spareW += (jv.weight || 0);
  }
  return guiltyW > spareW ? 'HANG' : 'SPARE';
}

module.exports = { nominationThreshold, weightFor, tallyNomination, findNominee, evaluateVerdict };
```

- [ ] **Step 4: Testi çalıştır, PASS gör**

Run: `cd backend && node --test voteLogic.test.js`
Expected: PASS — tüm testler (`# pass 10`, `# fail 0`).

- [ ] **Step 5: Commit**

```bash
git add backend/voteLogic.js backend/voteLogic.test.js
git commit -m "feat(vote): saf oy-mantigi modulu + birim testler"
```

---

## Task 2: GameEngine — DEFENSE/JUDGMENT fazları, DAY→NIGHT, VOTING dalını kaldır

**Files:**
- Modify: `backend/GameEngine.js` (satır 1 import; `changePhase` ~165-187; `processPhaseEnd` DAY dalı ~525-528; VOTING dalı ~529-579)

Önce bağlam için oku: `backend/GameEngine.js:165-187` ve `:505-580`.

- [ ] **Step 1: voteLogic import et**

Anchor (satır 1):
```js
const { ROLES, getColorAlignment, getInvestResults } = require('./roles');
```
Şununla değiştir:
```js
const { ROLES, getColorAlignment, getInvestResults } = require('./roles');
const voteLogic = require('./voteLogic');
```

- [ ] **Step 2: `changePhase` emit'ine `trial` ekle**

Anchor (changePhase içi, ~174):
```js
    this.io.to(roomCode).emit('phaseChanged', { phase, timeRemaining: timeInSeconds, dayCount: room.dayCount, doused: Object.keys(room.doused || {}) });
```
Şununla değiştir:
```js
    this.io.to(roomCode).emit('phaseChanged', { phase, timeRemaining: timeInSeconds, dayCount: room.dayCount, doused: Object.keys(room.doused || {}), trial: room.trial ? { accusedId: room.trial.accusedId, accusedName: room.trial.accusedName } : null });
```

- [ ] **Step 3: `startDefense` metodunu ekle**

`changePhase(...)` metodunun kapanış `}`'inden hemen SONRA, `processPhaseEnd(roomCode, oldPhase) {` satırından ÖNCE şu metodu ekle:

```js
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
```

- [ ] **Step 4: DAY dalını NIGHT'a çevir**

Anchor (~525-528):
```js
    else if (oldPhase === 'DAY') {
      room.votes = {}; 
      this.changePhase(roomCode, 'VOTING', room.settings.votingTimer);
    }
```
Şununla değiştir:
```js
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
```

- [ ] **Step 5: VOTING dalını DEFENSE + JUDGMENT dallarıyla değiştir**

Anchor — bu bloğun TAMAMINI (`else if (oldPhase === 'VOTING') {` ... kapanan `}`'e kadar, ~529-579) sil ve yerine aşağıdakini koy. Silinecek tam blok:
```js
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
           lynched.diedDay = room.dayCount;
           lynched.diedPhase = 'VOTING';
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
```
Yerine koy:
```js
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

         if (accused.role === 'Köy Delisi') {
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
```

- [ ] **Step 6: Sözdizimi/yük kontrolü**

Run: `cd backend && node -e "require('./GameEngine'); console.log('OK')"`
Expected: `OK` (parse hatası yok).

- [ ] **Step 7: Commit**

```bash
git add backend/GameEngine.js
git commit -m "feat(engine): DEFENSE/JUDGMENT fazlari, DAY->NIGHT, VOTING dali kaldirildi"
```

---

## Task 3: server.js — settings, canlı suçlama oyu, withdrawVote, judgmentVote, DEFENSE sohbet, reset

**Files:**
- Modify: `backend/server.js` (default settings ~466 ve ~535; reset ~682-707; `chatMessage` ~746-763; `votePlayer` ~855-874; ek handler'lar)

Önce bağlam: `backend/server.js:455-470`, `:528-539`, `:682-707`, `:746-763`, `:836-874`.

- [ ] **Step 1: defenseTimer default ekle (normal mod)**

Anchor (~466):
```js
      settings: { nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30 }
```
Şununla değiştir:
```js
      settings: { nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30, defenseTimer: 60 }
```

- [ ] **Step 2: defenseTimer default ekle (dev mod)**

Anchor (~535):
```js
      settings: { nightTimer: 30, morningTimer: 10, dayTimer: 45, votingTimer: 25 }
```
Şununla değiştir:
```js
      settings: { nightTimer: 30, morningTimer: 10, dayTimer: 45, votingTimer: 25, defenseTimer: 60 }
```

- [ ] **Step 3: voteLogic import (dosya başı)**

Anchor (~5):
```js
const crypto = require('crypto');
```
Şununla değiştir:
```js
const crypto = require('crypto');
const voteLogic = require('./voteLogic');
```

- [ ] **Step 4: returnToLobby reset bloğuna mahkeme alanları ekle**

Anchor (~695):
```js
       room.skipDayVotes = [];
       room.players.forEach(p => {
```
Şununla değiştir:
```js
       room.skipDayVotes = [];
       room.dayRemaining = 0;
       room.trial = null;
       room.judgmentVotes = {};
       room.acquittedToday = [];
       room.players.forEach(p => {
```

- [ ] **Step 5: `votePlayer` handler'ını DAY canlı suçlama + tetik olacak şekilde değiştir**

Anchor — şu bloğun tamamı (~855-874):
```js
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
```
Şununla değiştir:
```js
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
        engine.startDefense(roomCode, nomineeId);
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

  function emitJudgmentCounts(roomCode) {
     const room = rooms[roomCode];
     if (!room) return;
     let guiltyW = 0, spareW = 0;
     const details = {};
     for (const v in (room.judgmentVotes || {})) {
        const jv = room.judgmentVotes[v];
        const voterName = room.players.find(p => p.socketId === v)?.name;
        details[voterName] = jv.verdict;
        if (jv.verdict === 'GUILTY') guiltyW += jv.weight; else if (jv.verdict === 'SPARE') spareW += jv.weight;
     }
     io.to(roomCode).emit('judgmentCounts', { guiltyW, spareW, details });
  }

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
```

> Not: `engine` değişkeni server.js'te `votePlayer`'ın kullanıldığı kapsamda zaten mevcut (örn. `engine.processPhaseEnd` `forceNextPhase` içinde kullanılıyor). `getActorId` de aynı kapsamda. Fonksiyon bildirimleri (`function emitVoteCounts`) hoisting ile sorun çıkarmaz; aynı `io.on('connection')` callback gövdesine eklenir.

- [ ] **Step 6: DEFENSE'te yalnız sanık konuşsun; JUDGMENT'te herkes (gündüz gibi)**

Anchor — `chatMessage` handler'ı (~746-762) bağlamını oku. Şu satır:
```js
    const room = rooms[roomCode];
    if(room && room.status === 'DAY') {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      if (player && player.isAlive) {
```
Şununla değiştir:
```js
    const room = rooms[roomCode];
    if (room && (room.status === 'DAY' || room.status === 'JUDGMENT' || (room.status === 'DEFENSE' && room.trial))) {
      const actorId = getActorId(room, socket.id, impersonateId);
      const player = room.players.find(p => p.socketId === actorId);
      if (room.status === 'DEFENSE' && actorId !== room.trial.accusedId) return; // savunmada yalnız sanık
      if (player && player.isAlive) {
```

- [ ] **Step 7: Sözdizimi/yük kontrolü**

Run: `cd backend && node -e "require('./server')" ` *(server.js portu dinlemeye başlar; parse hatası yoksa OK — Ctrl yerine ayrı çalıştır:)*
Run yerine güvenli kontrol: `cd backend && node --check server.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`.

- [ ] **Step 8: Commit**

```bash
git add backend/server.js
git commit -m "feat(server): canli suclama oyu (DAY), withdrawVote, judgmentVote, defenseTimer"
```

---

## Task 4: Frontend App.jsx — defenseTimer ayarı + phaseChanged trial passthrough

**Files:**
- Modify: `frontend/src/App.jsx` (settings state ~88; lobi timer listesi ~586-587; phaseChanged ~183-188)

- [ ] **Step 1: settings default state'e defenseTimer ekle**

Anchor (~88):
```js
  const [settings, setSettings] = useState({ nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30, kirmizi: 4, gri: 2, yesil: 9 });
```
Şununla değiştir:
```js
  const [settings, setSettings] = useState({ nightTimer: 40, morningTimer: 10, dayTimer: 90, votingTimer: 30, defenseTimer: 60, kirmizi: 4, gri: 2, yesil: 9 });
```

- [ ] **Step 2: Lobi süre listesine "Savunma" ekle**

Anchor (~586-587):
```js
                          {['nightTimer', 'morningTimer', 'dayTimer', 'votingTimer'].map(k => {
                             const labelMap = { nightTimer: 'Gece', morningTimer: 'Sabah', dayTimer: 'Gün', votingTimer: 'Oylama' };
```
Şununla değiştir:
```js
                          {['nightTimer', 'morningTimer', 'dayTimer', 'votingTimer', 'defenseTimer'].map(k => {
                             const labelMap = { nightTimer: 'Gece', morningTimer: 'Sabah', dayTimer: 'Gün', votingTimer: 'Hüküm', defenseTimer: 'Savunma' };
```

- [ ] **Step 3: phaseChanged handler'ında trial state'i ilet**

Anchor (~183-188):
```js
    socket.on('phaseChanged', ({ phase, dayCount: newDay, doused }) => {
      setGamePhase(phase);
      if (newDay) setDayCount(newDay);
      if (doused) setDousedList(doused);
      setEventNews(null); 
    });
```
Şununla değiştir:
```js
    socket.on('phaseChanged', ({ phase, dayCount: newDay, doused, trial }) => {
      setGamePhase(phase);
      if (newDay) setDayCount(newDay);
      if (doused) setDousedList(doused);
      setTrial(trial || null);
      setEventNews(null); 
    });
```

- [ ] **Step 4: `trial` state'i tanımla**

Anchor (~85):
```js
  const [dayCount, setDayCount] = useState(1);
```
Şununla değiştir:
```js
  const [dayCount, setDayCount] = useState(1);
  const [trial, setTrial] = useState(null);
```

- [ ] **Step 5: GameBoard'a `trial` prop'unu geçir**

`grep -n "<GameBoard" frontend/src/App.jsx` ile GameBoard render satırını bul. Bağlam oku (o satır ± 15). GameBoard'a geçen props listesine `trial={trial}` ekle (örn. `dayCount={dayCount}` prop'unun hemen yanına). Tam edit:

Anchor (GameBoard'a geçen prop'lardan, dosyada birebir bulunan):
```jsx
                  dayCount={dayCount}
```
Şununla değiştir:
```jsx
                  dayCount={dayCount}
                  trial={trial}
```
> Eğer `dayCount={dayCount}` GameBoard çağrısında birden çok kez yoksa bu güvenlidir; varsa GameBoard JSX'indeki tek örneği hedefle (Read ile teyit et).

- [ ] **Step 6: Lint/derleme kontrolü**

Run: `cd frontend && npx eslint src/App.jsx`
Expected: Hata yok (uyarı kabul).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(ui): defenseTimer lobi ayari + phaseChanged trial state"
```

---

## Task 5: Frontend GameBoard.jsx — DAY canlı oy, DEFENSE/JUDGMENT panelleri, geri-al, görseller

**Files:**
- Modify: `frontend/src/components/GameBoard.jsx`

Önce bağlam oku: `:1-37` (props/imports), `:122-133` (handleVote), `:165-207` (faz yardımcıları), `:540-699` (aksiyon paneli), ve `grep -n "diedPhase === 'VOTING'" GameBoard.jsx` (~1089) + `grep -n "gamePhase === 'VOTING'" GameBoard.jsx` (tüm VOTING render blokları).

- [ ] **Step 1: `trial` prop'unu imzaya ekle**

`grep -n "function GameBoard" frontend/src/components/GameBoard.jsx` ile bileşen imzasını bul ve destructure props'a `trial` ekle. Örnek anchor (Read ile teyit et — gerçek imza farklı olabilir):
```js
function GameBoard({ socket, roomCode, players, gamePhase, dayCount, ...
```
`gamePhase, dayCount,` ifadesinden hemen sonra `trial,` ekle (varsayılan: `trial = null`). Edit:
```js
function GameBoard({ socket, roomCode, players, gamePhase, dayCount, trial = null,
```
> Gerçek imzayı Read ile doğrula; yalnız `trial = null` parametresini props listesine ekle.

- [ ] **Step 2: Faz görselleri — DEFENSE/JUDGMENT ekle**

Anchor (`getPhaseIcon`, ~170):
```js
       case 'VOTING': return <AlertTriangle className="w-8 h-8 sm:w-6 sm:h-6 text-red-300 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />;
```
Şununla değiştir:
```js
       case 'DEFENSE': return <ShieldAlert className="w-8 h-8 sm:w-6 sm:h-6 text-amber-300 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />;
       case 'JUDGMENT': return <AlertTriangle className="w-8 h-8 sm:w-6 sm:h-6 text-red-300 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />;
```

Anchor (`getPhaseTextClass`, ~181):
```js
      case 'VOTING':  return 'text-red-200 drop-shadow-[0_0_12px_rgba(127,29,29,0.6)]';
```
Şununla değiştir:
```js
      case 'DEFENSE': return 'text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]';
      case 'JUDGMENT': return 'text-red-200 drop-shadow-[0_0_12px_rgba(127,29,29,0.6)]';
```

Anchor (`getPhasePillClass`, ~192):
```js
      case 'VOTING':  return 'bg-red-950/50 border-red-900/60 shadow-[inset_0_0_20px_rgba(127,29,29,0.20)]';
```
Şununla değiştir:
```js
      case 'DEFENSE': return 'bg-amber-950/40 border-amber-800/50 shadow-[inset_0_0_20px_rgba(251,191,36,0.15)]';
      case 'JUDGMENT': return 'bg-red-950/50 border-red-900/60 shadow-[inset_0_0_20px_rgba(127,29,29,0.20)]';
```

Anchor (`getPhaseNameTR`, ~203):
```js
      case 'VOTING': return `${dayCount}. Gün (Hüküm Vakti)`;
```
Şununla değiştir:
```js
      case 'DEFENSE': return `${dayCount}. Gün (Savunma)`;
      case 'JUDGMENT': return `${dayCount}. Gün (Hüküm Vakti)`;
```

- [ ] **Step 3: Üst aksiyon paneli görünürlük koşullarını güncelle (VOTING → DAY/DEFENSE/JUDGMENT)**

Anchor (~546):
```js
        <div className={`transition-all duration-500 overflow-hidden border-b border-slate-800/30 bg-slate-900/40 ${['NIGHT', 'VOTING', 'MORNING'].includes(gamePhase) ? 'min-h-[140px] max-h-[200px]' : 'max-h-[0px]'}`}>
```
Şununla değiştir:
```js
        <div className={`transition-all duration-500 overflow-hidden border-b border-slate-800/30 bg-slate-900/40 ${['NIGHT', 'DAY', 'DEFENSE', 'JUDGMENT', 'MORNING'].includes(gamePhase) ? 'min-h-[140px] max-h-[220px]' : 'max-h-[0px]'}`}>
```

Anchor (~549):
```js
           {hasActioned && ['NIGHT', 'VOTING'].includes(gamePhase) && me.isAlive && !isSpectator && (
```
Şununla değiştir:
```js
           {hasActioned && ['NIGHT'].includes(gamePhase) && me.isAlive && !isSpectator && (
```

- [ ] **Step 4: VOTING aksiyon bloğunu DAY canlı suçlama bloğuyla değiştir**

Anchor — şu bloğun tamamı (~621-633):
```js
           {/* OYLAMA AKSİYONU */}
           {gamePhase === 'VOTING' && me.isAlive && !isSpectator && !hasActioned && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-2 px-2 gap-2">
                    <p className="text-accent text-[11px] sm:text-[10px] font-black tracking-widest uppercase shrink-0">Kuyuya At</p>
                    <div className="flex gap-2 shrink-0">
                       <button onClick={() => handleVote(true)} className="bg-slate-700 text-slate-300 text-xs sm:text-[9px] font-black uppercase px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full">Pas Geç</button>
                       {selectedPlayer && <button onClick={() => handleVote(false)} className="bg-accent text-white text-xs sm:text-[9px] font-black uppercase px-5 sm:px-4 py-2.5 sm:py-1.5 rounded-full shadow-lg">Oyla</button>}
                    </div>
                 </div>
                 <PlayerList players={players.filter(p => !p.isMayorRevealed || p.socketId !== activeSocketId).filter(p => p.socketId !== activeSocketId && p.isAlive)} selected={selectedPlayer} onSelect={setSelectedPlayer} isDevMode={isDevMode} />
              </div>
           )}
```
Şununla değiştir:
```js
           {/* GÜNDÜZ CANLI SUÇLAMA OYU */}
           {gamePhase === 'DAY' && me.isAlive && !isSpectator && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-2 px-2 gap-2">
                    <p className="text-accent text-[11px] sm:text-[10px] font-black tracking-widest uppercase shrink-0">Kuyuya Oyla</p>
                    <div className="flex gap-2 shrink-0">
                       <button onClick={() => socket.emit('withdrawVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-slate-700 text-slate-300 text-xs sm:text-[9px] font-black uppercase px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full">Oyu Geri Al</button>
                       {selectedPlayer && <button onClick={() => handleVote(false)} className="bg-accent text-white text-xs sm:text-[9px] font-black uppercase px-5 sm:px-4 py-2.5 sm:py-1.5 rounded-full shadow-lg">Oyla</button>}
                    </div>
                 </div>
                 <PlayerList players={players.filter(p => p.socketId !== activeSocketId && p.isAlive)} selected={selectedPlayer} onSelect={setSelectedPlayer} isDevMode={isDevMode} />
              </div>
           )}

           {/* SAVUNMA */}
           {gamePhase === 'DEFENSE' && (
              <div className="p-3 h-full flex items-center justify-center animate-in fade-in duration-300">
                 <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/50 px-5 py-3 rounded-2xl shadow-[0_0_18px_rgba(251,191,36,0.10)] max-w-md w-full">
                    <ShieldAlert className="text-amber-300 shrink-0 w-9 h-9 sm:w-7 sm:h-7 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <div className="flex flex-col min-w-0 flex-1">
                       <p className="text-amber-300 text-xs sm:text-[11px] font-black uppercase tracking-widest">Savunma</p>
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">🪦 {trial?.accusedName || 'Sanık'} kuyu başında kendini savunuyor…{trial && me.socketId === trial.accusedId ? ' (Konuşma hakkı sende!)' : ''}</p>
                    </div>
                 </div>
              </div>
           )}

           {/* HÜKÜM */}
           {gamePhase === 'JUDGMENT' && (
              <div className="p-3 animate-in slide-in-from-top duration-300 h-full flex flex-col justify-center">
                 {trial && me.isAlive && !isSpectator && me.socketId !== trial.accusedId ? (
                    <div className="flex flex-col items-center gap-3">
                       <p className="text-red-200 text-[11px] sm:text-[10px] font-black tracking-widest uppercase">{trial.accusedName} asılsın mı?</p>
                       <div className="flex gap-3">
                          <button onClick={() => socket.emit('judgmentVote', { roomCode, verdict: 'GUILTY', impersonateId: isDevMode ? impersonateId : null })} className="bg-blood-red text-white text-sm sm:text-xs font-black uppercase px-6 py-3 rounded-xl shadow-lg">Suçlu</button>
                          <button onClick={() => socket.emit('judgmentVote', { roomCode, verdict: 'SPARE', impersonateId: isDevMode ? impersonateId : null })} className="bg-emerald-800 text-white text-sm sm:text-xs font-black uppercase px-6 py-3 rounded-xl shadow-lg">Affet</button>
                          <button onClick={() => socket.emit('withdrawVote', { roomCode, impersonateId: isDevMode ? impersonateId : null })} className="bg-slate-700 text-slate-300 text-xs font-black uppercase px-4 py-3 rounded-xl">Geri Al</button>
                       </div>
                       {judgmentCounts && <p className="text-[10px] text-slate-400 uppercase tracking-wider">Suçlu {judgmentCounts.guiltyW} — Affet {judgmentCounts.spareW}</p>}
                    </div>
                 ) : (
                    <div className="flex items-center justify-center h-full">
                       <p className="text-slate-200 text-sm sm:text-xs font-serif italic">{trial && me.socketId === trial.accusedId ? 'Yargılanıyorsun — oy veremezsin, kaderini bekle…' : 'Köy hüküm veriyor…'}</p>
                    </div>
                 )}
              </div>
           )}
```

- [ ] **Step 5: VOTING dead/spectator bekleme bloğunu JUDGMENT'e çevir**

Anchor (~661-672):
```js
           {/* OYLAMA — dead/spectator için bekleme */}
           {gamePhase === 'VOTING' && (isSpectator || !me.isAlive) && (
```
Şununla değiştir:
```js
           {/* HÜKÜM — dead/spectator için bekleme */}
           {gamePhase === 'JUDGMENT' && (isSpectator || !me.isAlive) && (
```

- [ ] **Step 6: `judgmentCounts` state + soketi dinle**

Anchor (~45-47):
```js
    socket.on('voteCounts', (data) => {
       setVoteDetails(data.details || {});
    });
```
Şununla değiştir:
```js
    socket.on('voteCounts', (data) => {
       setVoteDetails(data.details || {});
    });
    socket.on('judgmentCounts', (data) => {
       setJudgmentCounts(data);
    });
```
Anchor (~55):
```js
       socket.off('voteCounts');
```
Şununla değiştir:
```js
       socket.off('voteCounts');
       socket.off('judgmentCounts');
```
Anchor (~40):
```js
  const [skipDayCount, setSkipDayCount] = useState({ count: 0, total: 0 });
```
Şununla değiştir:
```js
  const [skipDayCount, setSkipDayCount] = useState({ count: 0, total: 0 });
  const [judgmentCounts, setJudgmentCounts] = useState(null);
```
Anchor (~75-77):
```js
    if(gamePhase !== 'VOTING') {
       setVoteDetails({});
    }
```
Şununla değiştir:
```js
    if(gamePhase !== 'DAY') {
       setVoteDetails({});
    }
    if(gamePhase !== 'JUDGMENT') {
       setJudgmentCounts(null);
    }
```

- [ ] **Step 7: `diedPhase` ikon koşuluna JUDGMENT ekle**

`grep -n "diedPhase === 'VOTING'" frontend/src/components/GameBoard.jsx` ile satırı bul (~1089). Anchor:
```js
                                 {p.diedPhase === 'VOTING' && <AlertTriangle size={11} className="text-amber-500/70 shrink-0" />}
```
Şununla değiştir:
```js
                                 {(p.diedPhase === 'VOTING' || p.diedPhase === 'JUDGMENT') && <AlertTriangle size={11} className="text-amber-500/70 shrink-0" />}
```

- [ ] **Step 8: Kalan `gamePhase === 'VOTING'` referanslarını denetle**

Run: `grep -n "VOTING" frontend/src/components/GameBoard.jsx`
Her kalan eşleşmeyi Read ile incele:
- Oy sayım/tally gösterimi blokları (~864, ~1101): `gamePhase === 'VOTING'` → `gamePhase === 'DAY'` yap (canlı suçlama sayımı artık gündüzde gösterilsin). Her birini Read edip bağlamı koruyarak düzenle; mantık aynı (voteDetails gösterimi), yalnız faz adı değişir.
- Başka kalan VOTING yoksa devam.
Expected sonuç: GameBoard.jsx'te işlevsel `'VOTING'` kalmaması (yorum hariç).

- [ ] **Step 9: Lint kontrolü**

Run: `cd frontend && npx eslint src/components/GameBoard.jsx`
Expected: Hata yok.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "feat(ui): DAY canli suclama, DEFENSE/JUDGMENT panelleri, oyu geri al"
```

---

## Task 6: game-engine.md FSM dokümanını güncelle

**Files:**
- Modify: `game-engine.md`

- [ ] **Step 1: Durum bölümlerini güncelle**

`game-engine.md` içinde `### [Durum: GAME_STARTING]`, `### [Durum: NIGHT]`, `### [Durum: VOTING]` bölümlerini Read et. Şu değişiklikleri uygula:
- `GAME_STARTING` geçişi: "Süre dolduğunda otomatik olarak **DAY** durumuna geçilir." (NIGHT değil)
- `### [Durum: DAY]` altına: "Oyuncular **canlı suçlama oyu** kullanır. Bir hedefin ağırlıklı oyu yaşayan oyuncu sayısının yarısını (`floor(alive/2)`) **aşarsa** o kişi `DEFENSE`'e çıkar; gündüz sayacı `dayRemaining`'e saklanıp duraklatılır."
- `### [Durum: VOTING]` bölümünü tümüyle şu iki bölümle değiştir:
```markdown
### [Durum: DEFENSE]
- **Tanım:** Suçlanan oyuncunun kuyu başında kendini savunduğu süre (lobi ayarı `defenseTimer`, default 60sn).
- **Kısıt:** Yalnız sanık konuşabilir.
- **Geçiş:** Süre dolunca `JUDGMENT`.

### [Durum: JUDGMENT]
- **Tanım:** Sanık üzerinde "Suçlu/Affet" hükmü (`votingTimer` süresi). Sanık oy veremez. Ağırlıklı `Suçlu > Affet` ise asılır.
- **Geçiş:** Sonuç sonrası, `dayRemaining > 0` ise `DAY` (kaldığı yerden); değilse `NIGHT`. Affedilen o gün tekrar yargılanamaz; günde birden fazla asılma mümkün.
- **Geçiş (DAY sonu):** Gündüz süresi eşik aşılmadan biterse `dayCount++` ve `NIGHT` (kimse asılmaz; eski "en çok oy" otomatik linç kaldırıldı).
```

- [ ] **Step 2: Commit**

```bash
git add game-engine.md
git commit -m "docs: FSM dokumani mahkeme sistemine guncellendi"
```

---

## Task 7: Dev-mod manuel entegrasyon testi

**Files:** (kod değişikliği yok — doğrulama)

Backend'i başlat (`cd backend && npm start`), frontend'i başlat (`cd frontend && npm run dev`), `?admin=true` veya dev oda ile bot ekleyerek aşağıdaki senaryoları sırayla doğrula. Her madde için gözlemi `docs/superpowers/plans/2026-05-15-trial-voting.md`'ye not düşmek yerine sadece geç/kaldı işaretle (checkbox).

- [ ] **Step 1:** 7 oyuncu/bot. Bir hedefe ağırlıklı 4 oy → `DEFENSE` tetiklenir; gündüz timer durur; `phaseChanged.trial.accusedName` doğru.
- [ ] **Step 2:** Açık Muhtar + 1 normal oy (7 kişi) → eşik aşılır (3+1=4 > 3) ve `DEFENSE`.
- [ ] **Step 3:** 7 kişide tek hedefe tam 3 ağırlık → tetiklenmez (3 > 3 değil).
- [ ] **Step 4:** `JUDGMENT`: ağırlıklı Suçlu > Affet → asılır; `voteResult` gelir; Suçlu = Affet → affedilir, `acquittedToday`'e girer.
- [ ] **Step 5:** Affedilen aynı gün yeniden eşik aşsa bile `DEFENSE` tetiklenmez; farklı hedef tetiklenir → 2. asılma aynı gün.
- [ ] **Step 6:** Mahkeme sonrası `DAY` kalan süreyle devam eder; `dayRemaining ≤ 0` ise doğrudan `NIGHT` + `dayCount++`.
- [ ] **Step 7:** DAY'de "Oyu Geri Al" sayımı düşürür; JUDGMENT'te verdict'i geri alır (`judgmentCounts` güncellenir).
- [ ] **Step 8:** `DEFENSE` sırasında yalnız sanık sohbet edebilir; diğerlerinin mesajı düşmez.
- [ ] **Step 9:** Gündüz süresi eşik aşılmadan biter → kimse asılmaz, `NIGHT`, `dayCount++`.
- [ ] **Step 10:** Köy Delisi `JUDGMENT`'te asılır → jester kazanır; `deadJesterVotes` GUILTY oyçularından dolu.
- [ ] **Step 11:** Dev `forceNextPhase` `DAY→(tetikle)→DEFENSE→JUDGMENT→DAY/NIGHT` zincirini atlayabiliyor.
- [ ] **Step 12:** Birim testler hâlâ yeşil: `cd backend && node --test voteLogic.test.js` → `# fail 0`.

- [ ] **Step 13: Kapanış commit (yalnız bu plandaki checkbox işaretlemeleri varsa)**

```bash
git add docs/superpowers/plans/2026-05-15-trial-voting.md
git commit -m "docs: mahkeme sistemi manuel test gecisi isaretlendi"
```

---

## Self-Review

**Spec coverage:** spec §4 FSM → Task 2; §5 eşik / §6 hüküm matematiği → Task 1 (TDD); §7 oda alanları → Task 2 (`startDefense`, JUDGMENT) + Task 3 (reset); §8 ayarlar → Task 3 (backend ×2) + Task 4 (frontend); §9 socket API (`votePlayer`/`withdrawVote`/`judgmentVote`/`judgmentCounts`/DEFENSE chat) → Task 3; §10 frontend → Task 4 + Task 5; §11 kenar durumlar → Task 2 (kilit: votePlayer guard yalnız DAY; jester/exec JUDGMENT'e taşındı; dayRemaining≤0→NIGHT; checkWinCondition hang sonrası) + Task 7 doğrulama; §13 test planı → Task 7. `skipDayVote`: kod değişikliği gerekmiyor — mevcut `engine.processPhaseEnd(roomCode,'DAY')` çağrısı Task 2'deki yeni DAY→NIGHT dalı sayesinde otomatik olarak geceye götürür (Task 7 Step 9 ile doğrulanır). `forceNextPhase`: mevcut kod `room.status`'u processPhaseEnd'e geçirdiği için DEFENSE/JUDGMENT otomatik desteklenir (Task 7 Step 11).

**Placeholder scan:** "TBD/TODO/handle edge cases" yok. Her kod adımı tam içerik veriyor. Frontend imza/anchor adımlarında "Read ile doğrula" notu var çünkü GameBoard.jsx büyük ve imza birebir görülmedi — bu bir placeholder değil, anchor güvenliği için açık talimat; değiştirilecek tam string ve yeni string verili.

**Type consistency:** `votes` şekli `{voterId:{targetId,weight}}` Task1/Task2/Task3 tutarlı. `judgmentVotes` `{voterId:{verdict,weight}}` Task1 `evaluateVerdict`, Task2 JUDGMENT dalı, Task3 `judgmentVote`/`emitJudgmentCounts` tutarlı. `room.trial` `{accusedId,accusedName}` Task2 `startDefense`/`changePhase`, Task4 phaseChanged, Task5 panel tutarlı. `findNominee`/`weightFor`/`evaluateVerdict` imzaları Task1'de tanımlı, Task2/Task3'te aynı isimle çağrılıyor. `emitVoteCounts`/`emitJudgmentCounts` Task3'te tanımlı ve aynı dosyada çağrılıyor. Faz adları `DEFENSE`/`JUDGMENT` tüm tasklarda birebir aynı.

Düzeltildi/teyit: `skipDayVote` ve `forceNextPhase` için ayrı task gerekmediği yukarıda gerekçelendirildi (kod zaten `processPhaseEnd`/`room.status` üzerinden yeni davranışı miras alıyor).
