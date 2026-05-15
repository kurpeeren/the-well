# Kuyu — Oyun Sohbet/Olay/Ölüm Geçmişi + Admin Görüntüleme Tasarımı

- **Tarih:** 2026-05-15
- **Durum:** Onaylandı (uygulama planı bekliyor)
- **Kapsam:** Oyun sonu kalıcı kaydını tüm sohbet + olay zaman çizelgesi + ölüm ("kuyu dibi") listesiyle genişletmek ve bunları admin panelinde oyun bazında görüntülemek.

---

## 1. Problem

Bir oyun bitince `game_history` tablosuna yalnız sonuç yazılıyor (`GameEngine.js` `checkWinCondition` içindeki insert): `{ room_code, game_mode, winner, players }`. Sohbet mesajları sunucuda **hiç saklanmıyor** — yalnız `io.emit` ile yayınlanıp frontend state'inde tutuluyor. Olaylar (gece ölümleri, linç/affet, muhtar açılışı, faz geçişleri) ve ölüm dökümü kalıcı değil. Admin geçmiş bir oyunun ne konuşulduğunu / ne olduğunu inceleyemiyor.

## 2. Hedefler

1. Her NORMAL oyunun **tüm sohbeti** kaydedilsin: gündüz, ölüler boyutu, çete (eşkıya) gizli kanalı — kanal etiketiyle.
2. **Olaylar** kaydedilsin: faz geçişleri (gün/gece/savunma/hüküm), gece ölümleri, linç/affet sonucu, muhtar açılışı, oyun sonu.
3. **Kuyu Dibi** ölüm listesi kaydedilsin: kim, hangi gün, hangi fazda, hangi rolle öldü.
4. Admin panelinde "Oyun Geçmişi"nde bir oyuna tıklayınca bunlar görünsün.

### Hedef olmayanlar (non-goals)
- Oyun mantığı/akışı değişmiyor; yalnız gözlem/loglama eklenir.
- Canlı (oyun sürerken) admin izleme yok — yalnız oyun sonu kalıcı kayıt.
- Erken biten "Beraberlik" yolu (herkes ayrılınca, `GameEngine.js` ~611) zaten `game_history`'ye yazmıyor; bu davranış **değişmiyor** (o oyunların sohbeti/olayı da kaydedilmez).

## 3. Onaylanan Kararlar

| Konu | Karar |
|---|---|
| Sohbet kapsamı | Tüm kanallar: `day` (gündüz), `dead` (ölüler), `mafia` (çete). Özel rol bildirimleri (`privateNews`) **dahil değil**. |
| Olay kapsamı | Faz geçişleri + gece ölümleri + linç/affet + muhtar açılışı + oyun sonu. Özel rol bildirimleri dahil değil. |
| Depolama | `game_history` tablosuna 3 `jsonb` sütun (`chat_log`, `event_log`, `deaths`). Mevcut `players` deseniyle aynı. |
| Hacim sınırı | Oyun başına son **2000** sohbet mesajı (aşılırsa en eskiler atılır). Olay/ölüm listesi sınırsız (küçük). |
| Yakalama | Mevcut emit noktalarında açık loglama; izole `backend/gameLog.js` modülü (Yaklaşım A). |
| **DEV_MODE** | DEV_MODE oyunları **hiç kaydedilmez** — yalnız NORMAL oyunlar `game_history`'ye yazılır. (Mevcut davranış dev oyunları da yazıyordu; değişiyor.) |
| Admin liste performansı | Liste endpoint'i ağır sütunları (`chat_log`,`event_log`) **dışlar**; tek oyunun logları satır açılınca **lazy** çekilir. |
| Olay biçimi | Her olay `{ type, text, day, phase, ts, meta }` — `text` Türkçe insan-okur özet (UI doğrudan basar), `meta` yapısal alanlar. |
| Erişim | Yalnız admin (mevcut `ADMIN_PASSWORD` / `adminAuth`). Ek gizlilik katmanı yok. |

## 4. Veri Modeli

Supabase migration (geriye uyumlu; eski satırlar `[]` alır):

```sql
alter table game_history
  add column if not exists chat_log  jsonb not null default '[]'::jsonb,
  add column if not exists event_log jsonb not null default '[]'::jsonb,
  add column if not exists deaths    jsonb not null default '[]'::jsonb;
```

Şekiller:

- **`chat_log`**: `[{ ch, sender, msg, day, phase, ts }]`
  - `ch`: `'day' | 'dead' | 'mafia'`
  - `sender`: yayındaki gönderen etiketi (ör. `Ahmet`, `[Ölü] Ahmet`, `[Gassal] Ahmet`, `[Çete] Ahmet`)
  - `msg`: metin, defansif `String(message).slice(0, 1000)`
  - `day`: `room.dayCount`, `phase`: `room.status`, `ts`: epoch ms
  - En fazla 2000 kayıt (aşımda baştan kırpılır)
- **`event_log`**: `[{ type, text, day, phase, ts, meta }]`
  - `type`: `'phase' | 'death' | 'lynch' | 'mayor' | 'end'`
  - `text`: Türkçe özet (ör. `"2. Gün — Gündüz"`, `"Ahmet gece öldürüldü"`, `"Mehmet kuyuya atıldı (oy 5)"`, `"Veli Muhtar olduğunu açıkladı"`, `"Oyun bitti — Kazanan: Eşkıyalar"`)
  - `meta`: yapısal (ör. `{ name, role, cause }` / `{ name, hanged, tally }` / `{ winner }`)
- **`deaths`** ("kuyu dibi"): oyun sonu `room.players`'tan türetilir: `[{ name, role, day, phase, isBot }]`, `day` artan sıralı (null'lar sona).

## 5. Yakalama Modülü — `backend/gameLog.js` (yeni)

`voteLogic.js` gibi küçük, izole, test edilebilir modül:

```js
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

Birim test (`backend/gameLog.test.js`, `node --test`): cap altında ekleme; cap aşımında en eskiler atılır ve uzunluk == CHAT_CAP; `pushEvent` sınırsız; null `room` güvenli.

## 6. Oda Durumu

`room.chatLog = []`, `room.eventLog = []`:
- İki oda-oluşturma nesnesinde init (normal + dev — dev odası kaydedilmese de bellek-içi log tutmak zararsız ve kodu basitleştirir; yalnız persist aşamasında dev atlanır).
- `returnToLobby` reset bloğunda sıfırlanır.
- `startGame`'de defansif sıfırlama (aynı odada tekrar oynama temiz başlar).

## 7. Yakalama Noktaları (mevcut emit'lerin yanına ekleme)

| Olay | Dosya | Eklenen |
|---|---|---|
| `chatMessage` (gündüz; DEFENSE/JUDGMENT dahil) | `server.js` | `pushChat(room,{ch:'day',sender:player.name,msg,day,phase,ts})` |
| `deadChatMessage` | `server.js` | `pushChat(room,{ch:'dead',sender:senderLabel,...})` |
| `mafiaChatMessage` | `server.js` | `pushChat(room,{ch:'mafia',sender:'[Çete] '+name,...})` |
| `mayorReveal` (başarılı açılış) | `server.js` | `pushEvent type:'mayor'` |
| `changePhase` | `GameEngine.js` | `pushEvent type:'phase'` (`<dayCount>. Gün — <FazTR>`) |
| gece ölümü (`morningNews` kurbanları) | `GameEngine.js` | kurban başına `pushEvent type:'death'` |
| `voteResult` (asıldı/affedildi) | `GameEngine.js` | `pushEvent type:'lynch'` |
| oyun sonu (kazanan belirlendi) | `GameEngine.js` | `pushEvent type:'end'` (insert'ten hemen önce) |

`gameLog` hem `server.js` hem `GameEngine.js` tarafından `require` edilir; `room` nesnesi paylaşılır.

## 8. Kalıcılaştırma (oyun sonu)

`GameEngine.checkWinCondition` içindeki mevcut insert genişler:

```js
if (!room.isDevMode) {                       // DEV_MODE kaydedilmez
  const deaths = room.players
    .filter(p => !p.isAlive)
    .map(p => ({ name: p.name, role: p.role,
                 day: p.diedDay ?? null, phase: p.diedPhase ?? null,
                 isBot: p.socketId.startsWith('dev_') }))
    .sort((a,b) => (a.day ?? 99) - (b.day ?? 99));
  supabase.from('game_history').insert([{
    room_code: roomCode,
    game_mode: 'NORMAL',
    winner: winningTeam,
    players: results,
    chat_log: room.chatLog || [],
    event_log: room.eventLog || [],
    deaths
  }]).then(({ error }) => { if (error) console.error(...); });
}
```

`game_mode` artık daima `'NORMAL'` (dev hiç yazılmadığı için koşul/etiket sadeleşir).

## 9. Admin API

Admin paneli `/api/admin/history`'yi **3 sn'de bir** poll ediyor → ağır sütunlar listede dönmemeli.

- **Değişiklik:** `/api/admin/history` `select('*')` → `select('id,created_at,room_code,game_mode,winner,players,deaths')` (deaths küçük, listede kalır; `chat_log`/`event_log` dışlanır). Sıralama/limit/offset aynı.
- **Yeni:** `GET /api/admin/history/:id/logs` (`adminAuth`) → `supabase.from('game_history').select('chat_log,event_log').eq('id', id).single()` → `{ chat_log, event_log }`. Hata/yoksa `{ chat_log:[], event_log:[] }`. `:id` ham kullanılmaz: boş/aşırı uzun değilse geçer, Supabase parametreli `.eq` ile bağlanır (kolon tipi şemada ne ise — bigint/uuid — string olarak güvenle eşleşir; ayrı integer varsayımı yok). Uygulama planında gerçek `id` kolon tipi `game_history`'den teyit edilip doğrulama ona göre netleştirilir.

## 10. Admin UI (`frontend/src/components/Admin.jsx`)

"Oyun Geçmişi" satır açılımındaki mevcut "Maç Sonucu" gridine ek olarak:

- **Kuyu Dibi**: `h.deaths` (listede zaten var) — her ölü: isim · rol · `<day>. gün / <phase>`. Boşsa "Ölüm yok".
- **Lazy log paneli**: satır ilk açıldığında `GET /api/admin/history/:id/logs` çağrılır, `logsById` state'inde id'ye göre cache'lenir; yükleniyor/boş/hata durumları. İki alt-sekme:
  - **Sohbet**: kanal çipleri (Hepsi / Gündüz / Ölüler / Çete) ile filtre; satır: `[<day>.G/Gece] <sender>: <msg>`, kanala göre renk (gündüz nötr, ölüler mor, çete kırmızı). Uzun listede scroll.
  - **Olaylar**: `event_log` kronolojik; her satır `text` + küçük gün/faz etiketi.
- Mevcut koyu tema bileşenleri (`Section`, `Th`, çip/buton stilleri) yeniden kullanılır; yeni harici bağımlılık yok.

## 11. Kenar Durumlar

1. Eski `game_history` satırları yeni sütunlardan yoksun → Supabase `null` döner; UI `?? []` ile boş sayar, çökmе yok.
2. `chat_log` 2000 cap: aşımda baştan kırpılır (en eski atılır).
3. Mesaj uzunluğu `slice(0,1000)` ile defansif kırpılır (chat zaten rate-limitli).
4. DEV_MODE oyun: bellek-içi log tutulur ama oyun sonunda **insert atlanır** → admin geçmişinde dev oyun görünmez.
5. Erken "Beraberlik" (herkes ayrıldı) yolu zaten insert etmiyor → o oyun kaydedilmez (mevcut davranış korunur).
6. `mayorReveal` yalnız başarılı açılışta (mevcut guard sonrası) loglanır.
7. Liste endpoint'i artık `chat_log`/`event_log` döndürmez → 3 sn poll hafif kalır; detay yalnız açılışta bir kez çekilir ve cache'lenir.
8. Admin-only erişim; sohbet kişisel içerik barındırabilir — kabul (panel zaten şifreli, kullanıcı tüm görünürlük istedi).

## 12. Etkilenen Dosyalar

- **Yeni:** `backend/gameLog.js`, `backend/gameLog.test.js`
- **Değişen:** `backend/server.js` (require; oda init ×2; `returnToLobby` + `startGame` reset; 3 sohbet handler'ında `pushChat`; `mayorReveal`'da `pushEvent`; `/api/admin/history` select daraltma; yeni `/api/admin/history/:id/logs`)
- **Değişen:** `backend/GameEngine.js` (require; `changePhase`/gece ölümü/`voteResult`/oyun-sonu `pushEvent`; `deaths` türetme; insert'i genişletme + DEV_MODE atlama)
- **Değişen:** `frontend/src/components/Admin.jsx` (kuyu dibi listesi + lazy sohbet/olay paneli + sekme/çip + `logsById` state + fetch)
- **Migration:** yukarıdaki ALTER TABLE SQL — Supabase'de elle (veya Supabase MCP ile) uygulanır; plana not düşülür.

## 13. Test Planı

**Birim (otomatik):** `node --test backend/gameLog.test.js` — cap altı, cap aşımı (uzunluk==2000, en eski düştü), `pushEvent` sınırsız, null-room güvenli.

**Manuel (dev-mod + normal):**
1. Normal oyun oyna; bitince admin "Oyun Geçmişi"nde satır gelir; aç → Kuyu Dibi + Sohbet (3 kanal, çip filtresi) + Olaylar (faz/ölüm/linç/muhtar/son) görünür.
2. DEV_MODE oyun oyna → admin geçmişinde **görünmez** (insert atlandı).
3. Gündüz/ölüler/çete kanallarına mesaj at → doğru `ch` etiketiyle ve doğru gün/faz ile kaydedilir.
4. Gece ölümü, linç, affet, muhtar açılışı → `event_log`'da doğru `text` ile sırada.
5. Eski (yeni-sütunsuz) bir satır aç → panel boş listelerle çöкmeden açılır.
6. Liste endpoint yanıtı `chat_log`/`event_log` içermez (hafif); `/history/:id/logs` açılışta bir kez çekilir ve tekrar açış cache'ten gelir.
7. 2000+ mesajlık uzun oyun → yalnız son 2000 saklanır.
