# Web Arayüzü Tutarlılık / Tasarım Dili — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tek paylaşılan `Button`/`IconButton` bileşeni + `accent` token düzeltmesiyle web arayüzündeki 8 ad-hoc buton stilini tek tutarlı tasarım diline indirgemek (layout/akış değişmeden).

**Architecture:** Yeni izole `frontend/src/components/ui/Button.jsx` (variant+size, saf sunum). `tailwind.config.js` `accent` değeri `index.css @theme` ile hizalanır (görsel sonuç değişmez, tek doğru kaynak). Sonra ekran ekran ad-hoc buton className'leri `<Button>`/`<IconButton>` ile değiştirilir; onClick/disabled/konum/animasyon korunur. Mekanik refactor — her ekran kendi içinde tamamlanır.

**Tech Stack:** React 19 + Vite + Tailwind (v4 `@theme`). Saf birim test gerektiren mantık yok → repo geleneği: `npx eslint <dosya>` (yeni hata yok) + `npm run build` (`✓ built`) + manuel görsel.

**Spec:** `docs/superpowers/specs/2026-05-18-web-ui-consistency-design.md`

## Execution Status (2026-05-18, subagent-driven, continuous)

- **T1** Button/IconButton + accent token — ✅ (`cb4df07`→fix `5436916`: `type=button` default + tek-radius). Spec ✅ Kalite ✅.
- **T2** Lobby — ✅ (`1963185`). Ana CTA'lar Button'a; mod-kartları/sarı-sim/mor-spectator 5-variant'a oturmadığı için bilerek bırakıldı (plan onaylı). Spec ✅ Kalite ✅.
- **T3** App + çift-Çıkış dedupe — ✅ (`3f359d1`→fix `5613479`: `pill` prop, davet butonu tek-radius). Header `hidden sm:block` reviewer ❌'i gerekçeli reddedildi (pre-existing + onaylı mobil tasarım). Spec ✅ Kalite ✅.
- **T4** GameBoard aksiyon paneli + header — ✅ (`3f61179`→fix `ac58a8d`: header `pill` + Yak temizlik). Affet emerald→amber & Saklan→primary reviewer notları reddedildi (spec §3/§4.4 kasıtlı). Spec ✅ Kalite ✅.
- **T5** GameBoard END + modallar — ✅ (`36cd02e`). leave-confirm grid→flex, 4 close→IconButton (aria-label), END neutral/danger. Silenced=neutral reviewer notu reddedildi (spec §4.4, semantik doğru). Spec ✅ Kalite ✅.
- **T6** Admin — ✅ (`17ac997`→fix `7d218bd`: `active` prop — chip aktif durumu tek-set, kırılgan override giderildi). Spec ✅ Kalite ✅.
- **T7** ShareInvite/Feedback modalları — ✅ (`586e2b4`). TimerDisplay dokunulmadı (buton yok). I2/M1/M2 reddedildi (onaylı Button-geneli karar / kasıtlı dil hizalaması). Spec ✅ Kalite ✅.
- **T8** Final — `npx eslint src/` 12 sorun = hepsi pre-existing (set-state-in-effect/unused/exhaustive-deps; refactor'ın getirdiği YOK, spec §7 kabul); `npm run build` ✓.
- **Manuel görsel checklist (§7):** KULLANICIDA — deploy sonrası gerçek tarayıcıda doğrulanmalı (dürüstlük: işaretlenmedi).

## Commit kuralları (TÜM task'lar — STRICT)

- `main` dalında çalış. Yalnız o task'ın dosyalarını `git add <dosya>` ile stage'le — **asla `git add -A`/`.`** (repoda alakasız dirty/untracked dosyalar var).
- Git hook'larını **asla** atlama (`--no-verify`, `-c core.hooksPath`, herhangi override yok). Hook hata verirse STOP + bildir.
- Commit mesajına `Co-Authored-By: Claude` / herhangi Claude co-author trailer **ekleme**.
- Her commit'ten **hemen sonra ayrı bir çağrıda** `git push` (kullanıcı kalıcı kuralı: "push et her zaman").
- index/worktree mutasyonu: yalnız `git add <dosya>`/`git commit`/`git push` + read-only `git status/diff/log`. `checkout/restore/reset/stash/clean/revert/rm/amend` YASAK.

## Genel migrasyon kuralı (Task 2-7'de geçerli)

Her ad-hoc `<button className="...">` için:
1. **Variant seç** (spec §4.4 eşleme): ana/dramatik aksiyon → `primary`; onay/davet/amber → `accent`; ikincil/geri-al → `neutral`; çıkış/terk → `danger`; rounded-full küçük toggle/filtre → `chip`.
2. **Size seç**: büyük CTA → `lg`; normal → `md`; küçük satır-içi/çip → `sm`.
3. **Koru ve `className`'e taşı**: konumlandırma (`ml-auto`, `w-full`, `flex-1`, `mt-*`), animasyon (`animate-pulse`), aktif-durum rengi (chip için `active ? 'bg-blood-red text-white' : ''`). Bunlar variant'a gömülmez.
4. **Aynen geçir**: `onClick`, `disabled`, `type`, `title`, `aria-*`, çocuk içerik (ikon+metin).
5. **Radius/padding/uppercase/tracking/shadow/transition CLASS'larını SİL** — bunları artık `Button` veriyor. Sadece adım 3'teki sınıflar `className`'de kalır.
6. İkon-only kapatma/aksiyon → `<IconButton aria-label="...">`.

> Bir buton kuralın hiçbir variant'ına net oturmuyorsa veya yapısı (ör. `<a>`, `<label>`, karmaşık iç markup) `Button`'a uymuyorsa: değiştirme, **DONE_WITH_CONCERNS** ile o satırı raporla. Tahmin etme.

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `frontend/src/components/ui/Button.jsx` | `Button` (variant+size) + `IconButton` — saf sunum | **Create** |
| `frontend/tailwind.config.js` | `accent` token'ı `#d97706`'ya hizala | **Modify** |
| `frontend/src/components/Lobby.jsx` | JOIN/CREATE CTA'ları → Button | **Modify** |
| `frontend/src/App.jsx` | LOBBY başlat/çıkış, çift "Çıkış" tekleştirme, davet | **Modify** |
| `frontend/src/components/GameBoard.jsx` | aksiyon paneli + END CTA + modallar + header ikon butonları | **Modify** |
| `frontend/src/components/Admin.jsx` | login + çip/filtre/sekme → Button/chip | **Modify** |
| `frontend/src/components/ShareInviteModal.jsx` | kopyala/paylaş + close → Button/IconButton | **Modify** |
| `frontend/src/components/FeedbackModal.jsx` | gönder + close | **Modify** |
| `frontend/src/components/TimerDisplay.jsx` | (buton yok; sadece radius tutarlılığı kontrol — değişiklik gerekmezse dokunma) | **Review** |

---

## Task 1: `accent` token fix + `Button`/`IconButton` bileşeni

**Files:**
- Modify: `frontend/tailwind.config.js`
- Create: `frontend/src/components/ui/Button.jsx`

- [ ] **Step 1: tailwind.config.js accent'i hizala**

Anchor (`frontend/tailwind.config.js`):
```js
        'blood-red': '#7f1d1d',
        'accent': '#1d4ed8'
```
Şununla değiştir:
```js
        'blood-red': '#7f1d1d',
        'accent': '#d97706'
```
> `index.css @theme --color-accent: #d97706` zaten render edilen değer. Bu yalnız config'i ona eşitler (tek doğru kaynak); görsel sonuç değişmez.

- [ ] **Step 2: `Button`/`IconButton` bileşenini yaz**

Create `frontend/src/components/ui/Button.jsx`:
```jsx
import React from 'react';

// Tek tasarım dili: tüm butonlar bunu kullanır. Saf sunum; mantık yok.
// variant: primary | accent | neutral | danger | chip
// size:    sm | md | lg     (chip'te radius full'a override edilir)
// className: konumlandırma/animasyon/aktif-durum için sona eklenir (override eder).

const BASE =
  'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-widest ' +
  'transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS = {
  primary: 'bg-blood-red hover:bg-red-800 text-white border border-blood-red shadow-[0_0_20px_rgba(127,29,29,0.4)]',
  accent:  'bg-accent hover:bg-amber-700 text-white border border-accent shadow-[0_0_20px_rgba(217,119,6,0.4)]',
  neutral: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  danger:  'bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-900/60',
  chip:    'bg-slate-900/60 hover:text-white text-slate-400 border border-slate-700 rounded-full',
};

const SIZES = {
  sm: 'text-[10px] px-3 py-1.5 rounded-xl',
  md: 'text-xs px-5 py-3 rounded-xl',
  lg: 'text-sm px-6 py-3.5 rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  // chip variant kendi radius'unu (rounded-full) VARIANTS'ta verir; SIZES'taki
  // rounded-xl'i ezmesi için variant sınıfı size'dan SONRA gelir.
  const cls = `${BASE} ${SIZES[size] || SIZES.md} ${VARIANTS[variant] || VARIANTS.primary} ${className}`;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ 'aria-label': ariaLabel, className = '', children, ...rest }) {
  const cls =
    'inline-flex items-center justify-center p-1.5 rounded-full text-slate-500 ' +
    'hover:text-white hover:bg-slate-800 transition-colors active:scale-95 ' +
    'disabled:opacity-50 disabled:pointer-events-none ' + className;
  return (
    <button aria-label={ariaLabel} className={cls} {...rest}>
      {children}
    </button>
  );
}

export default Button;
```

- [ ] **Step 3: Lint + build**

Run: `cd frontend && npx eslint src/components/ui/Button.jsx`
Expected: hata yok.
Run: `cd frontend && npm run build`
Expected: `✓ built`.

- [ ] **Step 4: Commit + push**

```bash
git add frontend/tailwind.config.js frontend/src/components/ui/Button.jsx
git commit -m "feat(ui): paylasilan Button/IconButton bileseni + accent token hizalama"
```
Ayrı çağrı:
```bash
git push
```

---

## Task 2: Lobby.jsx (JOIN/CREATE CTA'ları)

**Files:**
- Modify: `frontend/src/components/Lobby.jsx`

- [ ] **Step 1: Bağlamı oku**

`frontend/src/components/Lobby.jsx`'i tamamen Read et. Buton hedefleri (denetim): `:123` "Köyü İnşa Et" (`bg-blood-red ... rounded-xl`), `:155` "Kapıyı Çal" (`bg-accent ... rounded-xl hover:scale-[1.02]`), ve mod seçim/diğer butonlar.

- [ ] **Step 2: Import ekle**

`Lobby.jsx` import bloğunun sonuna ekle:
```js
import { Button } from './ui/Button';
```

- [ ] **Step 3: CTA'ları değiştir (genel migrasyon kuralı)**

- "Köyü İnşa Et" → `<Button variant="primary" size="lg" className="w-full" onClick={...}>Köyü İnşa Et</Button>` (mevcut `w-full`/handler korunur; `bg-blood-red hover:bg-red-800 py-3 sm:py-4 rounded-xl uppercase tracking-widest font-bold shadow-[...] transition-all` SİL).
- "Kapıyı Çal" → `<Button variant="accent" size="lg" className="w-full" onClick={...}>Kapıyı Çal</Button>` (`hover:scale-[1.02]` istersen `className`'e ekleyebilirsin ama tutarlılık için bırak — `active:scale-95` zaten var).
- Mod seçim butonları (4 mod) eğer ortak bir seçili/seçilsiz toggle ise: `variant="neutral"` + seçili olana `className` ile vurgulama (ör. `className={sel ? 'ring-2 ring-accent' : ''}`). Net oturmuyorsa DONE_WITH_CONCERNS bildir, dokunma.
- Diğer ad-hoc butonlar: genel kurala göre.

- [ ] **Step 4: Lint + build**

Run: `cd frontend && npx eslint src/components/Lobby.jsx`
Expected: yeni hata yok (önceden var olanları not et).
Run: `cd frontend && npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit + push**

```bash
git add frontend/src/components/Lobby.jsx
git commit -m "refactor(ui): Lobby JOIN/CREATE butonlari paylasilan Button'a"
```
Ayrı çağrı: `git push`

---

## Task 3: App.jsx (LOBBY başlat/çıkış + çift "Çıkış" tekleştirme + davet)

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Bağlamı oku**

`App.jsx`'i Read et. Hedefler (denetim): `:439` desktop header "Çıkış" pill, `:527` davet butonu (`accent rounded-full`), `:537` mobil "Çıkış" ikon-only, `:555` LOBBY tab bar (sekme — DOKUNMA, kapsam dışı), `:671` "Oyunu Başlat" (`bg-blood-red ... rounded-lg`).

- [ ] **Step 2: Import ekle**

`App.jsx` import bloğunun sonuna:
```js
import { Button } from './components/ui/Button';
```

- [ ] **Step 3: Çift "Çıkış" tekleştir**

`:427` `hidden sm:block` KUYU header'ındaki leave butonu (`:439`) ile `:537` oda-kodu barındaki ikon-only mobil leave aynı işlevi görür. **Karar:** oda-kodu barındaki leave kanonik olur (`<Button variant="danger" size="sm">Çıkış</Button>`, responsive görünürlük orada), `:439` header'daki tekrarlı leave butonu KALDIRILIR (header'ın geri kalanı kalır). Read ile iki butonu da bul; davranış (onClick handler) kanonik olanda korunur. Net değilse DONE_WITH_CONCERNS bildir.

- [ ] **Step 4: Kalan butonlar (genel kural)**

- "Oyunu Başlat" (`:671`) → `<Button variant="primary" size="lg" className="w-full" onClick={...}>Oyunu Başlat ({n}/16)</Button>`.
- Davet butonu (`:527`) → `<Button variant="accent" size="sm" className="rounded-full" onClick={...}>...</Button>` (rounded-full davet pill görünümü korunsun diye className override).
- LOBBY tab bar (`:555` `border-b-2` sekmeler): **kapsam dışı, DOKUNMA** (sekme, buton değil).

- [ ] **Step 5: Lint + build**

Run: `cd frontend && npx eslint src/App.jsx` → yeni hata yok.
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 6: Commit + push**

```bash
git add frontend/src/App.jsx
git commit -m "refactor(ui): App LOBBY butonlari + cift Cikis teklestirme"
```
Ayrı çağrı: `git push`

---

## Task 4: GameBoard.jsx — aksiyon paneli + header ikon butonları

**Files:**
- Modify: `frontend/src/components/GameBoard.jsx`

- [ ] **Step 1: Bağlamı oku**

`GameBoard.jsx`'i Read et. Aksiyon paneli hedefleri (denetim): `:585` gece "Onayla" (`bg-blood-red rounded-full animate-pulse`), `:636` "Oyu Geri Al" (`bg-slate-700 rounded-full`), `:637` "Oyla" (`bg-accent rounded-full`), `:664-666` "Suçlu/Affet/Geri Al" (`rounded-xl`), `:727` "Mührü Vur" (`rounded-lg`), `:736` skip (`rounded-lg`), `:598` Avcı "Pusu Kur", `:608/609` Kundakçı "Yak/Gazla", `:622` Kaçak "Saklan". Header ikon butonları `:519-538` (Mezarlık/Notlar/Çıkış — `rounded-2xl sm:rounded-full`).

- [ ] **Step 2: Import ekle**

`GameBoard.jsx` import bloğunun sonuna:
```js
import { Button, IconButton } from './ui/Button';
```

- [ ] **Step 3: Aksiyon butonlarını değiştir (genel kural)**

- Gece "Onayla" (`:585`) → `<Button variant="primary" size="sm" className="animate-pulse" onClick={...}>Onayla</Button>` (`animate-pulse` korunur).
- "Oyla" (`:637`) → `variant="accent" size="sm"`.
- "Oyu Geri Al" (`:636`), "Geri Al" (`:666`, `:1212` civarı), skip (`:736`) → `variant="neutral" size="sm"`.
- "Suçlu" (`:664`) → `variant="primary" size="md"`; "Affet" (`:665`) → `variant="accent" size="md"` (emerald yerine amber — tutarlı onay rengi; spec §3).
- "Mührü Vur" (`:727`) → `variant="primary" size="sm"`.
- Özel gece aksiyonları — Avcı "Pusu Kur" (`:598`), Kundakçı "Yak"/"Gazla" (`:608/609`), Kaçak "Saklan" (`:622`) → `variant="primary" size="sm"` (hepsi aynı dil; "Gazla" ikincil ise `accent` da olabilir — net değilse primary bırak, DONE_WITH_CONCERNS'e yazma gerekmez, primary güvenli).

- [ ] **Step 4: Header ikon butonları**

`:519-538` Mezarlık/Notlar/Çıkış: bunlar ikon+label, responsive boyutlu (`min-h-[64px] sm:min-h-0`). Bunları `Button variant="neutral" size="sm"` + `className` ile mevcut responsive/dikey-yatay düzeni koruyarak değiştir; "Çıkış" olanı `variant="danger"`. Karmaşık responsive markup (`flex-col sm:flex-row`) `className`'de korunur. Net oturmuyorsa o üçlüyü olduğu gibi bırak ve DONE_WITH_CONCERNS bildir (öncelik aksiyon paneli + CTA tutarlılığı).

- [ ] **Step 5: Lint + build**

Run: `cd frontend && npx eslint src/components/GameBoard.jsx` → yeni hata yok (dosyada önceden var olan `set-state-in-effect` hataları SENİN değil; not et, dokunma).
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 6: Commit + push**

```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "refactor(ui): GameBoard aksiyon paneli + header butonlari tek dile"
```
Ayrı çağrı: `git push`

---

## Task 5: GameBoard.jsx — END ekranı CTA + tüm modal kapatma/aksiyonları

**Files:**
- Modify: `frontend/src/components/GameBoard.jsx`

- [ ] **Step 1: Bağlamı oku**

Read: END ekranı `:876` "Odada Kal & Lobiye Dön" + `:880` "Çıkış Yap" (donuk slate). Modallar: Köy Defteri close `:943` (`p-2 rounded-full`), Rol modal close `:1050` (`bg-black/50 rounded-full p-1`) + "Anladım" `:1078`, Silenced modal "Tamam", Leave-confirm `:1200-1215` (iOS-alert grid, X yok), ShareInvite zaten ayrı dosya. `Button, IconButton` import Task 4'te eklendi (aynı dosya) — yoksa ekle.

- [ ] **Step 2: END ekranı CTA**

- "Odada Kal & Lobiye Dön" (`:876`) → `<Button variant="neutral" size="lg" className="flex-1 sm:flex-none" onClick={...}>Odada Kal & Lobiye Dön</Button>`.
- "Çıkış Yap" (`:880`) → `<Button variant="danger" size="lg" className="flex-1 sm:flex-none" onClick={...}>Çıkış Yap</Button>`.
- Mevcut `flex-1 sm:flex-none` konum sınıfları `className`'de korunur; donuk slate stil sınıfları silinir.

- [ ] **Step 3: Modal kapatma → IconButton**

Köy Defteri close (`:943`), Rol modal close (`:1050`), ve diğer modal X'leri → `<IconButton aria-label="Kapat" onClick={...}><X size={16} /></IconButton>` (mevcut `X` lucide ikonu korunur; boyut 16). `bg-black/50` gibi özel arka plan gerekiyorsa `className`'e taşı, yoksa standart IconButton yeter.

- [ ] **Step 4: Modal aksiyon butonları + leave-confirm yeniden düzen**

- Rol modal "Anladım" (`:1078`) → `<Button variant="accent" size="md" className="w-full">Anladım</Button>`.
- Silenced modal "Tamam, Susuyorum" → `<Button variant="neutral" size="md" className="w-full">...</Button>`.
- Leave-confirm modal (`:1200-1215`) iOS-alert 2-kolon grid'i: normal modal düzenine çek — başlık + metin + altta 2 `Button`: "Vazgeç" `variant="neutral"`, "Terket" `variant="danger"`. Mevcut onClick'ler korunur. Karmaşıksa: en azından iki aksiyonu `Button`'a çevir, grid'i `flex gap-2` yap.

- [ ] **Step 5: Lint + build**

Run: `cd frontend && npx eslint src/components/GameBoard.jsx` → yeni hata yok.
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 6: Commit + push**

```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "refactor(ui): GameBoard END CTA + modal kapatma/aksiyon tutarliligi"
```
Ayrı çağrı: `git push`

---

## Task 6: Admin.jsx (login + çip/filtre/sekme)

**Files:**
- Modify: `frontend/src/components/Admin.jsx`

- [ ] **Step 1: Bağlamı oku**

Read `Admin.jsx`. Hedefler (denetim): `:408` login submit (`bg-blood-red rounded-lg`), `:532` metrik aralık (Saat/Gün/Hafta) çipleri, `:669` log sekme (Sohbet/Olaylar) çipleri, `:676` kanal filtre çipleri. Bunlar `px-3 py-1 rounded-full` aktif/pasif toggle.

- [ ] **Step 2: Import ekle**

`Admin.jsx` import bloğu sonuna:
```js
import { Button } from './ui/Button';
```

- [ ] **Step 3: Değiştir**

- Login submit (`:408`) → `<Button variant="primary" size="lg" className="w-full" type="submit">...</Button>`.
- Metrik aralık / log sekme / kanal filtre çipleri → `<Button variant="chip" size="sm" className={active ? 'bg-blood-red text-white border-blood-red' : ''} onClick={...}>{lbl}</Button>`. Aktif durum `className` ile (genel kural 3). `chip` variant `rounded-full` verir.

- [ ] **Step 4: Lint + build**

Run: `cd frontend && npx eslint src/components/Admin.jsx` → yeni hata yok.
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 5: Commit + push**

```bash
git add frontend/src/components/Admin.jsx
git commit -m "refactor(ui): Admin login + cip/filtre paylasilan Button'a"
```
Ayrı çağrı: `git push`

---

## Task 7: ShareInviteModal + FeedbackModal (+ TimerDisplay review)

**Files:**
- Modify: `frontend/src/components/ShareInviteModal.jsx`, `frontend/src/components/FeedbackModal.jsx`
- Review: `frontend/src/components/TimerDisplay.jsx`

- [ ] **Step 1: Bağlamı oku**

Read `ShareInviteModal.jsx` (`:68` close `p-1 rounded-full`, `:103` "Kopyala" `rounded-lg border slate`, `:111/119` "Paylaş"/"Linki Al" `rounded-lg border accent`), `FeedbackModal.jsx` (`:148` "Gönder" `rounded-lg`, close butonu), `TimerDisplay.jsx`.

- [ ] **Step 2: ShareInviteModal**

Import: `import { Button, IconButton } from './ui/Button';`
- Close (`:68`) → `<IconButton aria-label="Kapat" onClick={onClose}><X size={16} /></IconButton>`.
- "Kopyala" → `<Button variant="neutral" size="md" className="...mevcut layout..." onClick={handleCopy}>...</Button>` (ikon+metin children korunur).
- "Paylaş" (`:111`) ve fallback "Linki Al" (`:119`) → `<Button variant="accent" size="md" onClick={...}>...</Button>`.
- Grid layout sınıfları (`grid grid-cols-2 gap-2` kapsayıcıda) korunur; buton kendi içinde `Button`.

- [ ] **Step 3: FeedbackModal**

Import: `import { Button, IconButton } from './ui/Button';`
- "Gönder" (`:148`) → `<Button variant="accent" size="lg" className="w-full" type="submit" disabled={...}>Gönder</Button>` (mevcut disabled mantığı korunur).
- Close butonu → `IconButton aria-label="Kapat"`.

- [ ] **Step 4: TimerDisplay review (yalnız kontrol)**

`TimerDisplay.jsx`'te buton yok (denetim: sadece `rounded-2xl sm:rounded-full` görsel). **Buton tutarlılığı kapsamında değişiklik gerekmiyor → DOKUNMA.** (Spec kapsamı buton dili; timer şekli ayrı görsel tercih, kapsam dışı.) Bu adımda sadece teyit et ve değişiklik yapma.

- [ ] **Step 5: Lint + build**

Run: `cd frontend && npx eslint src/components/ShareInviteModal.jsx src/components/FeedbackModal.jsx` → yeni hata yok.
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 6: Commit + push**

```bash
git add frontend/src/components/ShareInviteModal.jsx frontend/src/components/FeedbackModal.jsx
git commit -m "refactor(ui): ShareInvite/Feedback modal butonlari tek dile"
```
Ayrı çağrı: `git push`

---

## Task 8: Final doğrulama + plan durumu

**Files:** (kod yok)

- [ ] **Step 1: Otomatik doğrulama**

```bash
cd frontend && npx eslint src/ 2>&1 | tail -3        # yeni hata yok (önceden var olan set-state-in-effect kabul)
cd frontend && npm run build                          # ✓ built
```

- [ ] **Step 2: Manuel görsel checklist** (spec §7 — kullanıcı, deploy sonrası)

- [ ] JOIN: "Köyü İnşa Et"/"Kapıyı Çal" tek dil, desktop = mobil cila
- [ ] LOBBY: tek "Çıkış"; "Oyunu Başlat" primary; sekmeler bozulmamış
- [ ] GAME: aksiyon paneli tek radius/dil; gece onay `animate-pulse` korundu; oy/yargı/muhtar/skip tutarlı
- [ ] END: "Odada Kal" neutral, "Çıkış Yap" danger — donuk değil
- [ ] Modallar: tüm X = aynı IconButton; leave-confirm normal düzen; ShareInvite/Feedback tutarlı
- [ ] Admin: çip/filtre/sekme tutarlı; login primary
- [ ] Disabled (host olmayan ayarlar) hâlâ devre dışı görünür
- [ ] Hiçbir buton işlevi (onClick/emit) kaybolmadı; `sm:` layout korundu

- [ ] **Step 3: Plan durumu commit + push**

```bash
git add docs/superpowers/plans/2026-05-18-web-ui-consistency.md
git commit -m "docs: web ui tutarlilik plani - yurutme durumu"
```
Ayrı çağrı: `git push`

---

## Self-Review

**Spec coverage:** §1 problem (8 stil/token/radius/END/modal/çift-çıkış) → Task 1 (Button+token), Task 2-7 (ekran migrasyonu), Task 3 (çift çıkış), Task 5 (END+modal). §3 kararlar: React bileşeni → Task 1; accent=#d97706 → Task 1 Step 1; primary=blood-red/accent=amber/neutral/danger/chip + sm/md/lg + rounded-xl/full → Task 1 Step 2 (`VARIANTS`/`SIZES`). §4.1 token → T1S1; §4.2 Button → T1S2 (tam kod); §4.3 IconButton → T1S2 (tam kod); §4.4 1-6 yapısal: END→T5S2, modal kapatma→T5S3, çift Çıkış→T3S3, aksiyon paneli radius→T4S3, primary CTA tekleştirme→T2/T3/T6, tab barı kapsam dışı→T3S4 açıkça DOKUNMA. §4.5 sıra → Task numaralandırması (Lobby→App→GameBoard→Admin→modals). §5 dosyalar → File Structure + her task. §6 kenar durumlar: disabled→Button `disabled:` sınıfı (T1S2); chip aktif→genel kural 3 + T6S3; ikon+metin children→Button BASE `gap-2`; konum/animasyon className→genel kural 3 (T4S3 `animate-pulse`, END `flex-1`); native-share fallback→T7S2. §7 test → her task lint+build + Task 8 checklist.

**Placeholder scan:** "TBD/TODO/handle edge cases" yok. Task 1 tam kod veriyor. Migrasyon task'ları genel kural + denetim file:line + variant eşlemesi + somut örnek veriyor (ad-hoc buton sayısı ~40; her birini elle önceden yazmak körlemesine olur — kural+örnek+oku-uygula daha güvenilir; bu placeholder değil, refactor için doğru yöntem). "Net değilse DONE_WITH_CONCERNS" talimatı tahmin engeli, placeholder değil.

**Type/isim tutarlılığı:** `Button({variant,size,className,children,...rest})` (T1S2) ↔ tüm task'larda `<Button variant=... size=... className=...>` kullanımı birebir. `IconButton({'aria-label',className,children,...rest})` (T1S2) ↔ T5/T7 `<IconButton aria-label=...>` tutarlı. variant değerleri `primary|accent|neutral|danger|chip` (T1S2 `VARIANTS` anahtarları) ↔ migrasyon task'larında kullanılan değerler aynı küme. size `sm|md|lg` (T1S2 `SIZES`) ↔ task kullanımı aynı. import yolu: `ui/Button` — Lobby/GameBoard/Admin/ShareInvite/Feedback `./ui/Button`, App `./components/ui/Button` (App.jsx `src/` kökünde, diğerleri `src/components/`) — yollar dosya konumuna göre doğru. `accent` token T1S1 `#d97706` ↔ `index.css @theme` ile eşit.
