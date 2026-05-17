# Kuyu — Admin Panelinde Aktif Oda Canlı Sohbet/Olay Görüntüleme Tasarımı

- **Tarih:** 2026-05-17
- **Durum:** Onaylandı (uygulama planı bekliyor)
- **Kapsam:** Admin panelindeki "Aktif Odalar" satırlarını, devam eden oyunların o ana kadarki sohbet (gündüz/ölü/çete) ve olay zaman çizelgesini poll tabanlı, lazy biçimde gösterecek şekilde genişletmek.

---

## 1. Problem

Admin paneli `GET /api/admin/stats` (3 sn poll) ile aktif odaların durumunu (status, faz, oyuncular) gösteriyor ama **sohbet/olay içermiyor**. Oyun bitince geçmiş `game_history` üzerinden görüntülenebiliyor (2026-05-15-game-history-admin); fakat oyun **sürerken** admin ne konuşulduğunu/ne olduğunu izleyemiyor. `room.chatLog`/`room.eventLog` zaten bellekte canlı birikiyor (gameLog özelliği) — sadece dışarı verilmiyor.

## 2. Hedefler

1. Admin "Aktif Odalar"da bir odaya tıklayınca o ana kadarki **sohbet** (gündüz/ölü/çete kanalları) ve **olaylar** görünsün.
2. Satır açık kaldıkça veri ~3 sn'de bir tazelensin (canlı izlenim).
3. Mevcut 3 sn `/api/admin/stats` poll'u **hafif** kalsın (regresyon yok).

### Hedef olmayanlar
- Gerçek zamanlı socket akışı yok — poll tabanlı (~3 sn gecikme kabul).
- Oyun mantığı/akışı değişmiyor; yalnız gözlem.
- Kalıcılaştırma değişmiyor — bitmiş-oyun kaydı ayrı özellik (2026-05-15-game-history-admin) ve aynen kalır.

## 3. Onaylanan Kararlar

| Konu | Karar |
|---|---|
| Yaklaşım | Poll tabanlı (gerçek zamanlı socket değil). |
| Endpoint | Ayrı **lazy** endpoint; `/api/admin/stats` poll'una log eklenmez (2000'lik chatLog poll'u şişirir — bitmiş-oyun tasarımıyla aynı gerekçe). |
| Kanal kapsamı | Gündüz + Ölü + Çete + Olaylar hepsi açık — bitmiş-oyun görünümüyle tutarlı. |
| Tazeleme | Satır açıkken her stats poll tikinde yeniden çekilir (bitmiş oyun kalıcı cache'liydi; aktif oda canlı → cache'lenmez, tazelenir). |
| Gizlilik/hile | Oyun sürerken admin çete sohbetini de görür. Panel zaten `ADMIN_PASSWORD`/`adminAuth` arkasında; bitmiş-oyundaki tam-görünürlük kabulüyle aynı. Ek gizlilik katmanı yok. |
| Erişim | Yalnız admin (`adminAuth`). |

## 4. Veri Kaynağı

Kalıcı depolama **yok** — veri tamamen bellekteki `rooms[id]` nesnesinden:

- `room.chatLog`: `[{ ch, sender, msg, day, phase, ts }]` (gameLog, 2000 cap) — şekil bitmiş-oyun `chat_log` ile aynı.
- `room.eventLog`: `[{ type, text, day, phase, ts, meta }]` — şekil bitmiş-oyun `event_log` ile aynı.

Şekiller bitmiş-oyunla birebir aynı olduğu için frontend panel mantığı yeniden kullanılır.

## 5. Admin API

- **Yeni:** `GET /api/admin/rooms/:id/logs` (`adminAuth`).
  - `:id` doğrulama: boş değil, `<= 64` karakter (bitmiş-oyun endpoint'iyle aynı kalıp).
  - `const room = rooms[id]` — yoksa (oyun bitti/oda kapandı) `{ chat_log: [], event_log: [] }` döner (404 değil; UI çökmeden boş gösterir).
  - Varsa `{ chat_log: room.chatLog || [], event_log: room.eventLog || [] }`.
- **Değişmeyen:** `GET /api/admin/stats` — alanları/poll'u aynı; log eklenmez.

## 6. Admin UI (`frontend/src/components/Admin.jsx`)

"Aktif Odalar" bölümü, "Oyun Geçmişi"ndeki lazy panel desenini yeniden kullanır:

- Satıra tıklanınca açılır/kapanır (`expandedRoomId` benzeri state).
- Açılınca `GET /api/admin/rooms/:id/logs` çağrılır; `roomLogsById` state'inde cache'lenir.
- **Canlı tazeleme:** Bitmiş oyunlardan farklı olarak, satır açık kaldıkça mevcut stats poll tikinde (her ~3 sn) ilgili oda için log yeniden çekilir ve cache güncellenir (kalıcı cache yok).
- Panel: aynı **Sohbet** (Hepsi/Gündüz/Ölüler/Çete çipleri) + **Olaylar** sekme/çip bileşen mantığı; yükleniyor/boş durumları. Yeni harici bağımlılık yok.
- Oda satırı kapanınca o oda için tazeleme durur.

## 7. Kenar Durumlar

1. Oda açıkken oyun biter / oda kapanır → sonraki fetch `rooms[id]` bulamaz → `{ [], [] }` → panel boş, çökme yok. (Bitmiş kayıt ayrıca `game_history`'de — orası değişmez.)
2. `chatLog` 2000 cap: gameLog modülü zaten kırpıyor; endpoint olduğu gibi döner.
3. Satır kapalıyken fetch/tazeleme yapılmaz (gereksiz yük yok).
4. Birden çok oda aynı anda açık → her biri kendi id'siyle bağımsız fetch + cache.
5. `/api/admin/stats` poll'u değişmediği için mevcut hafif davranış korunur; log yalnız açık satır(lar) için ek istek.
6. Admin-only; canlı çete içeriği görünür — kabul (§3 gizlilik kararı).

## 8. Etkilenen Dosyalar

- **Değişen:** `backend/server.js` — yeni `GET /api/admin/rooms/:id/logs` endpoint'i (bitmiş-oyun `/api/admin/history/:id/logs` hemen yanına, aynı kalıpla). `/api/admin/stats` dokunulmaz.
- **Değişen:** `frontend/src/components/Admin.jsx` — Aktif Odalar satır açılımı + `roomLogsById` state + lazy fetch + açıkken poll-tazeleme; mevcut sekme/çip panel mantığının yeniden kullanımı.
- **Yeni dosya yok.** Migration yok (bellek-içi veri).

## 9. Test Planı

**Birim (otomatik):** Yeni saf mantık yok (endpoint düz bellek okuması, UI poll). Mevcut testler (`chatTargets`, `gameLog`, `voteLogic`) regresyon görmemeli — `node --test` ile doğrulanır. `node --check server.js` sözdizimi.

**Manuel (dev-mod + normal):**
1. Aktif oyun sürerken admin "Aktif Odalar"da odayı aç → o ana kadarki gündüz/ölü/çete sohbeti + olaylar görünür.
2. Oyunda yeni mesaj/olay → ~3 sn içinde panel tazelenir (satır açıkken).
3. Çip filtreleri (Hepsi/Gündüz/Ölüler/Çete) ve Olaylar sekmesi çalışır.
4. Oda açıkken oyun bitir → panel boş listeye düşer, çökmez; oyun "Oyun Geçmişi"nde normal görünür.
5. Satırı kapat → o oda için ek istek durur (Network sekmesi).
6. `/api/admin/stats` yanıtı hâlâ `chat_log`/`event_log` içermez (hafif).
