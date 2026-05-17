# Admin Aktif Oda Canlı Sohbet/Olay Görüntüleme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelindeki "Aktif Odalar" satırları, devam eden oyunun bellekteki sohbet (gündüz/ölü/çete) ve olay zaman çizelgesini poll tabanlı lazy gösterecek şekilde genişletilsin.

**Architecture:** Yeni hafif `GET /api/admin/rooms/:id/logs` endpoint'i bellekteki `rooms[id].chatLog/eventLog`'u döner (`/api/admin/stats` poll'u değişmez). Admin.jsx, bitmiş-oyun lazy panelinin (logsById + sekme/çip) birebir eşini `roomLogsById` ile aktif odalara uygular; satır açıkken her poll tikinde (~3 sn) yeniden çekilerek canlı kalır.

**Tech Stack:** Node.js (CommonJS) + Express 5 + socket.io (backend). React 19 + Vite (frontend). Yeni paket yok. Endpoint mantığı triviyal (bellek okuması) → repo geleneğine uyarak `node --check` + manuel checklist ile doğrulanır (saf birim test gerektiren mantık yok; `chatTargets`/`gameLog`/`voteLogic` gibi ayrı bir saf modül çıkmıyor).

**Spec:** `docs/superpowers/specs/2026-05-17-admin-active-room-logs-design.md`

## Execution Status (2026-05-17, subagent-driven)

- **Task 1 (backend endpoint):** ✅ DONE — commit `4bae661`. Spec review ✅. Code quality ✅ (reviewer önerdiği "oda yoksa 404" bilinçli reddedildi — spec §5/§7.1 kasıtlı 200-boş: 3sn poll-tazeleme oyun bitince hata vermesin, bitmiş-oyun endpoint'iyle tutarlı).
- **Task 2 (Admin.jsx panel + canlı tazeleme):** ✅ DONE — commit `25f0aac`. Spec review ✅. Code quality ✅ (kalan notlar dosyanın mevcut deseninden miras, regresyon yok).
- **Task 3 Step 1 (otomatik doğrulama):** ✅ `node --check server.js` SERVER_OK · `node --test` 21/21 pass · `npm run build` ✓ built.
- **Task 3 Step 2 (manuel checklist):** ⏳ KULLANICIDA — gerçek oyun gerektirir; aşağıdaki maddeler oyun oynanınca doğrulanmalı (dürüstlük: işaretlenmedi).

## Commit kuralları (TÜM task'lar — STRICT)

- `main` dalında çalış. Yalnız o task'ın dosyalarını `git add <dosya>` ile stage'le — repoda alakasız dirty/untracked dosyalar var, **asla `git add -A`/`.`**.
- Git hook'larını **asla** atlama (`--no-verify`, `core.hooksPath`, `-c` hook override **yok**). Hook hata verirse bildir, çözme.
- Commit mesajına `Co-Authored-By: Claude` (veya herhangi Claude co-author) trailer **ekleme**.
- Her commit'ten **hemen sonra** `git push` (kullanıcı kalıcı kuralı: "push et her zaman"). Düz `git add <dosya>` + `git commit` bir bash çağrısında, ardından ayrı çağrıda `git push`.
- **Subagent git güvenliği:** index/worktree'yi değiştiren git komutu çalıştırma — yalnız `git log/show/diff/status/rev-parse` + kendi `git add <dosya>`/`git commit`/`git push`. `git checkout/restore/reset/stash/clean/revert/rm` YASAK.

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `backend/server.js` | Yeni `GET /api/admin/rooms/:id/logs` (adminAuth) — bellekteki `rooms[id]`'den `{chat_log,event_log}`. `/api/admin/stats` dokunulmaz. | **Modify** |
| `frontend/src/components/Admin.jsx` | `roomLogsById` state + `openRoom` + `setRoomLogView` + açık satır için poll-tazeleme effect + Aktif Oda açılımına lazy Sohbet/Olay paneli | **Modify** |

**Test stratejisi:** Endpoint düz bellek okuması; saf, off-by-one riski taşıyan mantık yok → ayrı birim test modülü çıkarılmaz (repo geleneği: `node --check` + manuel checklist, bkz. 2026-05-15-game-history-admin Task 3). Mevcut testler (`chatTargets`/`gameLog`/`voteLogic`) regresyon görmemeli (`node --test`).

---

## Task 1: Backend — `GET /api/admin/rooms/:id/logs`

**Files:**
- Modify: `backend/server.js` (bitmiş-oyun `/api/admin/history/:id/logs` handler'ının hemen ardı, ~`:374`)

Bağlam: `backend/server.js:361-374` bitmiş-oyun logs endpoint'i; `:376` `const server = http.createServer(app);`. `rooms` modül kapsamında (zaten `/api/admin/stats`, `:181` `Object.keys(rooms)` kullanıyor). `adminAuth` middleware mevcut. Oda nesnesinde `id === roomCode === rooms anahtarı` (`:495`, `:572` `id: roomCode`), bu yüzden `rooms[id]` doğru lookup. `room.chatLog`/`room.eventLog` gameLog özelliğinden bellekte birikiyor.

- [ ] **Step 1: Endpoint'i ekle**

Anchor — bitmiş-oyun handler kapanışı + sonraki satır (`backend/server.js:373-376`):
```js
    res.json({ chat_log: data?.chat_log || [], event_log: data?.event_log || [] });
});

const server = http.createServer(app);
```
Şununla değiştir:
```js
    res.json({ chat_log: data?.chat_log || [], event_log: data?.event_log || [] });
});

app.get('/api/admin/rooms/:id/logs', adminAuth, (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id || id.length > 64) return res.status(400).json({ error: 'Geçersiz id' });
    const room = rooms[id];
    if (!room) return res.json({ chat_log: [], event_log: [] });
    res.json({ chat_log: room.chatLog || [], event_log: room.eventLog || [] });
});

const server = http.createServer(app);
```
> Not: Oda kapandı/oyun bitti ise `rooms[id]` undefined → `{ [], [] }` (404 değil; UI çökmeden boş gösterir, spec §7.1). Bitmiş kayıt ayrıca Supabase `game_history`'de — orası `/api/admin/history/:id/logs` ile gelir, dokunulmadı. `:id` doğrulama bitmiş-oyun endpoint'iyle birebir aynı kalıp.

- [ ] **Step 2: Sözdizimi kontrolü**

Run: `cd backend && node --check server.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`.

- [ ] **Step 3: Regresyon — mevcut testler**

Run: `cd backend && node --test chatTargets.test.js gameLog.test.js voteLogic.test.js 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` (endpoint eklemesi saf modülleri etkilemez).

- [ ] **Step 4: Commit + push**

```bash
git add backend/server.js
git commit -m "feat(admin): aktif oda canli sohbet/olay endpointi (/api/admin/rooms/:id/logs)"
```
Ardından ayrı çağrı:
```bash
git push
```

---

## Task 2: Frontend — Admin.jsx aktif oda lazy panel + canlı tazeleme

**Files:**
- Modify: `frontend/src/components/Admin.jsx`

Bağlam (satır no yaklaşık — anchor'ları gerçek metne göre eşle): `:17` `expandedRoom` state; `:19` `logsById` state; `:30` `lastTick` state; `:145-156` `openHistory`/`setLogView` (mirror'lanacak desen); `:187` `setLastTick(Date.now())` (her başarılı poll'da, ~3 sn); `:570-632` Aktif Odalar `filteredRooms.map` satırı + `expandedRoom === r.id` açılımı; `:712-764` bitmiş-oyun lazy panel IIFE (mirror'lanacak JSX). `BACKEND_URL` ve `token` kapsamda.

- [ ] **Step 1: `roomLogsById` state ekle**

Anchor (`:19`):
```js
    const [logsById, setLogsById] = useState({}); // { [id]: { loading, chat_log, event_log, tab, ch } }
```
Şununla değiştir:
```js
    const [logsById, setLogsById] = useState({}); // { [id]: { loading, chat_log, event_log, tab, ch } }
    const [roomLogsById, setRoomLogsById] = useState({}); // aktif oda canlı logları (id bazlı)
```

- [ ] **Step 2: `openRoom` + `setRoomLogView` helper'ları + fetch helper'ı**

Anchor — `setLogView` tanımının hemen ardı (`:156`):
```js
    const setLogView = (id, patch) => setLogsById(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
```
Şununla değiştir:
```js
    const setLogView = (id, patch) => setLogsById(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    const setRoomLogView = (id, patch) => setRoomLogsById(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const fetchRoomLogs = (roomId, { initial } = {}) => {
        if (initial) {
            setRoomLogsById(prev => ({ ...prev, [roomId]: { loading: true, chat_log: [], event_log: [], tab: 'chat', ch: 'all' } }));
        }
        fetch(`${BACKEND_URL}/api/admin/rooms/${roomId}/logs`, { headers: { 'Authorization': token } })
            .then(r => r.ok ? r.json() : { chat_log: [], event_log: [] })
            .then(d => setRoomLogsById(prev => ({ ...prev, [roomId]: { ...prev[roomId], loading: false, chat_log: d.chat_log || [], event_log: d.event_log || [] } })))
            .catch(() => setRoomLogsById(prev => ({ ...prev, [roomId]: { ...prev[roomId], loading: false, chat_log: prev[roomId]?.chat_log || [], event_log: prev[roomId]?.event_log || [] } })));
    };

    const openRoom = (r) => {
        const next = expandedRoom === r.id ? null : r.id;
        setExpandedRoom(next);
        if (next && !roomLogsById[r.id]) fetchRoomLogs(r.id, { initial: true });
    };
```
> `openHistory` (`:145`) deseninin aktif-oda eşi; fark: kalıcı cache yerine canlı tazeleme (Step 3). Hata dalında eski veriyi korur (yavaş/tek seferlik hata satırı boşaltmasın — `6daffaf` ile aynı mantık).

- [ ] **Step 3: Açık satır için poll-tazeleme effect'i**

Anchor — poll effect'inin kapanışı (`:48-49`):
```js
        return () => { cancelled = true; clearInterval(interval); };
    }, [token]);
```
Bu bloğun HEMEN ARDINA yeni bir effect ekle (yani `}, [token]);` satırından sonra):
```js

    // Aktif oda açıkken canlı tazeleme: her başarılı poll (lastTick ~3 sn) tikinde
    // açık odanın loglarını yeniden çek. Bitmiş oyundan farkı: kalıcı cache yok.
    useEffect(() => {
        if (!token || !expandedRoom) return;
        if (!roomLogsById[expandedRoom]) return; // ilk yükleme openRoom'da
        fetchRoomLogs(expandedRoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expandedRoom, lastTick, token]);
```
> `lastTick` `:187`'de her başarılı stats poll'unda `Date.now()` olur → effect ~3 sn'de bir açık oda için tetiklenir. `roomLogsById[expandedRoom]` yoksa (openRoom henüz initial fetch yapmadıysa) atla — çift istek olmaz. `fetchRoomLogs`/`expandedRoom`/`roomLogsById` deps dışı bırakıldı (kasıtlı; lastTick sürücü).

- [ ] **Step 4: Aktif oda satırının onClick'ini `openRoom`'a bağla**

Anchor (`:572`):
```js
                                            <tr onClick={() => setExpandedRoom(expandedRoom === r.id ? null : r.id)} className="hover:bg-slate-900/40 transition-colors cursor-pointer">
```
Şununla değiştir:
```js
                                            <tr onClick={() => openRoom(r)} className="hover:bg-slate-900/40 transition-colors cursor-pointer">
```

- [ ] **Step 5: Açılıma lazy Sohbet/Olay panelini ekle**

Anchor — Aktif oda açılımındaki "Oyuncular" gridinin kapanışı + dış `</td>` (`:626-629`):
```js
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
```
"Oyuncular" içeriği aynen kalsın; gridin kapanan `)}` (yani `</div>\n                                                        )}`) ile dıştaki `</td>` arasına şu JSX'i ekle:
```jsx
                                                            </div>
                                                        )}

                                                        {/* ── CANLI SOHBET / OLAYLAR (lazy, poll-tazelemeli) ── */}
                                                        {(() => {
                                                            const lv = roomLogsById[r.id];
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
                                                                            <button key={k} onClick={() => setRoomLogView(r.id, { tab: k })} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${tab === k ? 'bg-blood-red text-white' : 'bg-slate-900/60 text-slate-400 hover:text-white'}`}>{lbl}</button>
                                                                        ))}
                                                                    </div>
                                                                    {tab === 'chat' ? (
                                                                        <>
                                                                            <div className="flex flex-wrap gap-1 mb-2">
                                                                                {[['all', 'Hepsi'], ['day', 'Gündüz'], ['dead', 'Ölüler'], ['mafia', 'Çete']].map(([k, lbl]) => (
                                                                                    <button key={k} onClick={() => setRoomLogView(r.id, { ch: k })} className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full border transition-colors ${ch === k ? 'border-accent text-accent' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>{lbl}</button>
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
                                                    </td>
                                                </tr>
```
> Bitmiş-oyun IIFE'sinin (`:712-764`) birebir eşi; tek fark: `logsById[h.id]`→`roomLogsById[r.id]`, `setLogView(h.id,…)`→`setRoomLogView(r.id,…)`. `chColor`/sınıflar aynen. Yeni import gerekmez (`Users` zaten kullanılıyor). Anchor net bulunamazsa BLOCKED bildir (tahmin etme); yalnız grid kapanışı `)}` ile dıştaki `</td>` arasına ekle, "Oyuncular" içeriğine dokunma.

- [ ] **Step 6: Lint**

Run: `cd frontend && npx eslint src/components/Admin.jsx`
Expected: Senin eklediğin satırlarda YENİ hata yok. (Step 3'teki `react-hooks/exhaustive-deps` kasıtlı `eslint-disable-next-line` ile bastırıldı — başka hata olmamalı.)

- [ ] **Step 7: Derleme**

Run: `cd frontend && npm run build`
Expected: `✓ built` (hata yok).

- [ ] **Step 8: Commit + push**

```bash
git add frontend/src/components/Admin.jsx
git commit -m "feat(admin): aktif oda canli sohbet/olay paneli (lazy + poll-tazelemeli)"
```
Ardından ayrı çağrı:
```bash
git push
```

---

## Task 3: Final doğrulama + manuel checklist

**Files:** (kod yok — bütünsel doğrulama + plan işaretleme)

- [ ] **Step 1: Otomatik doğrulama**

```bash
cd backend && node --check server.js && echo SERVER_OK
cd backend && node --test chatTargets.test.js gameLog.test.js voteLogic.test.js 2>&1 | grep -E "^# (tests|pass|fail)"   # fail 0
cd frontend && npm run build   # ✓ built
```
(server.js dinleyici başlatır — `require('./server')` KULLANMA; yalnız `node --check`.)

- [ ] **Step 2: Manuel checklist**

- [ ] Aktif oyun sürerken admin "Aktif Odalar"da odayı aç → o ana kadarki Gündüz/Ölü/Çete sohbeti + Olaylar görünür.
- [ ] Oyunda yeni mesaj/olay → satır açıkken ~3 sn içinde panel tazelenir (yeni mesaj eklenir).
- [ ] Çip filtreleri (Hepsi/Gündüz/Ölüler/Çete) + Olaylar sekmesi çalışır; sekme/çip seçimi poll-tazelemede korunur (state `roomLogsById`'de tutulur).
- [ ] Oda açıkken oyunu bitir → panel boş listeye düşer, çökmez; oyun "Oyun Geçmişi"nde normal görünür.
- [ ] Satırı kapat → o oda için ek istek durur (Network: `/api/admin/rooms/:id/logs` çağrısı durmalı).
- [ ] `/api/admin/stats` yanıtı hâlâ `chat_log`/`event_log` içermez (hafif kalır).
- [ ] Birden çok oda art arda açılıp kapanır → her biri kendi id'siyle bağımsız, karışmaz.

- [ ] **Step 3: Final commit + push (yalnız bu plandaki işaretlemeler)**

```bash
git add docs/superpowers/plans/2026-05-17-admin-active-room-logs.md
git commit -m "docs: admin aktif oda log plani - manuel test isaretlendi"
```
Ardından ayrı çağrı:
```bash
git push
```

---

## Self-Review

**Spec coverage:** §2.1 oda açınca sohbet+olay → Task 2 Step 5 (panel) + Task 1 (veri); §2.2 ~3 sn tazeleme → Task 2 Step 3 (lastTick effect); §2.3 stats hafif kalır → Task 1 (stats'a dokunulmadı, ayrı endpoint) + Task 3 Step 2 checklist; §4 veri kaynağı bellek `room.chatLog/eventLog` → Task 1 Step 1; §5 endpoint (id ≤64, yoksa boş) → Task 1 Step 1; §6 lazy panel + canlı tazeleme + tüm kanallar → Task 2 Step 1-5; §7 kenar durumlar: (1) oda kapanır→boş Task1 Step1 + Task2 hata dalı eski koru, (2) cap gameLog'da hazır (dokunulmaz), (3) kapalıyken fetch yok Task2 Step3 guard, (4) çoklu oda bağımsız id Task2 Step1/2, (5) stats değişmez Task1, (6) admin-only `adminAuth` Task1 Step1; §8 dosyalar → server.js (Task1) + Admin.jsx (Task2), yeni dosya/migration yok; §9 test planı → Task1 Step2-3 + Task3.

**Placeholder scan:** "TBD/TODO/handle edge cases" yok. Her kod adımı tam içerik. Task 2 Step 5'te büyük JSX tam verili; "BLOCKED bildir" talimatı büyük dosyada güvenli düzenleme içindir, placeholder değil.

**Type/isim tutarlılığı:** Endpoint `/api/admin/rooms/:id/logs` döner `{chat_log,event_log}` (Task1) ↔ `fetchRoomLogs` `d.chat_log/d.event_log` okur (Task2 Step2) ↔ panel `lv.chat_log/lv.event_log` (Task2 Step5) tutarlı. State `roomLogsById` + setter `setRoomLogsById` + view-setter `setRoomLogView(r.id,…)` + okuma `roomLogsById[r.id]` tüm Task2 adımlarında birebir. `openRoom(r)` `r.id` kullanır, satır onClick `openRoom(r)` (Step4) ile çağrılır; `r.id === roomCode` (spec §4, server.js:495/572) → endpoint `rooms[id]` lookup'ıyla tutarlı. `lastTick` (`:187` set) ↔ Task2 Step3 effect dep tutarlı. Bitmiş-oyun deseni (`logsById`/`setLogView`/IIFE) ↔ aktif-oda eşi (`roomLogsById`/`setRoomLogView`/IIFE) yapı birebir, çakışan isim yok (ayrı state).
