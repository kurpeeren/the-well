# Kuyu — Mahkeme Sistemi (Suçlama → Savunma → Hüküm) Tasarımı

- **Tarih:** 2026-05-15
- **Durum:** Onaylandı (uygulama planı bekliyor)
- **Kapsam:** Gündüz linç mekaniğinin "en çok oyu alan otomatik asılır" modelinden, eşik tabanlı canlı suçlama + savunma + hüküm mahkeme modeline geçişi.

---

## 1. Problem

Mevcut akış: `DAY` (tartışma) → ayrı `VOTING` fazı → süre bitince **en çok oyu alan kişi otomatik asılır** (`GameEngine.js` `processPhaseEnd` `VOTING` dalı, `server.js` `votePlayer`).

Sorunlar:
- Çoğunluk sağlanmadan, sadece "en yüksek" oyla asma yanlış (kullanıcı: *"mak oy alan otomatik asılmasın, çoğunluğu sağlamadan asmak gibi"*).
- Asılacak kişiye savunma hakkı yok.
- Günde yalnız bir linç mümkün.
- Oyuncu oyunu geri çekemiyor.

## 2. Hedefler

1. Bir hedefin **ağırlıklı** oyu yaşayan oyuncu sayısının yarısını **aşınca** o kişi savunmaya çıkar.
2. Savunma süresi boyunca gündüz sayacı **duraklar**, ayrı savunma sayacı işler.
3. Savunma sonrası o kişi üzerinde **Suçlu/Affet** hükmü oylanır; "Suçlu" kazanırsa asılır, kazanmazsa gündüz **kaldığı yerden** devam eder.
4. Bir günde birden fazla kişi asılabilir.
5. Süre dolar/eşik aşılmazsa gece olur; baştan oylama yapılmaz.
6. Herkeste "oyu geri al" özelliği.

### Hedef olmayanlar (non-goals)

- Gece aksiyon hattı, kazanma şartları, rol yetenekleri değişmiyor (yalnız linç tetikleyicisi mahkemeye taşınıyor).
- VOTING fazı tamamen kaldırılıyor; geriye dönük uyumluluk gerekmiyor (oda durumu kalıcı değil).

## 3. Onaylanan Kararlar

| Konu | Karar |
|---|---|
| Mimari | Oylama **DAY içinde canlı**; ayrı VOTING fazı kaldırılır. `dayTimer` ana saat, mahkemede duraklar. (Yaklaşım **B**: açık `DEFENSE`/`JUDGMENT` fazları + `dayRemaining` ile gündüz devamı.) |
| Suçlama eşiği | `aliveCount = isAlive` oyuncu sayısı. `threshold = floor(aliveCount/2)`. Hedefin **ağırlıklı** oy toplamı `> threshold` → savunma. Açık Muhtar 3 ağırlık. |
| Hüküm | Sanık oy veremez. Ağırlıklı `guiltyW > spareW` → asılır; eşit/az → affedilir. Pencere süresi = `votingTimer`. |
| Yargılama sonrası | Tüm suçlama oyları sıfırlanır. Affedilen `acquittedToday`'e girer, **o gün tekrar yargılanamaz**; başkaları yargılanabilir. Liste her yeni günde sıfırlanır. |
| Savunmada sohbet | Yalnız **sanık** konuşur; diğer canlılar susturulur. Ölü/izleyici → ölüler sohbeti normal. |
| Kalan gündüz ≤ 0 | Mahkeme sonrası `dayRemaining ≤ 0` ise DAY'e dönülmez, doğrudan NIGHT. |
| skipDayVote | Davranış aynı (oybirliği) ama artık NIGHT'a götürür (VOTING'e değil). |

## 4. Durum Makinesi

```
LOBBY → GAME_STARTING → DAY ⇄ [DEFENSE → JUDGMENT] ─┐
                          │                          │
                          │ (timer 0 / herkes skip)  │ (dayRemaining > 0)
                          ▼                          │
                        NIGHT ← ──────────────────────┘ (dayRemaining ≤ 0)
                          ↓
                       MORNING → DAY → ...
```

### DAY
- Timer: yeni girişte `dayTimer`; mahkemeden dönüşte `dayRemaining`.
- Canlı suçlama oyu açık (`votePlayer` artık DAY'de).
- Her oy işlendiğinde yalnız **o oyun hedefi** için ağırlıklı tally hesaplanır. `> threshold` ve hedef `acquittedToday`'de değil ve aktif mahkeme yoksa:
  1. `room.dayRemaining = room.timeRemaining`; `clearInterval(room.timerInterval)`.
  2. `room.trial = { accusedId, accusedName }`; `room.votes = {}`.
  3. `changePhase('DEFENSE', settings.defenseTimer)`.
- Timer 0 veya oybirliği skip → `processPhaseEnd('DAY')`.

### DEFENSE
- Timer: `settings.defenseTimer` (default 60).
- Oy kabul edilmez. Sohbet: yalnız `room.trial.accusedId`.
- Timer 0 → `processPhaseEnd('DEFENSE')` → `changePhase('JUDGMENT', settings.votingTimer)`.

### JUDGMENT
- Timer: `settings.votingTimer`.
- `judgmentVote { verdict: 'GUILTY'|'SPARE' }`; sanık hariç tüm canlılar. Ağırlık = `isMayorRevealed?3:1`. `withdrawVote` ile çekimser.
- Timer 0 → `processPhaseEnd('JUDGMENT')`:
  - `guiltyW = Σw(GUILTY)`, `spareW = Σw(SPARE)`.
  - `guiltyW > spareW` → **asılır**: `isAlive=false`, `diedDay=dayCount`, `diedPhase='JUDGMENT'`, `peacefulDays=0`; framed → `displayRole='Eşkıya'`; `voteResult` emit; Köy Delisi → `deadJesterVotes = judgmentVotes içinde GUILTY oy verenler`, `won=true`; Kan Davalı hedefi eşleşirse `won=true`. `checkWinCondition` → kazanan varsa END (return).
  - Aksi halde → **affedilir**: `acquittedToday.push(accusedId)`; `voteResult { lynchedPlayerName: null }` emit (ayrı `trialResult` olayı yok — frontend mevcut `voteResult`'ı kullanır).
  - `room.trial = null`, `room.judgmentVotes = {}`.
  - `room.dayRemaining > 0` ise `changePhase('DAY', room.dayRemaining)`; değilse DAY-bitiş yoluna gir (NIGHT).

### DAY → NIGHT
- `processPhaseEnd('DAY')`: `checkWinCondition` (güvenlik), `dayCount++`, `room.votes={}`, `room.acquittedToday=[]`, `room.skipDayVotes=[]`, `changePhase('NIGHT', settings.nightTimer)`.
- `dayCount++` mevcut VOTING→NIGHT dalından (GameEngine.js:576) buraya taşınır. VOTING dalı kaldırılır.

## 5. Eşik Matematiği

```
aliveCount = players.filter(p => p.isAlive).length
threshold  = Math.floor(aliveCount / 2)
nominate(target) ⟺ Σ weight(voter for target) > threshold
weight(voter) = voter.isMayorRevealed ? 3 : 1
```

| aliveCount | threshold | Gerekli ağırlık | Muhtar(3)+? |
|---|---|---|---|
| 8 | 4 | ≥5 | 3 + 2 |
| 7 | 3 | ≥4 | 3 + 1 |
| 6 | 3 | ≥4 | 3 + 1 |
| 5 | 2 | ≥3 | 3 + 0 |
| 4 | 2 | ≥3 | 3 + 0 |

Self-vote: `targetId === actorId` reddedilir.

## 6. Hüküm Matematiği

```
guiltyW = Σ weight(v) for v in judgmentVotes where verdict==='GUILTY'
spareW  = Σ weight(v) for v in judgmentVotes where verdict==='SPARE'
hang ⟺ guiltyW > spareW          // eşitlik dahil değil → affedilir
```
Sanık `judgmentVote` gönderemez (server-side reddedilir). Oy vermeyen sayılmaz.

## 7. Oda Durumu (yeni/değişen alanlar)

| Alan | Tip | Açıklama |
|---|---|---|
| `room.status` | string | `+ 'DEFENSE'`, `+ 'JUDGMENT'`; `'VOTING'` artık kullanılmaz |
| `room.dayRemaining` | int | Mahkeme kesince saklanan kalan gündüz saniyesi |
| `room.trial` | obj\|null | `{ accusedId, accusedName }` (DEFENSE/JUDGMENT boyunca) |
| `room.votes` | obj | DAY canlı suçlama: `{ [voterId]: { targetId, weight } }` |
| `room.judgmentVotes` | obj | `{ [voterId]: { verdict, weight } }` |
| `room.acquittedToday` | string[] | O gün affedilenler (yeni günde sıfırlanır) |

`returnToLobby` / `restartGame` reset bloklarına `dayRemaining`, `trial`, `judgmentVotes`, `acquittedToday` eklenir.

## 8. Ayarlar

| Ayar | Normal default | Dev default | Rol |
|---|---|---|---|
| `dayTimer` | 90 | 45 | Gündüz ana saati (mahkemede duraklar) |
| `votingTimer` | 30 | 25 | Hüküm penceresi |
| `defenseTimer` | **60** | **60** | **YENİ** — savunma süresi |
| `nightTimer`/`morningTimer` | değişmez | | |

- `server.js` iki default settings nesnesine (`~466`, `~535`) `defenseTimer: 60` eklenir.
- `App.jsx:88` default state'e `defenseTimer: 60`.
- `App.jsx:586` timer listesine `defenseTimer` + `labelMap` 'Savunma'.
- `updateSettings` handler generic (`room.settings = settings`), ek değişiklik gerekmez.

## 9. Socket API (yeni/değişen)

| Olay | Yön | Değişiklik |
|---|---|---|
| `votePlayer { roomCode, targetId, impersonateId }` | C→S | Guard `VOTING` → **`DAY`**; self-vote engeli; her oyda eşik kontrolü; `voteCounts` emit |
| `withdrawVote { roomCode, impersonateId }` | C→S | **YENİ** — DAY: `votes` sil; JUDGMENT: `judgmentVotes` sil; ilgili sayım emit |
| `judgmentVote { roomCode, verdict, impersonateId }` | C→S | **YENİ** — yalnız JUDGMENT, sanık hariç; `judgmentCounts` emit |
| `skipDayVote` | C→S | Oybirliğinde `processPhaseEnd('DAY')` (NIGHT'a) |
| `phaseChanged` | S→C | DEFENSE/JUDGMENT'ta payload'a `trial:{accusedName}` eklenir |
| `judgmentCounts { guiltyW, spareW, details }` | S→C | **YENİ** |
| `voteResult` | S→C | JUDGMENT sonucu için yeniden kullanılır (asıldı/affedildi) |
| `chatMessage` (DEFENSE) | C→S guard | Yalnız `room.trial.accusedId` yazabilir |
| `forceNextPhase` (dev) | C→S | DEFENSE/JUDGMENT için de izinli |

## 10. Frontend (GameBoard.jsx / App.jsx)

- Suçlama oy UI'si (oyuncu listesi + `voteCounts`) VOTING render bloklarından **DAY** bloklarına taşınır; sohbetle eş zamanlı.
- **DEFENSE görünümü:** "🪦 *{accusedName}* kuyu başında kendini savunuyor…" banner + savunma sayacı; sohbet input yalnız sanıkta açık, diğerlerinde devre dışı ("Savunma sürüyor — yalnız sanık konuşabilir").
- **JUDGMENT görünümü:** oyuncu listesi yerine **"Suçlu" / "Affet"** butonları + canlı ağırlıklı sayım; sanık: "Yargılanıyorsun, oy veremezsin".
- **"Oyu geri al"** butonu: DAY'de aktif suçlama oyun varsa; JUDGMENT'ta verdict verdiysen.
- Faz ikon/etiket/renk yardımcıları (`GameBoard.jsx ~169-203`) DEFENSE & JUDGMENT için genişletilir.
- `diedPhase === 'VOTING'` ikon koşuluna (`~1089`) `'JUDGMENT'` eklenir.
- `App.jsx` `phaseChanged` handler'ı `trial` bilgisini state'e yazar; mevcut generic forwarding korunur.

## 11. Kenar Durumlar

1. Mahkeme aktifken `votePlayer` yok sayılır (oylar kilitli).
2. Tek oy yalnız tek hedefin tally'sini değiştirir → yalnız o hedef kontrol edilir; eşzamanlı çoklu tetik imkânsız.
3. Sanık DEFENSE/JUDGMENT'ta düşerse JUDGMENT yine işler; sonrasında `checkWinCondition`.
4. `dayRemaining` çok küçükse (>0) yine DAY'e dönülür; ≤0 ise NIGHT.
5. `acquittedToday` her DAY→NIGHT'ta sıfırlanır → farklı kişiler aynı gün yargılanıp asılabilir.
6. Muhtar mührü gündüz açılırsa sonraki tally yeniden hesapla ile ağırlık güncellenir.
7. Köy Delisi JUDGMENT'ta asılırsa intikam listesi `judgmentVotes` GUILTY'lerden; Kan Davalı kazanması JUDGMENT dalına taşınır.
8. Asılma yan etkileri (peacefulDays, framed displayRole, voteResult) JUDGMENT dalına taşınır; VOTING dalı silinir.
9. `forceNextPhase` DEFENSE/JUDGMENT'ı atlar.

## 12. Etkilenen Dosyalar

- `backend/server.js` — default settings ×2; `votePlayer` (DAY guard + self-vote + eşik tetik); `withdrawVote` (yeni); `judgmentVote` (yeni); `skipDayVote` hedefi; DEFENSE sohbet guard'ı; `forceNextPhase` izinleri; reset blokları.
- `backend/GameEngine.js` — `changePhase` emit'ine `trial`; `processPhaseEnd` DAY/DEFENSE/JUDGMENT dalları; VOTING dalı kaldırılır; eşik & hüküm yardımcıları; `dayCount++` taşınır.
- `frontend/src/App.jsx` — `defenseTimer` default + lobi input; `phaseChanged`/trial state.
- `frontend/src/components/GameBoard.jsx` — DAY canlı oy, DEFENSE/JUDGMENT görünümleri, geri-al butonu, faz görselleri, `diedPhase` ikonu.
- `game-engine.md` — FSM dokümanı güncellenir (opsiyonel ama önerilir).

## 13. Test Planı (manuel, dev mod)

1. 7 bot: 4 oy tek hedefe → DEFENSE tetiklenir, gündüz sayacı durur, `dayRemaining` saklanır.
2. Açık Muhtar + 1 oy (7 kişi) → eşik aşılır (3+1=4 > 3).
3. JUDGMENT: guiltyW > spareW → asılır; eşit → affedilir + `acquittedToday`.
4. Affedilen aynı gün yeniden eşik aşsa bile tetiklenmez; başka hedef tetiklenebilir → 2. asılma.
5. Mahkeme sonrası DAY `dayRemaining` ile devam; `dayRemaining ≤ 0` → NIGHT.
6. `withdrawVote`/oy değiştirme DAY'de sayımı düşürür; tetik eşiğin **aşıldığı oy anında** senkron çalıştığı için "bekleyen" tetik yoktur — geri alma yalnız eşik aşılmadan önce etkilidir. JUDGMENT'ta `withdrawVote` çekimsere çevirir.
7. DEFENSE'te yalnız sanık sohbet edebilir.
8. Gündüz süresi eşik aşılmadan biter → NIGHT, kimse asılmaz, `dayCount++`.
9. Köy Delisi JUDGMENT'ta asılır → jester kazanır, intikam GUILTY oyçularından.
10. Dev `forceNextPhase` DEFENSE→JUDGMENT→DAY zincirini atlar.
