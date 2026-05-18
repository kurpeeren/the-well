# Kuyu — Web/Desktop Oyun Ekranı Tasarımı (Tek-Sayfa + Tutarlı Gösterge Sistemi)

- **Tarih:** 2026-05-18
- **Durum:** Onaylandı (uygulama planı bekliyor)
- **Kapsam:** Desktop/web in-game ekranının düzgün tasarlanması: mobil "tek-sayfa, kaymaz" disiplinini desktop'a taşımak, `sm:` küçültmelerini tersine çevirmek, gösterge/sayaç/timer'ları tek tutarlı dile getirmek, kanvası doldurmak. Mobil davranış birebir korunur.

---

## 1. Problem

Oyun ekranı mobil-öncelikli yazılmış; desktop hiç tasarlanmamış (önceki iki spec — `2026-05-07-mobile-one-page-design`, `2026-05-18-web-ui-consistency` — desktop oyun layout'unu açıkça kapsam dışı bıraktı). Koddan kanıtlı somut sorunlar:

- **TimerDisplay** (`TimerDisplay.jsx:23-27`): `w-16 h-16 sm:w-14 sm:h-14 rounded-2xl sm:rounded-full` — desktop'ta hem küçülüyor hem kare→daire şekil değiştiriyor; rakam `text-2xl→sm:text-xl`, "Sn" `text-[9px]→sm:text-[7px]` (okunmaz).
- **Header satırında 3 şekil dili**: faz ikonu kapsayıcı `rounded-full` (`GameBoard.jsx:487`), faz adı pili `rounded-lg` (`:491`), yetenek sayaçları `rounded` (`:501-503`), rol rozeti `rounded-lg sm:rounded` (`:496`).
- **Hüküm sayaçları** (`GameBoard.jsx:668`): konteynırsız çıplak `text-[10px]` metin — oyundaki tek kapsayıcısız gösterge.
- **`max-w-4xl` (896px) tavanı** (`GameBoard.jsx:456`): geniş ekranda iki yanda yüzlerce px ölü `#050505`; sohbet sütunu kanvasın ~%42'si.
- **Desktop'ta sayfa kayıyor**: `App.jsx:306` `sm:overflow-visible` + `index.css:147-157` `body{overflow:auto;height:auto}` @640px+; kart `sm:h-auto sm:min-h-[75vh]` doğal yükseklikte → kartın altı siyaha karşı tırtıklı, mobildeki "tek-sayfa kaymaz" mantığı desktop'ta yok.
- **Sistematik `sm:` küçültme**: header ikonları (`w-7→sm:w-5`), info/feedback ikon (`w-5→sm:w-3.5`), faz ikon svg (`w-8→sm:w-6`), aksiyon panel ikonları (`w-9→sm:w-7`), onaylanan-aksiyon (`w-8→sm:w-6`), bildirim noktası (`w-3.5→sm:w-3`) — desktop mobilin küçültülmüşü.
- **PlayerList** (`GameBoard.jsx:1358`): `flex overflow-x-auto`, kartlar `w-24` sabit — desktop'ta yatay scroll (mobil deseni), grid olmalı.
- **Aksiyon paneli** `min-h-[140px] max-h-[220px]` (`:555`) — desktop yüksek ekranda %33'te kilitli.

## 2. Hedefler

1. **Tek ilke:** Mobil cilası kanonik; desktop'ta hiçbir öğe mobilden **küçük olmaz** — aynı veya daha büyük.
2. Desktop da mobildeki gibi **tek-sayfa, kaymaz** (sabit yükseklik, içeride scroll bölgeleri, sayfa scroll'u yok, kartın altı tırtıklı değil).
3. Tüm gösterge/sayaç/timer/badge **tek şekil-boyut dilinde** (tutarlı set).
4. Desktop kanvası dolar — ölü siyah gutter gider; sohbet/aksiyon alanı geniş ekranı kullanır.
5. Mobil davranış (one-page spec) **birebir korunur**; backend değişmez; yeni özellik yok.

### Hedef olmayanlar
- Oyun mantığı/akışı, faz/rol kuralları — değişmez.
- Yeni özellik / yeni ekran yok.
- Renk paleti yeniden icat yok (mevcut tema korunur, tutarlı uygulanır).
- Buton görsel dili zaten `Button`/`IconButton` ile birleşti (`2026-05-18-web-ui-consistency`) — tekrar elden geçirilmez; bu spec gösterge/layout/boyut odaklı.

## 3. Onaylanan Kararlar

| Konu | Karar |
|---|---|
| Boyut yönü | `sm:`/`lg:` ile **küçültme kaldırılır**; gerekirse desktop'ta **büyütülür**. Mobil değer taban. |
| Desktop yükseklik | Mobil gibi `h-[100svh] overflow-hidden` (tek-sayfa). `sm:overflow-visible` ve `index.css` `body{overflow:auto}@sm` kaldırılır → desktop da kaymaz. İç scroll bölgeleri (`flex-1 min-h-0 overflow-y-auto`) korunur/uygulanır. |
| Genişlik | `max-w-4xl` → `max-w-6xl`; iç yapı asıl-alan + yan-panel gerçek 2-kolon (`lg:`). Yan panel `lg:` altında modal (mevcut davranış). |
| Gösterge sistemi | Yeni izole `frontend/src/components/ui/StatBadge.jsx` — tutarlı dikdörtgen gösterge (`rounded-xl`, tutarlı padding/typografi/renk-tonu). Sadece gerçek dairesel öğeler (TimerDisplay, avatar, bildirim noktası) `rounded-full`. |
| TimerDisplay | Tek tutarlı şekil (`rounded-2xl`, daire değil), desktop'ta **büyük** (`w-16 sm:w-20`), rakam/etiket küçülmez (etiket her zaman okunur). |
| Hüküm sayaçları | `StatBadge` çiftine (Suçlu = kırmızı tonlu, Affet = amber tonlu) — diğer sayaçlarla aynı dil. |
| PlayerList | `sm:`+ `flex-wrap` (yatay scroll yok); kartlar alanı dolduran 2-3 satır. |
| Mobil | one-page spec davranışı birebir korunur (yalnız `sm:`/`lg:` desktop dalları değişir). |

## 4. Tasarım

### 4.1 Wrapper / tek-sayfa (App.jsx + index.css)

- `App.jsx` oyun-state wrapper: `sm:overflow-visible`/`sm:min-h-[100svh]` yerine her boyutta `h-[100svh] overflow-hidden flex` (mobil kuralı genelleşir). Oyun alanı `flex-1 min-h-0`.
- `index.css`: `@media (min-width:640px){ body{ overflow:auto; height:auto } }` benzeri kuralı **kaldır** (veya oyun-state'te etkisizleştir) → desktop'ta da body kaymaz. INTRO/JOIN/LOBBY zaten kendi scroll bölgelerini yönetiyor (one-page spec); onlar bozulmaz.
- GameBoard dış kabı: `max-w-4xl … sm:h-auto sm:min-h-[75vh]` → `max-w-6xl … h-full` (her boyutta yüksekliği doldurur), `overflow-hidden` korunur, `sm:rounded-2xl sm:border` görsel kart korunur ama yükseklik viewport'u doldurur (alt tırtık biter).

### 4.2 Boyut yönü düzeltmesi (GameBoard.jsx, TimerDisplay.jsx)

Genel kural: bir öğede `X sm:Y` deseninde `Y < X` (küçülme) varsa → `sm:` dalını **kaldır** (mobil değer her yerde) veya desktop'ta büyütecek şekilde çevir. Etkilenen (denetimden): TimerDisplay kutu/rakam/etiket; faz ikon kapsayıcı padding + svg; rol rozeti padding/şekil; yetenek sayaç padding; info/feedback ikon; header buton ikonları + bildirim noktası; aksiyon-panel durum ikonları; onaylanan-aksiyon ikon/metin. Hedef: desktop ≥ mobil; asla `sm:` ile küçülme.

`TimerDisplay.jsx`: kutu `w-16 h-16 rounded-2xl` taban, desktop `sm:w-20 sm:h-20` (büyür, şekil sabit `rounded-2xl`). Rakam `text-2xl sm:text-3xl`. "Sn" etiketi `text-[9px] sm:text-[10px]` (asla 7px). Renk/uyarı (düşük süre kırmızı) mantığı korunur.

### 4.3 `StatBadge` bileşeni — `frontend/src/components/ui/StatBadge.jsx` (yeni)

`Button` deseninin gösterge eşi: saf, izole, tek dil.

- Props: `tone` (`'neutral'|'red'|'amber'|'green'|'phase'`), `size` (`'sm'|'md'`), `icon?` (lucide öğesi), `className`, `children`, `...rest`.
- Taban: `inline-flex items-center gap-1.5 rounded-xl border font-bold uppercase tracking-wider whitespace-nowrap`.
- tone sınıfları (mevcut tema tonlarından): `neutral` slate, `red` `bg-red-950/30 text-red-300 border-red-900/50`, `amber` `bg-amber-950/30 text-amber-300 border-amber-900/50`, `green` `bg-emerald-950/30 text-emerald-300 border-emerald-900/50`, `phase` `bg-slate-800/70 text-slate-200 border-slate-700`.
- size: `sm` `text-[10px] px-2 py-1`, `md` `text-xs px-3 py-1.5`. Desktop'ta küçülme yok (gerekiyorsa `md` kullan).
- Kullanım: faz adı pili, rol rozeti, yetenek sayaçları (Kalkan/Pusu/Saklanma), skip-day sayaç etiketi, **hüküm sayaçları** (Suçlu=`red`, Affet=`amber`) — hepsi `StatBadge`. Tek `rounded-xl` dil.
- `rounded-full` yalnız: TimerDisplay (kendi bileşeni, `rounded-2xl` aslında — daire değil), oyuncu avatar dairesi, bildirim noktası, sohbet/mezar ayraç pili (bunlar zaten tutarlı `rounded-full`, dokunulmaz).

### 4.4 Desktop layout (GameBoard.jsx)

- Dış kap `max-w-6xl w-full h-full`. İç yatay split (`flex flex-col lg:flex-row`): asıl sütun `flex-1 min-h-0`, yan panel `lg:flex w-72` (224→288px, içerikle nefes alır; `lg:` altı modal — mevcut).
- Sohbet alanı `flex-1 min-h-0 overflow-y-auto` (zaten) — geniş sütunu kullanır; `max-w-4xl` kalkınca doğal genişler.
- Aksiyon paneli: `min-h-[140px]` taban korunur, `max-h-[220px]` desktop'ta gevşetilir (`sm:max-h-[300px]`) — yüksek ekranda oyuncu kartları rahat.
- PlayerList (`GameBoard.jsx:1358`): `flex overflow-x-auto` → `flex flex-wrap` (`sm:` ve üstü; mobilde de wrap kabul — yatay scroll kaldırılır). Kart `w-24` korunur; wrap ile 2-3 satır alanı doldurur.

### 4.5 Header satırı tutarlılığı

Faz ikon kapsayıcı + faz adı + rol rozeti + yetenek sayaçları aynı dikey hizada, `StatBadge` (`phase`/uygun tone) ile tek dil; faz ikon kapsayıcı dairesel kalabilir (ikon konteyneri) ama boyutu desktop'ta küçülmez. TimerDisplay header'da büyük ve tek şekil.

## 5. Etkilenen Dosyalar

- **Yeni:** `frontend/src/components/ui/StatBadge.jsx`.
- **Değişen:** `frontend/src/components/GameBoard.jsx` (layout genişlik/yükseklik, `sm:` küçültme kaldırma, göstergeler→StatBadge, PlayerList wrap, hüküm sayaçları), `frontend/src/components/TimerDisplay.jsx` (şekil sabit + desktop büyür + etiket okunur), `frontend/src/App.jsx` (oyun wrapper tek-sayfa her boyutta), `frontend/src/index.css` (desktop `body overflow:auto` kuralı oyunu bozmayacak şekilde kaldır/sınırla).
- **Değişmez:** backend tümü; `Button`/`IconButton` (önceki spec); INTRO/JOIN/LOBBY one-page davranışı; oyun mantığı.

## 6. Kenar Durumlar

1. INTRO/JOIN/LOBBY: `index.css` body-overflow kuralı kaldırılırken bu ekranların kendi scroll bölgeleri (one-page spec) bozulmamalı — wrapper değişikliği yalnız GAME-state'i hedefler veya tüm state'ler zaten `flex-1 min-h-0` ile uyumlu olmalı (one-page spec bunu zaten kuruyor). Doğrulama: 4 ekran da scroll/taşma testinden geçer.
2. Kısa desktop ekranı (yükseklik < ~700px): `h-[100svh] overflow-hidden` + iç scroll → sohbet bölgesi scroll alır, dış taşma yok.
3. `lg:` 1024px altı (tablet): yan panel modal (mevcut), asıl sütun tam genişlik — bozulma yok.
4. Çok geniş ekran (≥1920px): `max-w-6xl` (1152px) ortalı; gutter kalır ama makul (kart genişledi, %42→~%80 kullanım). Tam-genişlik istenmiyor (okunabilirlik); kabul.
5. Mobil: hiçbir `sm:`-altı (taban) değer değişmez → mobil birebir korunur.
6. TimerDisplay düşük-süre kırmızı/pulse uyarısı: yalnız şekil/boyut değişir, uyarı mantığı/renkleri korunur.
7. `StatBadge` aktif/pasif veya dinamik renk: `tone` prop + gerekiyorsa `className` (Button deseniyle aynı; sona eklenir).

## 7. Test Planı

Saf mantık yok → repo geleneği: `npx eslint <dosya>` (yeni hata yok) + `npm run build` (`✓ built`) + manuel görsel.

**Manuel (desktop + mobil, devtools responsive):**
1. Desktop GAME: sayfa **kaymaz**, kart yüksekliği viewport'u doldurur, alt tırtık yok.
2. TimerDisplay desktop'ta mobilden **büyük**, tek şekil, "Sn" okunur; düşük-süre uyarısı çalışır.
3. Header: faz ikonu/adı/rol/yetenek sayaçları + hüküm sayaçları tek dil (`StatBadge`), desktop'ta küçülmemiş.
4. Hüküm fazı: "Suçlu/Affet" sayaçları konteynırlı, diğer sayaçlarla tutarlı.
5. Geniş ekran: ölü siyah gutter belirgin azaldı; sohbet/aksiyon kanvası kullanıyor.
6. PlayerList desktop'ta yatay scroll **yok**, wrap'li alanı dolduruyor; gece/gündüz hedef seçimi rahat.
7. Tablet (~768px): yan panel modal, asıl alan tam genişlik, bozulma yok.
8. Mobil (≤640px): one-page spec davranışı birebir aynı (regresyon yok) — INTRO/JOIN/LOBBY/GAME hepsi kaymaz, iç scroll çalışır.
9. Hiçbir oyun işlevi (emit/handler/faz) kaybolmadı.
