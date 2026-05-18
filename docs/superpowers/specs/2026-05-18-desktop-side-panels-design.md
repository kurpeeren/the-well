# Kuyu — Desktop Yan Paneller (Köy Defteri / Vasiyetim) + Çıkış Boyutu Tasarımı

- **Tarih:** 2026-05-18
- **Durum:** Onaylandı (uygulama planı bekliyor)
- **Kapsam:** Desktop (`lg:`+) oyun ekranında Köy Defteri (Olaylar) ve Vasiyetim'i modal yerine kalıcı açık yan panellere taşımak; Çıkış butonunu desktop'ta TimerDisplay (saniye) ile aynı ayak izine getirmek. Mobil/tablet (`<lg`) davranışı birebir korunur.

---

## 1. Problem

`max-w-6xl` genişletmesinden sonra desktop'ta yan boşluk var ama Köy Defteri (Olaylar timeline) ve Vasiyetim hâlâ "Notlar" (BookOpen) butonuyla açılan **modal** arkasında — kullanıcı bunları kalıcı panel olarak istiyor. Ayrıca Çıkış butonu (`variant="danger" size="sm" pill`, `w-7 h-7` ikon) desktop'taki TimerDisplay'den (`sm:w-20 sm:h-20`, 80px) çok küçük; kullanıcı eşit boyut istiyor.

Mevcut yapı (koddan):
- Çıkış butonu `GameBoard.jsx:~539`; TimerDisplay desktop `hidden sm:block`, `w-16 h-16 sm:w-20 sm:h-20`.
- Köy Defteri modal `showNotes` (`:940`), iki sekme `notesTab` `'events'|'will'` (`:955`): Olaylar (`systemNotes` timeline, `:973-1006`) + Vasiyetim (`personalNotesMap[activeSocketId]` textarea + `savePersonalNote` emit, `:1008-1025`).
- Mevcut desktop yan paneli `hidden lg:flex w-56` = Kuyunun Dibi/mezarlık (`:891`); `lg:` altında Mezarlık butonu (`lg:hidden`) + modal (`:1086`). Layout `:553` `flex flex-col lg:flex-row`.

## 2. Hedefler

1. Desktop'ta (`lg:`+) **3-kolon**: sol = Köy Defteri (Olaylar), orta = oyun (değişmez), sağ = Vasiyetim (üst) + Kuyunun Dibi/mezarlık (alt) dikey stack — hepsi kalıcı açık, modal yok.
2. Çıkış butonu desktop'ta TimerDisplay ile **aynı ayak izi** (kare ~`w-20 h-20`, ikon ortalı), yanında eşit dursun.
3. Mobil/tablet (`<lg`, ≤1023px) **birebir korunur**: Notlar/Mezarlık butonları + modallar aynen; one-page spec bozulmaz.
4. İçerik **tek kaynaktan** (DRY): modal ve panel aynı Olaylar/Vasiyetim/Mezarlık içeriğini paylaşır — JSX kopyalanmaz.

### Hedef olmayanlar
- Oyun mantığı/akışı, `savePersonalNote`/`systemNotes` veri akışı — değişmez.
- Yeni özellik/sekme yok (Olaylar/Vasiyetim/Mezarlık mevcut içerik).
- `<lg` (mobil/tablet) görünümü/akışı — hiç değişmez.
- Backend yok.

## 3. Onaylanan Kararlar

| Konu | Karar |
|---|---|
| Kırılım | Paneller yalnız `lg:`+ (≥1024px). `<lg` modal kalır (mevcut). |
| Sol panel | Köy Defteri = **Olaylar** (systemNotes timeline). |
| Sağ kolon | Üstte **Vasiyetim** (kişisel not editörü), altta mevcut **Kuyunun Dibi** (mezarlık) — dikey stack. |
| Kuyunun Dibi yerleşimi | Mevcut tek sağ panel; sağ kolonun altına alınır, Vasiyetim üstüne (kullanıcı "Vasiyetim sağda" dedi, graveyard kaybolmaz). |
| Çıkış boyutu | Desktop'ta TimerDisplay ile eşit (`sm:w-20 sm:h-20` kare, ikon ortalı). Mobil tile (`min-h-[64px]` + label) korunur. |
| DRY | Olaylar listesi + Vasiyetim editörü izole sunum bileşenlerine çıkarılır; modal (mobil) ve panel (desktop) ikisini de kullanır. |
| Desktop modal butonları | Notlar + Mezarlık butonları `lg:hidden` (panel açıkken modal gereksiz). Mezarlık zaten `lg:hidden`. |

## 4. Tasarım

### 4.1 Çıkış = TimerDisplay boyutu

Çıkış `<Button variant="danger" size="sm" pill ...>` — desktop'ta TimerDisplay ayak izine eşitlenir. Mobil dalı (`flex-col ... min-h-[64px]` + `sm:hidden` label) **değişmez**; yalnız `sm:` dalına TimerDisplay ölçüsü eklenir: `sm:w-20 sm:h-20 sm:p-0` (kare, ikon `w-7 h-7` ortalı). Sonuç: desktop header'da Timer ile Çıkış aynı 80px kare, yan yana hizalı. (Gerekirse Notlar butonu da `lg:hidden` olunca header sadeleşir — bkz §4.3.)

### 4.2 Desktop 3-kolon layout

`GameBoard.jsx:553` ana içerik satırı `flex flex-col lg:flex-row gap-0 sm:gap-4 flex-1 ... min-h-0`. Yapı:

- **Sol panel** (yeni): `hidden lg:flex lg:w-64 flex-col lg:h-full shrink-0` — Köy Defteri başlığı + `<EventsList>` (kaydırılabilir, `flex-1 min-h-0 overflow-y-auto`).
- **Orta** (mevcut ana sütun): `flex-1 min-h-0` — faz/aksiyon/sohbet aynen.
- **Sağ kolon** (mevcut yan panel yeniden yapılandırılır): `hidden lg:flex lg:w-64 flex-col gap-4 lg:h-full shrink-0`, içinde dikey:
  - Üst: **Vasiyetim** paneli — başlık + `<WillEditor>` (`flex-1 min-h-0`, textarea full-height).
  - Alt: mevcut **Kuyunun Dibi** (mezarlık) paneli — şu anki `:891` içeriği, kendi scroll'u korunur.
  - İki bölüm `lg:h-full` içinde makul dağılır (ör. Vasiyetim `flex-1`, Kuyunun Dibi `max-h-[40%] overflow-y-auto` — kesin oranlar planda netleşir, ikisi de scroll'lu, taşma yok).

`<lg`: sol panel ve sağ Vasiyetim render edilmez (yalnız `lg:flex`); ana sütun tam genişlik; Notlar/Mezarlık butonları + modallar mevcut davranış.

### 4.3 İçerik bileşenleri (DRY — izole)

Mevcut modal JSX'i kopyalanmaz; üç küçük saf sunum bileşeni çıkarılır (GameBoard.jsx içinde yerel fonksiyon bileşeni veya ayrı dosya — plan netleştirir, mevcut dosya deseni izlenir):

- **`EventsList`** — `systemNotes` timeline render'ı (modal `:973-1006` içeriği). Props: `systemNotes` (+ render için gereken yardımcılar). Modal "Olaylar" sekmesi ve sol panel ikisi de bunu kullanır.
- **`WillEditor`** — Vasiyetim textarea + kaydetme. Props: `value` (`personalNotesMap[activeSocketId]`), `onChange/onSave` (mevcut `socket.emit('savePersonalNote', { roomCode, note, impersonateId })` mantığı aynen — bileşen bunu prop callback ile alır, davranış değişmez). Modal "Vasiyetim" sekmesi ve sağ panel ikisi de kullanır.
- **Kuyunun Dibi**: zaten hem panel (`:891`) hem modal (`:1086`) formunda var; içeriği gerekiyorsa `GraveyardContent` olarak ortaklaştırılır (kopya varsa giderilir), sağ kolonun alt bölümü ve mobil modal aynı içerik.

Desktop'ta Notlar butonu (`:523`) `lg:hidden` olur (modal `<lg` için kalır). Mezarlık butonu zaten `lg:hidden`. Modal kodu (`showNotes`/`showGraveyard`) silinmez — `<lg` için gereklidir; yalnız desktop'ta panel kullanılır.

### 4.4 Durum/akış

- `personalNotesMap`, `notesTab`, `systemNotes`, `savePersonalNote` emit, `activeSocketId`, `isDevMode/impersonateId` — hepsi mevcut haliyle korunur; bileşenler bunları prop olarak alır. `notesTab` yalnız modal için anlamlı kalır (panelde sekme yok — sol=Olaylar, sağ=Vasiyetim ayrık).
- Bildirim noktası (`systemNotes?.length > 0`) Notlar butonunda `<lg` için kalır; desktop'ta panel zaten görünür (rozet gereksiz, `lg:hidden` ile gizli kalır).

## 5. Etkilenen Dosyalar

- **Değişen:** `frontend/src/components/GameBoard.jsx` — Çıkış `sm:` boyut; 3-kolon `lg:` layout; sol Köy Defteri paneli; sağ kolon Vasiyetim+Kuyunun Dibi stack; `EventsList`/`WillEditor`(/`GraveyardContent`) çıkarımı + modalın bunları kullanması; Notlar butonu `lg:hidden`.
- **Olası yeni:** içerik bileşenleri ayrı dosyaya çıkarılırsa `frontend/src/components/<...>.jsx` (plan kararı; mevcut "tek dosya içinde yerel bileşen" deseni de kabul — DRY sağlandığı sürece).
- **Değişmez:** backend; one-page/StatBadge/Button önceki spec'ler; `<lg` görünüm/akış; oyun mantığı/socket olayları.

## 6. Kenar Durumlar

1. `<lg` (mobil/tablet): sol/sağ paneller render edilmez; modal yolu birebir mevcut. Regresyon yok (one-page spec korunur).
2. Kısa desktop yükseklik: her panel `flex-1 min-h-0 overflow-y-auto` (veya `max-h`+scroll) → içerik taşmaz, sayfa kaymaz (tek-sayfa spec ile uyumlu).
3. Çok dar `lg` (1024-1279): 3-kolon + 2×`w-64` panel + orta `flex-1` — orta sütun daralır ama sohbet/aksiyon `min-w-0` ile bozulmaz; gerekiyorsa paneller `lg:w-60`. Plan kesin genişlikleri ayarlar; taşma olmamalı.
4. Vasiyetim kaydetme: panel ve modal aynı `WillEditor` → `savePersonalNote` emit tek mantık; çift gönderim yok (bir anda biri görünür: `<lg` modal, `lg:` panel).
5. Spectator/dev: Vasiyetim/Olaylar mevcut görünürlük kuralları (`activeSocketId`, `isDevMode` impersonate) bileşene prop olarak taşınır — davranış aynen.
6. Notlar butonu `lg:hidden`: desktop'ta yokken sol panel her zaman açık; bildirim rozeti `<lg`'de Notlar butonunda kalır.

## 7. Test Planı

Saf mantık yok → repo geleneği: `npx eslint <dosya>` (yeni hata yok) + `npm run build` (`✓ built`) + manuel görsel.

**Manuel (desktop ≥1024 + tablet ~768 + mobil ≤640):**
1. Desktop: sol Köy Defteri (Olaylar) + sağ Vasiyetim + altında Kuyunun Dibi — hepsi kalıcı açık, modal açılmıyor; Notlar/Mezarlık butonları görünmüyor (`lg:hidden`).
2. Desktop: Çıkış butonu TimerDisplay ile aynı boyut/hizada.
3. Desktop Vasiyetim panelinden yaz → `savePersonalNote` gider, kalıcı; sayfa/kart kaymaz, paneller kendi içinde scroll.
4. Olaylar paneli `systemNotes` ile dolu → scroll çalışır; modal "Olaylar" ile birebir aynı içerik (kopya yok).
5. Tablet (~768): paneller YOK, Notlar/Mezarlık butonları + modallar mevcut davranış; Çıkış mobil tile.
6. Mobil (≤640): one-page spec birebir; Notlar modal sekmeli (Olaylar/Vasiyetim) aynen; regresyon yok.
7. Vasiyetim modal (`<lg`) ve panel (`lg`) aynı `WillEditor` → kaydetme her ikisinde de çalışır, çift emit yok.
8. Hiçbir oyun işlevi (emit/handler/faz) kaybolmadı.
