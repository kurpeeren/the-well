# Kuyu — Web Arayüzü Tutarlılık / Tasarım Dili Tasarımı

- **Tarih:** 2026-05-18
- **Durum:** Onaylandı (uygulama planı bekliyor)
- **Kapsam:** Web/desktop arayüzündeki tutarsız buton/bileşen dilini, mobil cilasını referans alarak tek bir paylaşılan tasarım dilinde birleştirmek.

---

## 1. Problem

`https://kuyu.click` web sürümünde butonlar tutarsız: aynı anlamdaki aksiyon ekrandan ekrana farklı görünüyor. Denetim bulguları:

- **Paylaşılan Button bileşeni yok** → semantik olarak 3-4 rol için **8 ayrı ad-hoc buton stili**.
- **`accent` token çakışması:** `tailwind.config.js` `accent = #1d4ed8` (mavi), `index.css` `@theme` `accent = #d97706` (amber). Tailwind v4 `@theme` kazandığı için **render edilen amber**, ama config yanlış kaynak (sessiz teknik borç).
- **Primary CTA tutarsız:** `rounded-lg` vs `rounded-xl` (3'e 3); `py-3` vs `py-3 sm:py-4` (modal CTA'lar desktop'ta küçük kalıyor).
- **In-game aksiyon paneli:** aynı ekranda 200px içinde 4 farklı radius (`rounded-full` / `rounded-xl` / `rounded-lg` / çıplak).
- **END ekranı CTA'ları** (oyun sonu en önemli aksiyon) tüm uygulamadaki en donuk stil — düz slate, glow yok.
- **Modal kapatma** her modalda farklı (X ikon 4 boyut / full-width buton / grid split / hiç).
- **LOBBY'de çift "Çıkış"** butonu (header + oda-kodu barı) belirli desktop genişliklerinde birlikte görünebiliyor, ikisi farklı görünüyor.

## 2. Hedefler

1. Tek paylaşılan `Button` (ve `IconButton`) bileşeni — tüm ekranlar onu kullanır.
2. `accent` token çakışması giderilir (tek doğru değer).
3. Aynı semantik aksiyon her ekranda **aynı** görünür (radius, padding, tipografi, glow, hover/active).
4. En kötü 6 yapısal tutarsızlık düzeltilir (END CTA, modal kapatma, çift Çıkış, aksiyon paneli radius, primary CTA tekleştirme, leave-confirm modal uyumu).
5. Kalite çıtası = mevcut **mobil** cilası; desktop o seviyeye çekilir.

### Hedef olmayanlar (non-goals)

- Layout/sayfa akışı değişmez — `2026-05-07-mobile-one-page-design` yapısı korunur (`sm:` desktop davranışı dahil).
- Yeni özellik yok. Backend (`server.js`) değişmez. Yalnız frontend.
- Renk paletini yeniden icat etmek yok — mevcut tema renkleri (blood-red, amber accent, slate, kuyu-dark) korunur, yalnız tutarlı uygulanır.
- Tam görsel "redesign" değil; tutarlılık + cilalama.

## 3. Onaylanan Kararlar

| Konu | Karar |
|---|---|
| Yaklaşım | React bileşeni (`Button`/`IconButton`) — `@layer components` global class değil. Sebep: variant/size prop'u, tip netliği, güvenli mekanik refactor. |
| `accent` değeri | **Amber `#d97706`** (render edilen gerçek). `tailwind.config.js` buna hizalanır (çakışma giderilir). |
| Primary renk | **blood-red + glow** = dramatik ana aksiyon (kuyu/kan teması). Amber = ikincil/onay. |
| Variant seti | `primary` (blood-red glow), `accent` (amber), `neutral` (slate), `danger` (kırmızı çerçeve), `chip` (rounded-full toggle). |
| Size seti | `sm`, `md`, `lg`. |
| Radius | `md`/`lg` → `rounded-xl`; `chip` → `rounded-full`. Tek ölçek, başka radius kullanılmaz. |
| Layout | Değişmez (mobil spec korunur). |

## 4. Tasarım

### 4.1 Token düzeltmesi

`frontend/tailwind.config.js` içindeki `accent` değeri `#d97706`'ya çekilir (veya çakışan ölü tanım kaldırılır) — `index.css` `@theme` ile **aynı**. `blood-red`/`dark-bg`/`kuyu-dark` zaten tutarlı, dokunulmaz. Görsel sonuç değişmez (zaten amber render ediliyordu); amaç tek doğru kaynak.

### 4.2 `Button` bileşeni — `frontend/src/components/ui/Button.jsx`

Props: `variant` (`'primary'|'accent'|'neutral'|'danger'|'chip'`, default `'primary'`), `size` (`'sm'|'md'|'lg'`, default `'md'`), `className` (ek/override için, sona eklenir), `as` opsiyonel değil (her zaman `<button>`), kalan tüm props (`onClick`, `disabled`, `type`, `title`, `children`…) `<button>`'a geçer.

Ortak taban: `inline-flex items-center justify-center gap-2 font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none`.

Variant sınıfları (kanonik, mevcut en cilalı desenlerden türetilir):
- `primary`: `bg-blood-red hover:bg-red-800 text-white border border-blood-red shadow-[0_0_20px_rgba(127,29,29,0.4)]`
- `accent`: `bg-accent hover:bg-amber-700 text-white border border-accent shadow-[0_0_20px_rgba(217,119,6,0.4)]`
- `neutral`: `bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`
- `danger`: `bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-900/60`
- `chip`: `rounded-full border` + aktif/pasif çağıran tarafça `aria-pressed`/`className` ile verilir; taban `bg-slate-900/60 text-slate-400 hover:text-white`

Size sınıfları:
- `sm`: `text-[10px] px-3 py-1.5 rounded-xl`
- `md`: `text-xs px-5 py-3 rounded-xl`
- `lg`: `text-sm px-6 py-3.5 rounded-xl`
- `chip` variant size'dan bağımsız `rounded-full text-[10px] px-3 py-1` (size yine padding ölçekler)

> `chip` variant'ında radius `rounded-full`'a override edilir (variant sınıfı size'dan sonra gelir).

### 4.3 `IconButton` bileşeni — aynı dosyada export

Modal kapatma / ikon-only aksiyonlar için tek desen: `p-1.5 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors`, `aria-label` zorunlu prop, `children` = ikon. Tüm modal X'leri buna geçer.

### 4.4 Yapısal düzeltmeler (denetimdeki en kötü 6)

1. **END ekranı CTA** (`GameBoard.jsx` ~876-880): "Odada Kal" → `Button variant="neutral" size="lg"`, "Çıkış Yap" → `Button variant="danger" size="lg"`. Donuk slate kalkar.
2. **Modal kapatma**: ShareInviteModal, FeedbackModal, GameBoard Köy Defteri/Rol/Silenced/Leave-confirm — hepsi `IconButton` X (veya yoksa eklenir). Leave-confirm modal'ın iOS-alert grid'i normal modal düzenine (başlık + içerik + `Button` aksiyonlar) çekilir.
3. **Çift "Çıkış"** (`App.jsx` 439 + 537): tek mantığa indirilir — header'daki kanonik leave `Button variant="danger" size="sm"`, oda-kodu barındaki tekrarlı olan kaldırılır (responsive görünürlük tek yerde yönetilir).
4. **In-game aksiyon paneli** (`GameBoard.jsx` night/vote/judgment/mayor/skip/kundakçı/avcı/kaçak butonları): hepsi `Button` (uygun variant) — tek radius (`rounded-xl`). "Onayla/Oyla" `primary`/`accent`, "Geri Al" `neutral`, özel gece aksiyonları `primary`.
5. **Primary CTA tekleştirme**: "Oyunu Başlat", "Köyü İnşa Et", "Kapıyı Çal", Admin login, FeedbackModal "Gönder", Rol modal "Anladım" → hepsi `Button` (`primary` veya `accent`), aynı radius+padding.
6. **Tab barları** (`App.jsx` LOBBY sekme, `GameBoard.jsx` notes sekme, `Admin.jsx` çipleri): zaten kendi içinde tutarlı; admin çip/filtreleri `Button variant="chip"`'e geçer. LOBBY/notes tab'ları `border-b-2` deseniyle olduğu gibi bırakılır (buton değil, sekme — kapsam dışı tutulur, tutarlı).

### 4.5 Uygulama sırası (refactor güvenliği)

1. Token fix + `Button`/`IconButton` bileşeni (izole, kırılma yok).
2. Ekran ekran değiştirme: Lobby.jsx → App.jsx → GameBoard.jsx (aksiyon paneli, END, modallar) → Admin.jsx → ShareInviteModal/FeedbackModal/TimerDisplay.
3. Her adımda `npm run build` + `npx eslint` (yeni hata yok) + görsel kontrol.

## 5. Etkilenen Dosyalar

- **Yeni:** `frontend/src/components/ui/Button.jsx` (`Button` + `IconButton` export).
- **Değişen:** `frontend/tailwind.config.js` (accent token), `frontend/src/components/Lobby.jsx`, `frontend/src/App.jsx`, `frontend/src/components/GameBoard.jsx`, `frontend/src/components/Admin.jsx`, `frontend/src/components/ShareInviteModal.jsx`, `frontend/src/components/FeedbackModal.jsx`, `frontend/src/components/TimerDisplay.jsx`.
- **Değişmez:** backend tümü, `index.css` (accent zaten doğru), layout yapısı.

## 6. Kenar Durumlar

1. `disabled` butonlar (host olmayan ayarlar): `Button` `disabled` prop'u → `opacity-50 pointer-events-none`, mevcut davranış korunur.
2. `chip` aktif/pasif durumu: çağıran taraf `className` ile aktif rengi verir (ör. `className={active ? 'bg-blood-red text-white' : ''}`); taban pasif stil bileşende. Override sona eklendiği için çalışır.
3. Buton içinde ikon + metin: `children` olduğu gibi geçer, taban `gap-2` ile hizalı.
4. `ml-auto`/`mr-auto` gibi konumlandırma: layout sınıfı bileşene `className` ile verilir (variant'a gömülmez).
5. `animate-pulse` gibi vurgular (gece onay butonu): `className` ile eklenir, variant'a gömülmez.
6. Native share yoksa fallback buton (ShareInviteModal): yine `Button` (`accent`), mantık değişmez.

## 7. Test Planı

Saf mantık yok → repo geleneği: otomatik build/lint + manuel görsel.

**Otomatik (her adım):** `cd frontend && npx eslint <dosya>` (yeni hata yok) + `npm run build` (`✓ built`).

**Manuel görsel (desktop + mobil/devtools):**
1. JOIN: "Köyü İnşa Et" / "Kapıyı Çal" tek dilde, mobil = desktop cila.
2. LOBBY: tek "Çıkış" butonu; "Oyunu Başlat" primary; sekmeler bozulmamış.
3. GAME: aksiyon paneli butonları tek radius/dil; gece/oy/yargı/muhtar/skip tutarlı; `animate-pulse` korunur.
4. END: "Odada Kal" neutral, "Çıkış Yap" danger — artık donuk değil, tutarlı.
5. Modallar: tüm X'ler aynı `IconButton`; leave-confirm normal modal düzeninde; ShareInvite/Feedback tutarlı.
6. Admin: çip/filtre/sekme `chip` variant tutarlı; login butonu primary.
7. Disabled durum (host olmayan ayarlar) hâlâ devre dışı görünür.
8. Regression: hiçbir buton işlevi (onClick/emit) kaybolmadı; layout `sm:` davranışı korundu.
