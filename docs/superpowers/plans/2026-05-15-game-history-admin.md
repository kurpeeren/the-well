# Oyun Sohbet/Olay/Ölüm Geçmişi + Admin Görüntüleme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her NORMAL oyunun tüm sohbeti, olay zaman çizelgesi ve ölüm ("kuyu dibi") listesi oyun sonunda Supabase `game_history`'ye yazılsın ve admin panelinde oyun bazında görüntülensin.

**Architecture:** İzole `backend/gameLog.js` modülü (cap'li `pushChat`/`pushEvent`) oyun boyunca `room.chatLog`/`room.eventLog`'a biriktirir. Mevcut sohbet/olay emit noktalarının yanına 1 satırlık log eklenir. Oyun sonunda (`GameEngine.checkWinCondition`) yalnız NORMAL oyunlar için insert genişler. Admin liste endpoint'i ağır sütunları dışlar; tek oyunun logları yeni bir endpoint'ten satır açılınca lazy çekilir.

**Tech Stack:** Node.js (CommonJS) + socket.io + Supabase (`@supabase/supabase-js`). Frontend React 19 + Vite. Birim test: Node yerleşik `node:test` (yeni paket yok). Socket/Supabase entegrasyonu: manuel + syntax/build doğrulaması.

**Spec:** `docs/superpowers/specs/2026-05-15-game-history-admin-design.md`

---

## ⚠️ PREREQUISITE — Supabase migration (deploy sırası kritik)

Aşağıdaki SQL **kod deploy edilmeden ÖNCE** Supabase'de çalıştırılmalı. Aksi halde Task 4'teki genişletilmiş `insert` yeni sütunları bilmeyen tabloya yazmaya çalışır ve **tüm `game_history` insert'i hata verir** (oyun sonucu hiç kaydedilmez — mevcut işlevde regresyon). Sıra: (1) migration uygula → (2) kodu deploy et.

```sql
alter table game_history
  add column if not exists chat_log  jsonb not null default '[]'::jsonb,
  add column if not exists event_log jsonb not null default '[]'::jsonb,
  add column if not exists deaths    jsonb not null default '[]'::jsonb;
```

`db.js` projesi: `olmissmcnqzzfvygeqtg` (ref). Migration Task 6'da kullanıcı tarafından Supabase SQL editöründen uygulanır (bu plan onu otomatik uygulamaz; ortam erişimi varsayılmaz).

## Commit kuralları (TÜM task'lar — STRICT)

- `main` dalında çalış (kullanıcı doğrudan main onayladı). Yalnız o task'ın dosyalarını `git add <dosya>` ile stage'le — repoda alakasız dirty/untracked dosyalar var, **asla `git add -A`/`.`**.
- Git hook'larını **asla** atlama (`--no-verify`, `core.hooksPath`, `-c` hook override yok). Hook hata verirse bildir, çözme.
- Commit mesajına `Co-Authored-By: Claude` (veya herhangi Claude co-author) trailer **ekleme**.
- **Subagent git güvenliği:** index/worktree'yi değiştiren git komutu çalıştırma — yalnız `git log/show/diff/status/rev-parse` + kendi `git add <dosya>`/`git commit`. `git checkout/restore/reset/stash/clean/revert/rm` YASAK. (Geçmişte bir reviewer subagent `git restore` ile çalışma kopyasını bozdu.) Reviewer'lar kodu `git show <sha>:path` ve Read ile inceler.

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `backend/gameLog.js` | `pushChat` (2000 cap), `pushEvent` — saf, izole | **Create** |
| `backend/gameLog.test.js` | gameLog birim testleri (`node --test`) | **Create** |
| `backend/server.js` | gameLog require; oda init ×2; reset (returnToLobby+startGame); 3 sohbet handler'da pushChat; mayorReveal'da pushEvent; `/api/admin/history` select daraltma; yeni `/api/admin/history/:id/logs` | **Modify** |
| `backend/GameEngine.js` | gameLog require; changePhase/morningNews/voteResult/oyun-sonu pushEvent; `deaths` türetme; insert genişletme + DEV_MODE skip | **Modify** |
| `frontend/src/components/Admin.jsx` | Geçmiş satır açılımına Kuyu Dibi + lazy Sohbet/Olay paneli (sekme/çip + state + fetch) | **Modify** |

**Test stratejisi:** `gameLog.js` saf cap mantığı TDD ile birim testlenir (Task 1). Socket/Supabase/UI entegrasyonu kod tabanında test koşucusu olmadığı için Task 6'daki manuel checklist + `node --check`/`npm run build` ile doğrulanır.

---

## Task 1: `gameLog.js` modülü + birim testler (TDD)

**Files:**
- Create: `backend/gameLog.js`
- Test: `backend/gameLog.test.js`

- [ ] **Step 1: Failing test yaz** — `backend/gameLog.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pushChat, pushEvent, CHAT_CAP } = require('./gameLog');

test('CHAT_CAP = 2000', () => {
  assert.equal(CHAT_CAP, 2000);
});

test('pushChat cap altında ekler', () => {
  const room = {};
  pushChat(room, { ch: 'day', sender: 'A', msg: 'x', day: 1, phase: 'DAY', ts: 1 });
  pushChat(room, { ch: 'dead', sender: 'B', msg: 'y', day: 1, phase: 'NIGHT', ts: 2 });
  assert.equal(room.chatLog.length, 2);
  assert.equal(room.chatLog[0].sender, 'A');
  assert.equal(room.chatLog[1].ch, 'dead');
});

test('pushChat cap aşımında en eskileri atar, uzunluk == CHAT_CAP', () => {
  const room = { chatLog: [] };
  for (let i = 0; i < CHAT_CAP + 50; i++) pushChat(room, { ch: 'day', sender: 's', msg: String(i), day: 1, phase: 'DAY', ts: i });
  assert.equal(room.chatLog.length, CHAT_CAP);
  // En eski 50 düştü → ilk eleman msg '50'
  assert.equal(room.chatLog[0].msg, '50');
  assert.equal(room.chatLog[CHAT_CAP - 1].msg, String(CHAT_CAP + 49));
});

test('pushEvent sınırsız ekler', () => {
  const room = {};
  for (let i = 0; i < 5000; i++) pushEvent(room, { type: 'phase', text: 't', day: 1, phase: 'DAY', ts: i });
  assert.equal(room.eventLog.length, 5000);
});

test('null/undefined room güvenli (çökmez)', () => {
  assert.doesNotThrow(() => pushChat(null, { msg: 'x' }));
  assert.doesNotThrow(() => pushEvent(undefined, { type: 'end' }));
});
```

- [ ] **Step 2: Testi çalıştır, FAIL gör**

Run: `cd backend && node --test gameLog.test.js`
Expected: FAIL — `Cannot find module './gameLog'`.

- [ ] **Step 3: `backend/gameLog.js` yaz**

```js
// Oyun içi sohbet/olay biriktirme. Saf, izole — birim testlenebilir.

const CHAT_CAP = 2000;

function pushChat(room, entry) {
  if (!room) return;
  if (!room.chatLog) room.chatLog = [];
  room.chatLog.push(entry);
  const over = room.chatLog.length - CHAT_CAP;
  if (over > 0) room.chatLog.splice(0, over);
}

function pushEvent(room, entry) {
  if (!room) return;
  if (!room.eventLog) room.eventLog = [];
  room.eventLog.push(entry);
}

module.exports = { pushChat, pushEvent, CHAT_CAP };
```

- [ ] **Step 4: Testi çalıştır, PASS gör**

Run: `cd backend && node --test gameLog.test.js`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/gameLog.js backend/gameLog.test.js
git commit -m "feat(log): gameLog modulu (pushChat cap + pushEvent) + birim testler"
```

---

## Task 2: server.js — oda durumu + sohbet/muhtar yakalama

**Files:**
- Modify: `backend/server.js`

Önce bağlam oku: `backend/server.js:1-10` (require'lar), `:478-500` (normal oda), `:552-573` (dev oda), `:692-712` (startGame), `:722-751` (returnToLobby), `:790-868` (3 sohbet handler + mayorReveal). Satır numaraları yaklaşık; anchor'ları gerçek metne göre eşle.

- [ ] **Step 1: gameLog require**

Anchor (`backend/server.js:5-6`):
```js
const crypto = require('crypto');
const voteLogic = require('./voteLogic');
```
Şununla değiştir:
```js
const crypto = require('crypto');
const voteLogic = require('./voteLogic');
const { pushChat, pushEvent } = require('./gameLog');
```

- [ ] **Step 2: Normal oda nesnesine log alanları**

Anchor (`:486-487`):
```js
      deadJesterVotes: [],
      dayRemaining: 0,
```
Şununla değiştir:
```js
      deadJesterVotes: [],
      chatLog: [],
      eventLog: [],
      dayRemaining: 0,
```

- [ ] **Step 3: Dev oda nesnesine log alanları**

Anchor (`:560-561`):
```js
      deadJesterVotes: [],
      dayRemaining: 0,
```
Bu desen iki yerde geçer (normal + dev). Step 2 normal odayı değiştirdi; şimdi `isDevMode: true` içeren dev oda nesnesindeki ikinci örneği değiştir. Dev oda bloğunu (`rooms[roomCode] = { ... isDevMode: true ... }`, ~552-573) Read ile bul, oradaki `deadJesterVotes: [],` + `dayRemaining: 0,` ikilisini şununla değiştir:
```js
      deadJesterVotes: [],
      chatLog: [],
      eventLog: [],
      dayRemaining: 0,
```

- [ ] **Step 4: returnToLobby reset**

Anchor (`:738-739`):
```js
       room.judgmentVotes = {};
       room.acquittedToday = [];
```
Şununla değiştir:
```js
       room.judgmentVotes = {};
       room.acquittedToday = [];
       room.chatLog = [];
       room.eventLog = [];
```

- [ ] **Step 5: startGame defansif temizleme**

Anchor (`:695-697`):
```js
      engine.assignRoles(room);
      room.status = 'GAME_STARTING';
      io.to(roomCode).emit('gameStarted', room.players);
```
Şununla değiştir:
```js
      engine.assignRoles(room);
      room.chatLog = [];
      room.eventLog = [];
      room.status = 'GAME_STARTING';
      io.to(roomCode).emit('gameStarted', room.players);
```

- [ ] **Step 6: chatMessage (gündüz) yakalama**

Anchor (`:805`):
```js
         io.to(roomCode).emit('chatMessage', { sender: player.name, message, ts: now });
```
Şununla değiştir:
```js
         io.to(roomCode).emit('chatMessage', { sender: player.name, message, ts: now });
         pushChat(room, { ch: 'day', sender: player.name, msg: String(message).slice(0, 1000), day: room.dayCount, phase: room.status, ts: now });
```

- [ ] **Step 7: deadChatMessage yakalama**

Anchor (`:826-828`):
```js
         if (room.isDevMode) io.to(room.host).emit('chatMessage', { sender: senderLabel, message, type: 'dead', ts: now });
      }
    }
  });
```
Şununla değiştir:
```js
         if (room.isDevMode) io.to(room.host).emit('chatMessage', { sender: senderLabel, message, type: 'dead', ts: now });
         pushChat(room, { ch: 'dead', sender: senderLabel, msg: String(message).slice(0, 1000), day: room.dayCount, phase: room.status, ts: now });
      }
    }
  });
```

- [ ] **Step 8: mafiaChatMessage yakalama**

Anchor (`:851-853`):
```js
         if (room.isDevMode) io.to(room.host).emit('chatMessage', { sender: `[Çete] ${player.name}`, message, type: 'mafia', ts: now });
      }
    }
  });
```
Şununla değiştir:
```js
         if (room.isDevMode) io.to(room.host).emit('chatMessage', { sender: `[Çete] ${player.name}`, message, type: 'mafia', ts: now });
         pushChat(room, { ch: 'mafia', sender: `[Çete] ${player.name}`, msg: String(message).slice(0, 1000), day: room.dayCount, phase: room.status, ts: now });
      }
    }
  });
```

- [ ] **Step 9: mayorReveal olay yakalama**

Anchor (`:865`):
```js
         io.to(roomCode).emit('mayorRevealed', { playerName: player.name });
```
Şununla değiştir:
```js
         io.to(roomCode).emit('mayorRevealed', { playerName: player.name });
         pushEvent(room, { type: 'mayor', text: `${player.name} Muhtar olduğunu açıkladı`, day: room.dayCount, phase: room.status, ts: Date.now(), meta: { name: player.name } });
```

- [ ] **Step 10: Sözdizimi kontrolü**

Run: `cd backend && node --check server.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`.
Run: `cd backend && node --test gameLog.test.js`
Expected: `# fail 0` (require zinciri sağlam).

- [ ] **Step 11: Commit**

```bash
git add backend/server.js
git commit -m "feat(log): server.js sohbet/muhtar yakalama + oda log durumu"
```

---

## Task 3: server.js — admin geçmiş API (hafif liste + lazy logs)

**Files:**
- Modify: `backend/server.js` (`:344-357` ve hemen sonrası)

- [ ] **Step 1: Liste endpoint'inden ağır sütunları dışla**

Anchor (`:347-351`):
```js
    const { data, error } = await supabase
        .from('game_history')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
```
Şununla değiştir:
```js
    const { data, error } = await supabase
        .from('game_history')
        .select('id,created_at,room_code,game_mode,winner,players,deaths')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
```

- [ ] **Step 2: Yeni `/api/admin/history/:id/logs` endpoint'i**

Anchor — `/api/admin/history` handler'ının kapanışı (`:356-357`):
```js
    res.json(data);
});
```
Bu, dosyada birden çok kez geçebilir; `app.get('/api/admin/history', ...)` handler'ının kapanışındaki tam bloğu hedefle (Read ile teyit: `.range(offset, offset + limit - 1);` ... `res.json(data);` ... `});`). O `});`'den hemen SONRA şunu ekle:
```js

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
```
> Not: `supabase` modül kapsamında `server.js:321`'de tanımlı (`const supabase = require('./db');`). `adminAuth` middleware mevcut. `.eq('id', id)` — `game_history.id` kolon tipi bigint/uuid ne olursa olsun Supabase string parametreyi güvenle eşler; ayrı integer parse yok. Gerçek tip teyidi gerekirse Supabase tablo şemasına bakılır ama bu kod tipten bağımsız çalışır.

- [ ] **Step 3: Sözdizimi kontrolü**

Run: `cd backend && node --check server.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat(log): admin gecmis listesi hafifletildi + /history/:id/logs endpoint"
```

---

## Task 4: GameEngine.js — olay yakalama + kalıcılaştırma (NORMAL only)

**Files:**
- Modify: `backend/GameEngine.js`

Önce bağlam oku: `backend/GameEngine.js:1-3` (require'lar), `:166-188` (changePhase), `:505-521` (gece sonucu/morningNews), `:556-593` (JUDGMENT voteResult), `:604-702` (checkWinCondition + insert).

- [ ] **Step 1: gameLog require**

Anchor (`:1-2`):
```js
const { ROLES, getColorAlignment, getInvestResults } = require('./roles');
const voteLogic = require('./voteLogic');
```
Şununla değiştir:
```js
const { ROLES, getColorAlignment, getInvestResults } = require('./roles');
const voteLogic = require('./voteLogic');
const { pushEvent } = require('./gameLog');
```

- [ ] **Step 2: changePhase faz olayı**

Anchor (`:175-176`):
```js
    this.io.to(roomCode).emit('phaseChanged', { phase, timeRemaining: timeInSeconds, dayCount: room.dayCount, doused: Object.keys(room.doused || {}), trial: room.trial ? { accusedId: room.trial.accusedId, accusedName: room.trial.accusedName } : null });
    this.io.to(roomCode).emit('skipDayUpdate', { count: 0, total: room.players.filter(p => p.isAlive && p.connected).length });
```
Şununla değiştir:
```js
    this.io.to(roomCode).emit('phaseChanged', { phase, timeRemaining: timeInSeconds, dayCount: room.dayCount, doused: Object.keys(room.doused || {}), trial: room.trial ? { accusedId: room.trial.accusedId, accusedName: room.trial.accusedName } : null });
    const _phaseTR = { DAY: 'Gündüz', NIGHT: 'Gece', MORNING: 'Sabah', DEFENSE: 'Savunma', JUDGMENT: 'Hüküm' }[phase] || phase;
    pushEvent(room, { type: 'phase', text: `${room.dayCount}. Gün — ${_phaseTR}`, day: room.dayCount, phase, ts: Date.now(), meta: { phase } });
    this.io.to(roomCode).emit('skipDayUpdate', { count: 0, total: room.players.filter(p => p.isAlive && p.connected).length });
```

- [ ] **Step 3: Gece ölüm/sakin-gece olayı**

Anchor (`:515-521`):
```js
      if (killedInfos.length > 0) {
         killedInfos.forEach(info => {
            this.io.to(roomCode).emit('morningNews', { killedPlayerName: info.name, killedPlayerAlignment: info.align, personalNote: info.personalNote, cause: info.cause });
         });
      } else {
         this.io.to(roomCode).emit('morningNews', { killedPlayerName: null });
      }
```
Şununla değiştir:
```js
      if (killedInfos.length > 0) {
         killedInfos.forEach(info => {
            this.io.to(roomCode).emit('morningNews', { killedPlayerName: info.name, killedPlayerAlignment: info.align, personalNote: info.personalNote, cause: info.cause });
            pushEvent(room, { type: 'death', text: `${info.name} gece öldürüldü${info.cause === 'arsonist' ? ' (yangın)' : ''}`, day: room.dayCount, phase: 'NIGHT', ts: Date.now(), meta: { name: info.name, cause: info.cause } });
         });
      } else {
         this.io.to(roomCode).emit('morningNews', { killedPlayerName: null });
         pushEvent(room, { type: 'death', text: `${room.dayCount}. gece kimse ölmedi`, day: room.dayCount, phase: 'NIGHT', ts: Date.now(), meta: { name: null } });
      }
```

- [ ] **Step 4: Linç/affet olayı (JUDGMENT)**

Anchor (`:567`):
```js
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: accused.name, lynchedPlayerAlignment: getColorAlignment(accused.role), personalNote: accused.personalNote, voteTally: guiltyW });
```
Şununla değiştir:
```js
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: accused.name, lynchedPlayerAlignment: getColorAlignment(accused.role), personalNote: accused.personalNote, voteTally: guiltyW });
         pushEvent(room, { type: 'lynch', text: `${accused.name} kuyuya atıldı (oy ${guiltyW})`, day: room.dayCount, phase: 'JUDGMENT', ts: Date.now(), meta: { name: accused.name, role: accused.role, hanged: true, tally: guiltyW } });
```
Anchor (`:587`):
```js
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: null });
```
Şununla değiştir:
```js
         this.io.to(roomCode).emit('voteResult', { lynchedPlayerName: null });
         pushEvent(room, { type: 'lynch', text: `Köylüler bağışladı, kimse kuyuya atılmadı`, day: room.dayCount, phase: 'JUDGMENT', ts: Date.now(), meta: { hanged: false } });
```

- [ ] **Step 5: Oyun-sonu olayı + deaths + DEV_MODE skip'li insert**

Anchor — mevcut insert bloğu (`:691-699`):
```js
       const supabase = require('./db');
       supabase.from('game_history').insert([{
           room_code: roomCode,
           game_mode: room.isDevMode ? 'DEV_MODE' : 'NORMAL',
           winner: winningTeam,
           players: results
       }]).then(({ error }) => {
           if (error) console.error("Supabase'e oyun kaydedilirken hata oluştu:", error);
       });
```
Şununla değiştir:
```js
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
```
> Beraberlik erken-çıkış yolu (`:611` `connectedAlive.length === 0`) zaten insert etmiyor — değiştirilmiyor; o yolda pushEvent/insert yok (spec gereği o oyunlar kaydedilmez).

- [ ] **Step 6: Sözdizimi/yük kontrolü**

Run: `cd backend && node --check GameEngine.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`.
Run: `cd backend && node -e "require('./GameEngine'); require('./gameLog'); console.log('LOAD_OK')"`
Expected: `LOAD_OK`.

- [ ] **Step 7: Commit**

```bash
git add backend/GameEngine.js
git commit -m "feat(log): GameEngine olay yakalama + deaths + NORMAL-only persist"
```

---

## Task 5: Admin.jsx — Kuyu Dibi + lazy Sohbet/Olay paneli

**Files:**
- Modify: `frontend/src/components/Admin.jsx`

Önce bağlam oku: `frontend/src/components/Admin.jsx:10-36` (component state), `:144-153` (`adminFetch`), `:648-690` (geçmiş satır açılımı — `{expandedHistoryId === h.id && (...)}` bloğu, "Maç Sonucu" gridi). `BACKEND_URL` ve `token` kapsamda. Satır no yaklaşık — anchor'ları gerçek metne göre eşle.

- [ ] **Step 1: Log cache state'i ekle**

Anchor (`:18`):
```js
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
```
Şununla değiştir:
```js
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [logsById, setLogsById] = useState({}); // { [id]: { loading, chat_log, event_log, tab, ch } }
```

- [ ] **Step 2: Lazy log fetch + satır açma helper'ı**

Anchor (`fetchAll` fonksiyonunun kapanışından hemen sonra; `adminFetch` tanımı `:144`'ten önce uygun bir yer — Read ile `const adminFetch = async` satırını bul). `const adminFetch = async (path, options = {}) => {` satırından HEMEN ÖNCE şu fonksiyonu ekle:
```js
    const openHistory = (h) => {
        const next = expandedHistoryId === h.id ? null : h.id;
        setExpandedHistoryId(next);
        if (next && !logsById[h.id]) {
            setLogsById(prev => ({ ...prev, [h.id]: { loading: true, chat_log: [], event_log: [], tab: 'chat', ch: 'all' } }));
            fetch(`${BACKEND_URL}/api/admin/history/${h.id}/logs`, { headers: { 'Authorization': token } })
                .then(r => r.ok ? r.json() : { chat_log: [], event_log: [] })
                .then(d => setLogsById(prev => ({ ...prev, [h.id]: { loading: false, chat_log: d.chat_log || [], event_log: d.event_log || [], tab: 'chat', ch: 'all' } })))
                .catch(() => setLogsById(prev => ({ ...prev, [h.id]: { loading: false, chat_log: [], event_log: [], tab: 'chat', ch: 'all' } })));
        }
    };
    const setLogView = (id, patch) => setLogsById(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
```

- [ ] **Step 3: Geçmiş satırının onClick'ini openHistory'e bağla**

Anchor (geçmiş tablosu satırı, `:652`):
```js
                                                <tr onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)} className="hover:bg-slate-900/40 transition-colors cursor-pointer">
```
Şununla değiştir:
```js
                                                <tr onClick={() => openHistory(h)} className="hover:bg-slate-900/40 transition-colors cursor-pointer">
```

- [ ] **Step 4: Açılım içeriğini Kuyu Dibi + lazy panel ile genişlet**

Anchor — açılım bloğunun "Maç Sonucu" kısmının kapanışı. Read ile şu yapıyı bul (`:662-686` civarı):
```js
                                                {expandedHistoryId === h.id && (
                                                    <tr className="bg-black/30">
                                                        <td colSpan="5" className="p-4 border-l-2 border-accent">
                                                            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2"><Users size={12} /> Maç Sonucu</h4>
                                                            {(!h.players || h.players.length === 0) ? (
                                                                <span className="italic text-slate-500 text-sm">Oyuncu verisi yok.</span>
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {h.players.filter(p => !p.isBot).map((p, i) => {
                                                                        const tc = teamColors(teamOf(p.role));
                                                                        return (
                                                                            <div key={i} className={`p-2.5 rounded-lg border text-xs transition-colors ${tc.bg} ${tc.border} ${tc.hover} ${p.won ? '' : 'opacity-70'}`}>
                                                                                <div className="font-bold text-white flex justify-between items-center gap-2">
                                                                                    <span className={p.won ? '' : 'line-through'}>{p.name}</span>
                                                                                    {p.won && <span className={`shrink-0 text-[9px] uppercase tracking-widest font-black ${tc.text}`}>Kazandı</span>}
                                                                                </div>
                                                                                <div className={`text-[10px] mt-0.5 ${tc.text} opacity-80`}>{p.role || 'Bilinmiyor'}</div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
```
Bu bloktaki kapanan `</td>` (yani `</div>\n                                                            )}\n                                                        </td>`) kısmının `</td>`'sinden HEMEN ÖNCE, "Maç Sonucu" gridinin kapanışından sonra şu JSX'i ekle (mevcut grid + Maç Sonucu başlığı aynen kalsın; sadece `</td>`'den önce ek içerik):
```jsx
                                                            {/* ── KUYU DİBİ ── */}
                                                            <h4 className="text-xs font-bold text-slate-400 mt-5 mb-3 uppercase tracking-widest flex items-center gap-2"><Skull size={12} /> Kuyu Dibi</h4>
                                                            {(!h.deaths || h.deaths.length === 0) ? (
                                                                <span className="italic text-slate-500 text-sm">Ölüm kaydı yok.</span>
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {h.deaths.map((d, i) => (
                                                                        <div key={i} className="p-2.5 rounded-lg border bg-red-950/20 border-red-900/40 text-xs">
                                                                            <div className="font-bold text-slate-300 flex items-center gap-1.5"><Skull size={11} className="text-red-400 shrink-0" />{d.name}{d.isBot && <span className="text-[9px] text-slate-600">bot</span>}</div>
                                                                            <div className="text-[10px] text-slate-500 mt-0.5">{d.role || 'Bilinmiyor'} · {d.day != null ? `${d.day}. gün` : '—'}{d.phase ? ` / ${d.phase}` : ''}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* ── SOHBET / OLAYLAR (lazy) ── */}
                                                            {(() => {
                                                                const lv = logsById[h.id];
                                                                if (!lv) return null;
                                                                if (lv.loading) return <p className="text-slate-500 italic text-sm mt-5">Kayıtlar yükleniyor…</p>;
                                                                const tab = lv.tab || 'chat';
                                                                const ch = lv.ch || 'all';
                                                                const chatRows = (lv.chat_log || []).filter(c => ch === 'all' ? true : c.ch === ch);
                                                                const chColor = (c) => c === 'mafia' ? 'text-red-300' : c === 'dead' ? 'text-purple-300' : 'text-slate-300';
                                                                return (
                                                                    <div className="mt-5">
                                                                        <div className="flex gap-1 mb-3">
                                                                            {[['chat', 'Sohbet'], ['events', 'Olaylar']].map(([k, lbl]) => (
                                                                                <button key={k} onClick={() => setLogView(h.id, { tab: k })} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${tab === k ? 'bg-blood-red text-white' : 'bg-slate-900/60 text-slate-400 hover:text-white'}`}>{lbl}</button>
                                                                            ))}
                                                                        </div>
                                                                        {tab === 'chat' ? (
                                                                            <>
                                                                                <div className="flex flex-wrap gap-1 mb-2">
                                                                                    {[['all', 'Hepsi'], ['day', 'Gündüz'], ['dead', 'Ölüler'], ['mafia', 'Çete']].map(([k, lbl]) => (
                                                                                        <button key={k} onClick={() => setLogView(h.id, { ch: k })} className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full border transition-colors ${ch === k ? 'border-accent text-accent' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>{lbl}</button>
                                                                                    ))}
                                                                                </div>
                                                                                {chatRows.length === 0 ? (
                                                                                    <p className="text-slate-600 italic text-xs">Mesaj yok.</p>
                                                                                ) : (
                                                                                    <div className="max-h-80 overflow-y-auto bg-black/30 rounded-lg border border-slate-800 p-2 space-y-0.5 font-mono text-[11px] leading-relaxed">
                                                                                        {chatRows.map((c, i) => (
                                                                                            <div key={i} className="flex gap-2">
                                                                                                <span className="text-slate-600 shrink-0">{c.day}.{c.phase === 'NIGHT' ? 'Gece' : 'Gün'}</span>
                                                                                                <span className={`shrink-0 font-bold ${chColor(c.ch)}`}>{c.sender}:</span>
                                                                                                <span className="text-slate-300 break-words">{c.msg}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            (lv.event_log || []).length === 0 ? (
                                                                                <p className="text-slate-600 italic text-xs">Olay yok.</p>
                                                                            ) : (
                                                                                <div className="max-h-80 overflow-y-auto bg-black/30 rounded-lg border border-slate-800 p-2 space-y-1 text-[11px]">
                                                                                    {(lv.event_log || []).map((e, i) => (
                                                                                        <div key={i} className="flex gap-2 items-baseline">
                                                                                            <span className="text-slate-600 shrink-0 text-[9px] uppercase tracking-widest">{e.day != null ? `${e.day}.` : ''}{e.phase || ''}</span>
                                                                                            <span className="text-slate-300">{e.text}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
```
> `Skull` ikonu `Admin.jsx:2-6` import'unda zaten var (Aktif Odalar'da kullanılıyor). `teamColors`/`teamOf`/`Users` mevcut. Yeni import gerekmez. Eğer "Maç Sonucu" bloğunun kapanış yapısı birebir farklıysa: değiştirme — yalnızca mevcut `</div>` (grid kapanışı) ile dıştaki `</td>` arasına yukarıdaki ek JSX'i yerleştir; mevcut Maç Sonucu içeriğine dokunma. Anchor net bulunamazsa BLOCKED bildir (tahmin etme).

- [ ] **Step 5: Lint**

Run: `cd frontend && npx eslint src/components/Admin.jsx`
Expected: Senin eklediğin satırlarda YENİ hata yok (varsa pre-existing'leri not et; diff'teki satırlara düşen hatayı düzelt).

- [ ] **Step 6: Derleme doğrulaması**

Run: `cd frontend && npm run build`
Expected: `✓ built` (hata yok).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Admin.jsx
git commit -m "feat(log): admin gecmis - kuyu dibi + lazy sohbet/olay paneli"
```

---

## Task 6: Migration uygulama + final doğrulama

**Files:** (kod yok — DB migration + bütünsel doğrulama)

- [ ] **Step 1: Supabase migration'ı uygula**

Supabase Dashboard → proje `olmissmcnqzzfvygeqtg` → SQL Editor'de çalıştır:
```sql
alter table game_history
  add column if not exists chat_log  jsonb not null default '[]'::jsonb,
  add column if not exists event_log jsonb not null default '[]'::jsonb,
  add column if not exists deaths    jsonb not null default '[]'::jsonb;
```
Doğrula: `select column_name from information_schema.columns where table_name='game_history';` → `chat_log,event_log,deaths` listede. (Bu adım kullanıcı tarafından yapılır; subagent yapamıyorsa kullanıcıdan iste, kod commit'lerini bloklama ama deploy'dan önce zorunlu olduğunu raporla.)

- [ ] **Step 2: Otomatik doğrulama**

```bash
cd backend && node --test gameLog.test.js          # # fail 0
cd backend && node --check server.js GameEngine.js  # syntax OK
cd backend && node -e "require('./server')" >/dev/null 2>&1 &  # sadece parse — arka planı hemen kapat
cd frontend && npm run build                        # ✓ built
```
(server.js dinleyici başlatır; yalnız `node --check server.js` yeterli — yukarıdaki `require('./server')` yerine `node --check` kullan.)

- [ ] **Step 3: Manuel checklist (migration uygulandıktan sonra)**

- [ ] Normal oyun oyna → bitince admin "Oyun Geçmişi"nde satır gelir; aç → Maç Sonucu + **Kuyu Dibi** + **Sohbet** (Hepsi/Gündüz/Ölüler/Çete çipleri) + **Olaylar** (faz/ölüm/linç/muhtar/son) görünür.
- [ ] DEV_MODE oyun oyna → admin geçmişinde **görünmez** (insert atlandı).
- [ ] Gündüz/ölüler/çete kanallarına mesaj at → doğru çipte ve doğru `gün.faz` ile görünür.
- [ ] Gece ölümü / sakin gece / linç / affet / muhtar açılışı → Olaylar sekmesinde sıralı.
- [ ] Migration ÖNCESİ eski bir satır aç → panel boş listelerle çökmeden açılır.
- [ ] Liste isteği (`/api/admin/history`) yanıtı `chat_log`/`event_log` içermez; satır açılınca `/history/:id/logs` bir kez çağrılır, tekrar açışta cache'ten gelir (Network sekmesi).

- [ ] **Step 4: Final commit (yalnız bu plandaki işaretlemeler)**

```bash
git add docs/superpowers/plans/2026-05-15-game-history-admin.md
git commit -m "docs: oyun gecmisi plani - manuel test isaretlendi"
```

---

## Self-Review

**Spec coverage:** §4 veri modeli → Task 6 migration + Task 4 insert; §5 gameLog → Task 1 (TDD); §6 oda durumu → Task 2 (init/reset); §7 yakalama noktaları → Task 2 (chat×3, mayor) + Task 4 (phase, death, lynch, end); §8 NORMAL-only persist + deaths → Task 4 Step 5; §9 admin API → Task 3; §10 admin UI (kuyu dibi + lazy sohbet/olay sekme/çip) → Task 5; §11 kenar durumlar → Task 4 (eski satır null→[] UI'da `?? []`/`|| []`; cap Task 1; slice(0,1000) Task 2; DEV skip Task 4; Beraberlik yolu dokunulmadı), Task 5 (`h.deaths` yok→"Ölüm kaydı yok", `logsById` yoksa null); §12 dosyalar → Task 1-5; §13 test planı → Task 1 + Task 6.

**Placeholder scan:** "TBD/TODO/handle edge cases" yok. Her kod adımı tam içerik veriyor. Task 5 büyük JSX'inde anchor netliği için "Read ile teyit/BLOCKED bildir" talimatı var — bu placeholder değil, büyük dosyada güvenli düzenleme talimatı; eklenecek JSX tam verili.

**Type/isim tutarlılığı:** `pushChat(room, {ch,sender,msg,day,phase,ts})` ve `pushEvent(room,{type,text,day,phase,ts,meta})` Task 1 tanımı ↔ Task 2/4 çağrıları birebir. `room.chatLog`/`room.eventLog` Task 1/2/4 tutarlı. Endpoint `/api/admin/history/:id/logs` döner `{chat_log,event_log}` (Task 3) ↔ Task 5 `d.chat_log/d.event_log` okuması tutarlı. `deaths` öğesi `{name,role,day,phase,isBot}` Task 4 üretimi ↔ Task 5 `d.name/d.role/d.day/d.phase/d.isBot` tüketimi tutarlı. Liste select'i `deaths` içerir (Task 3) → Task 5 `h.deaths` erişimi geçerli. Olay `text` Türkçe özetleri Task 4'te üretilir ↔ Task 5 doğrudan `e.text` basar. Tutarlı.
