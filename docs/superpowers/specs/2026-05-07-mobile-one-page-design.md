# Mobil "One-Page" Arayüz Tasarımı

**Tarih:** 2026-05-07
**Durum:** Onaylandı, implementasyona hazır
**Hedef:** Kuyu oyununun mobil deneyimini native uygulama gibi tek-sayfa hale getirmek

---

## 1. Hedef ve Kısıtlar

**Hedef:** Mobilde ana çerçeve **asla scroll olmasın**. Sadece içeride özel olarak işaretlenmiş kutular (chat, modal içerikleri, listeler) kendi içinde scroll yapsın.

**Kapsamdaki ekranlar:**
- INTRO (zaten OK — fixed inset-0)
- JOIN (Lobby.jsx — şu an scroll'lanıyor, düzeltilecek)
- LOBBY (oda içi App.jsx — şu an scroll'lanıyor, sekmeli yapıya geçecek)
- GAME (GameBoard.jsx — zaten one-page, ufak revizyon)
- Modallar: Köy Defteri (sekmeli olacak), Kuyunun Dibi (zaten OK), Vasiyet Reveal (carousel olacak)

**Kapsam dışı:**
- Yeni özellik eklemek (günlük/diary gibi). Mevcut "Vasiyet" tek alan kalacak.
- Backend (server.js) değişikliği. Sadece frontend.
- Desktop layout — mevcut `sm:` breakpoint sonrası tasarım korunur.

---

## 2. Genel Mimari

**Temel kural:** Body ve ana wrapper `100dvh` yüksekliğinde, dış scroll kapalı. Her sayfa `flex flex-col` ile dikey alanını yönetir; içerideki belirli kutular `flex-1 min-h-0 overflow-y-auto` ile scroll alır.

### Wrapper hiyerarşisi (App.jsx)

```jsx
<div className="h-[100dvh] overflow-hidden flex flex-col bg-[#050505] sm:min-h-[100dvh] sm:overflow-visible">
  {/* INTRO: fixed overlay */}
  {/* JOIN/LOBBY/GAME: flex-1 min-h-0 (her biri kendi içinde) */}
</div>
```

**Mobil için:** `overflow-hidden` her zaman aktif.
**Desktop için:** `sm:overflow-visible` ile geleneksel sayfa davranışı korunur.

### CSS değişiklikleri (`index.css`)

- `body { overflow: hidden; height: 100dvh; }` mobilde — taşma kapalı
- Ek class: `.scrollable-area { overflow-y: auto; min-height: 0; }` (yardımcı)

---

## 3. JOIN Ekranı (Lobby.jsx)

**Yaklaşım:** Mevcut yapı (isim + 4 mod butonu + alt panel) korunur. Sadece kompaktlaştırılır.

**Değişiklikler:**
- Wrapper: `flex-1 min-h-0 flex flex-col items-center justify-center px-4`
- Form kart padding'i: `p-8` → `p-5 sm:p-8`
- Buton padding'i: `py-4` → `py-3 sm:py-4`
- Ana KUYU başlığı (App.jsx içindeki header): mobilde `text-3xl`, desktop'ta `text-5xl+`
- Form yüksek olursa kart `max-h-full overflow-y-auto` ile kendi içinde scroll alır (klavye açıldığında taşmasın)

---

## 4. LOBBY Ekranı (Oda İçi)

**Yaklaşım:** Sekmeli yapı — Oyuncular / Ayarlar / Roller.

### Layout

```
flex flex-col h-full
├─ Header (Oda kodu + çıkış)              [shrink-0]
├─ Tab bar (Oyuncular | Ayarlar | Roller)  [shrink-0]
├─ Active tab content                      [flex-1 min-h-0 overflow-y-auto]
└─ Sticky CTA: "Oyunu Başlat (X/16)"       [shrink-0]
```

### Sekmeler

**Oyuncular sekmesi:**
- Oyuncu listesi (mevcut yapı — HOST rozeti, "Sen" etiketi)
- Boşsa "İzleyici modundasın..." mesajı

**Ayarlar sekmesi:**
- Süreler grid (gece/sabah/gün/oylama) — mevcut UI
- Rol Oranları (kırmızı/gri/yeşil) — mevcut UI
- Host olmayan için tüm input'lar `disabled`, üstte tek satır "Sadece kurucu değiştirebilir" rozeti

**Roller sekmesi:**
- Şu anki "Rol Havuzu" modalı **içeriği** doğrudan sekme olarak gömülür (modal kalkar)
- 3 grup (Masumlar / Eşkıyalar / Tarafsızlar), her biri checkbox listesi

### State değişiklikleri

- `showRoleSettings` state'i kaldırılır (artık modal değil)
- Yeni state: `lobbyTab` (default: `'players'`)

### Sticky CTA

```jsx
<div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/80">
  {isHost
    ? <button>Oyunu Başlat ({n}/16)</button>
    : <p>Köyün kurucusu bekleniyor...</p>}
</div>
```

---

## 5. GameBoard Revizyonları

GameBoard zaten one-page, kapsamlı değişiklik yok.

**Tek değişiklik:** "Köy Defteri" butonuna basıldığında açılan modal sekmeli yapıya geçer (Bölüm 6).

**Diğerleri korunur:**
- Üst phase header (shrink-0)
- Aksiyon paneli (collapse/expand)
- Chat alanı (flex-1, kendi içinde scroll)
- Chat input (shrink-0)
- "Kuyunun Dibi" — mobilde sadece modal, desktop'ta sağ panel

---

## 6. Köy Defteri Modal — Sekmeli

Şu an aynı modal'da `systemNotes` listesi + `personalNote` textarea alt alta. Mobilde dikey kalabalık.

### Yeni yapı

```
fixed inset-0 (mobilde tam ekran, desktop'ta merkez modal)
├─ Header: 📖 Köy Defteri  [X]            [shrink-0]
├─ Tab bar: Olaylar | Vasiyetim            [shrink-0]
└─ Active tab content                      [flex-1 min-h-0 overflow-y-auto]
```

### Sekmeler

**Olaylar sekmesi:**
- `systemNotes` listesi — mevcut format (border-l-4 align rengi)
- Boşsa "Henüz bir olay gerçekleşmedi..."

**Vasiyetim sekmesi:**
- Tam yükseklik `<textarea>` (h-full, flex-1)
- Altta küçük not: "öldüğünde köye okunur"
- Şu anki `personalNotesMap[activeSocketId]` state'i ve `savePersonalNote` socket emit korunur

### State

- Yeni state: `notesTab` (default: `'events'`)

---

## 7. Vasiyet Reveal Modal — Carousel

Birden fazla `revealedNotes` olduğunda swipe ile geçilir. Tek vasiyet varsa carousel UI gizli — doğrudan içerik.

### Yapı

```
fixed inset-0 (her zaman tam ekran)
├─ Header: ÖLÜNÜN VASİYETİ          (i/n)  [shrink-0]
├─ Carousel area                            [flex-1 min-h-0]
│   └─ Horizontal scroll-snap container
│       └─ N x slide (her slide tam ekran genişliği)
├─ Dot indicator (n>1 ise)                  [shrink-0]
└─ Buton: "Huzur İçinde Yatsın"             [shrink-0]
```

### Implementasyon

- Yeni dependency yok. Saf CSS scroll-snap:
  ```jsx
  <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex">
    {revealedNotes.map((rn, i) => (
      <div key={i} className="snap-center shrink-0 w-full overflow-y-auto p-6">
        ...vasiyet içeriği...
      </div>
    ))}
  </div>
  ```
- Aktif slide takibi: `useState(activeIndex)` + scroll event listener (`scrollLeft / clientWidth` round)
- Header sayacı: `(activeIndex+1) / revealedNotes.length`
- Nokta göstergesi: `n > 1` durumunda alt şeritte
- Tek vasiyet varsa header sayacı ve nokta göstergesi gizlenir

---

## 8. Doğrulama

**Manuel test (mobilde / chrome devtools mobile mode):**
- [ ] INTRO ekranı dış scroll yok
- [ ] JOIN ekranı klavye açılınca taşmıyor (form kart kendi içinde scroll)
- [ ] LOBBY oyuncular sekmesi 16 oyuncu ile scroll'lu, sayfa scroll'lu değil
- [ ] LOBBY ayarlar sekmesi tek ekrana sığar
- [ ] LOBBY roller sekmesi 18 rol checkbox listesi sekme içinde scroll
- [ ] LOBBY başlat butonu hep alt şeritte sabit
- [ ] GAME chat scroll'lu, sayfa scroll'lu değil
- [ ] Köy Defteri modalı sekme geçişi çalışır, vasiyet textarea full height
- [ ] Vasiyet reveal carousel: 1 vasiyet → düz görünür, 3 vasiyet → swipe çalışır + nokta göstergesi
- [ ] Tüm modallar mobilde tam ekran, desktop'ta merkez

**Desktop regression:**
- [ ] LOBBY desktop'ta da sekmeli görünüyor mu? (Karar: evet, mobil ile tutarlı olsun.)
- [ ] Tüm sm: breakpoint'ler korundu mu?

---

## 9. Etkilenen Dosyalar

- `frontend/src/App.jsx` — wrapper, LOBBY sekmeli yapı, role settings modal kaldırma
- `frontend/src/components/Lobby.jsx` — JOIN kompaktlaştırma
- `frontend/src/components/GameBoard.jsx` — Köy Defteri modal sekmeli, vasiyet reveal carousel
- `frontend/src/index.css` — body overflow, height kuralları

Backend değişikliği yok.
