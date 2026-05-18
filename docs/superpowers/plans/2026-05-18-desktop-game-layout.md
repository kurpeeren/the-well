# Web/Desktop Oyun Ekranı — Tek-Sayfa + Tutarlı Gösterge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop oyun ekranını mobil "tek-sayfa kaymaz" disiplinine getir, `sm:` küçültmelerini tersine çevir, gösterge/sayaç/timer'ı tek tutarlı dile (`StatBadge`) topla, kanvası doldur — mobil davranış birebir korunarak.

**Architecture:** Yeni izole `ui/StatBadge.jsx` (Button deseninin gösterge eşi). TimerDisplay tek şekil + desktop'ta büyür. App.jsx wrapper + index.css + GameBoard dış kabı her boyutta `h-[100svh] overflow-hidden` (mobil kuralı genelleşir) ve `max-w-6xl`. GameBoard içi: `sm:` küçültmeleri kaldırılır, göstergeler StatBadge'e taşınır, PlayerList desktop'ta wrap. Mekanik/izole — her task kendi içinde build-doğrulanır.

**Tech Stack:** React 19 + Vite + Tailwind v4. Saf birim test yok → repo geleneği: `npx eslint <dosya>` (yeni hata yok) + `npm run build` (`✓ built`) + manuel görsel.

**Spec:** `docs/superpowers/specs/2026-05-18-desktop-game-layout-design.md`

## Execution Status (2026-05-18, subagent-driven; reviews controller-direct after subagent rate-limit)

- **DT1** StatBadge + TimerDisplay — ✅ `a3edea8`. Spec ✅ (byte-match) Kalite ✅ (iç-çakışma yok kesin doğrulandı; `phase`≈`neutral` minor/kasıtlı, Timer pre-existing listener-leak kapsam dışı).
- **DT2** Desktop tek-sayfa (App.jsx+index.css+GameBoard kap) — ✅ `7b3923c`. Spec ✅ Kalite ✅ (kritik clip riski 4 ekranda iç-scroll'la kesin temizlendi; body-scroll'a bağımlılık yok).
- **DT3** `sm:` küçültmeleri kaldırma — ✅ `d0b4e07`. Spec ✅ Kalite ✅ (1:1 token silme, taban değerler korundu, korunması gerekenler dokunulmadı). Not: yetenek rozeti `sm:text-[9px]` artığı plan tablosunda yoktu → DT4'te StatBadge'e geçince eridi.
- **DT4** Göstergeler→StatBadge + PlayerList wrap + aksiyon max-h — ✅ `087b90b`. Spec ✅ Kalite ✅ (rol-rozeti onClick/children/koşul birebir; hüküm sayaçları gerçek ifade `judgmentCounts.guiltyW/spareW`; `getPhasePillClass` bg kaldırma kasıtlı birleşme — faz rengi h2/ikonda; `snap-x/no-scrollbar` doğru temizlik).
- **DT5** Final — `npx eslint src/` 12 sorun = bu iş öncesiyle aynı (pre-existing set-state-in-effect/unused/exhaustive-deps; DT1-4 yeni hata getirmedi); `npm run build` ✓.
- **Manuel görsel checklist (§7):** KULLANICIDA — deploy sonrası gerçek tarayıcıda doğrulanmalı (dürüstlük: işaretlenmedi).

## Commit kuralları (TÜM task'lar — STRICT)
- `main` dalında çalış. Yalnız o task'ın dosyalarını `git add <dosya>` ile stage'le — **asla `git add -A`/`.`**.
- Git hook'larını **asla** atlama (`--no-verify`/`-c core.hooksPath`/herhangi override yok). Hook hata verirse STOP+bildir.
- Commit mesajına `Co-Authored-By: Claude`/herhangi Claude co-author trailer **ekleme**.
- Her commit'ten **hemen sonra ayrı çağrıda** `git push`.
- index/worktree mutasyonu: yalnız `git add <dosya>`/`commit`/`push` + read-only `status/diff/log`. `checkout/restore/reset/stash/clean/revert/rm/amend` YASAK.

## Mobil-koruma kuralı (kritik — tüm task'lar)
Tailwind taban (prefix'siz) sınıf = mobil. `sm:`/`md:`/`lg:` = desktop. **Taban değerlere DOKUNMA** (mobil birebir korunur). Yalnız `sm:`/`lg:` dallarını değiştir. Bir `X sm:Y` deseninde `Y` `X`'ten küçükse (küçülme) → `sm:Y`'yi **sil** (mobil değer desktop'ta da geçerli olur) veya büyütecek değere çevir. Asla mobil `X`'i değiştirme.

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `frontend/src/components/ui/StatBadge.jsx` | Tutarlı gösterge/sayaç/rozet (tone+size) | **Create** |
| `frontend/src/components/TimerDisplay.jsx` | Tek şekil, desktop'ta büyür, etiket okunur | **Modify** |
| `frontend/src/App.jsx` | Oyun wrapper her boyutta tek-sayfa | **Modify** |
| `frontend/src/index.css` | `@media(min-width:640px)` body-scroll kuralı oyunu bozmadan kaldır | **Modify** |
| `frontend/src/components/GameBoard.jsx` | Dış kap genişlik/yükseklik, `sm:` küçültme kaldırma, göstergeler→StatBadge, PlayerList wrap, aksiyon-panel max-h | **Modify** |

---

## Task 1: `StatBadge` bileşeni + TimerDisplay düzeltme

**Files:**
- Create: `frontend/src/components/ui/StatBadge.jsx`
- Modify: `frontend/src/components/TimerDisplay.jsx`

- [ ] **Step 1: `StatBadge.jsx` oluştur**

Create `frontend/src/components/ui/StatBadge.jsx` with EXACTLY:
```jsx
import React from 'react';

// Tutarlı gösterge/sayaç/rozet. Saf sunum. Button deseninin gösterge eşi.
// tone: neutral | red | amber | green | phase
// size: sm | md   (desktop'ta KÜÇÜLMEZ — gerekiyorsa md kullan)
// className sona eklenir (override eder).

const BASE =
  'inline-flex items-center gap-1.5 rounded-xl border font-bold uppercase ' +
  'tracking-wider whitespace-nowrap leading-none';

const TONES = {
  neutral: 'bg-slate-800/70 text-slate-300 border-slate-700',
  red:     'bg-red-950/30 text-red-300 border-red-900/50',
  amber:   'bg-amber-950/30 text-amber-300 border-amber-900/50',
  green:   'bg-emerald-950/30 text-emerald-300 border-emerald-900/50',
  phase:   'bg-slate-800/70 text-slate-200 border-slate-700',
};

const SIZES = {
  sm: 'text-[10px] px-2 py-1',
  md: 'text-xs px-3 py-1.5',
};

export function StatBadge({ tone = 'neutral', size = 'sm', className = '', children, ...rest }) {
  const cls = `${BASE} ${SIZES[size] || SIZES.sm} ${TONES[tone] || TONES.neutral} ${className}`;
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

export default StatBadge;
```

- [ ] **Step 2: TimerDisplay — tek şekil + desktop büyür + etiket okunur**

`frontend/src/components/TimerDisplay.jsx` — replace the `return (...)` block. Current:
```jsx
  return (
    <div className="flex flex-col items-center justify-center bg-slate-800 w-16 h-16 sm:w-14 sm:h-14 rounded-2xl sm:rounded-full border border-slate-700 shadow-inner shrink-0 transition-transform">
      <span className={`text-2xl sm:text-xl font-black leading-none ${timeRemaining <= 10 ? 'text-blood-red animate-pulse' : 'text-white'}`}>
        {timeRemaining}
      </span>
      <span className="text-[9px] sm:text-[7px] text-slate-500 uppercase font-bold tracking-tighter mt-0.5">Sn</span>
    </div>
  );
```
Replace with:
```jsx
  return (
    <div className="flex flex-col items-center justify-center bg-slate-800 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-slate-700 shadow-inner shrink-0 transition-transform">
      <span className={`text-2xl sm:text-3xl font-black leading-none ${timeRemaining <= 10 ? 'text-blood-red animate-pulse' : 'text-white'}`}>
        {timeRemaining}
      </span>
      <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-tighter mt-0.5">Sn</span>
    </div>
  );
```
> Şekil her boyutta `rounded-2xl` (daire-flip kalktı). Desktop'ta kutu **büyür** (`sm:w-20`), rakam büyür (`sm:text-3xl`), "Sn" okunur (`sm:text-[10px]`, asla 7px). Düşük-süre `text-blood-red animate-pulse` mantığı korunur. Mobil taban (`w-16 h-16 text-2xl text-[9px]`) **değişmedi**.

- [ ] **Step 3: Lint + build**

Run: `cd frontend && npx eslint src/components/ui/StatBadge.jsx src/components/TimerDisplay.jsx`
Expected: hata yok.
Run: `cd frontend && npm run build`
Expected: `✓ built`.

- [ ] **Step 4: Commit + push**

```bash
git add frontend/src/components/ui/StatBadge.jsx frontend/src/components/TimerDisplay.jsx
git commit -m "feat(ui): StatBadge bileseni + TimerDisplay tek sekil/desktop buyur"
```
Ayrı çağrı: `git push`

---

## Task 2: Her boyutta tek-sayfa wrapper (App.jsx + index.css + GameBoard dış kap)

**Files:**
- Modify: `frontend/src/App.jsx`, `frontend/src/index.css`, `frontend/src/components/GameBoard.jsx`

Önce bağlam: one-page spec gereği INTRO/JOIN/LOBBY zaten `flex-1 min-h-0` ile kendi scroll bölgelerini yönetiyor; bu task body-scroll'u tüm boyutlarda kapatır → 4 ekran da Task 5 manuel checklist'te taşma testinden geçmeli.

- [ ] **Step 1: index.css — desktop body-scroll kuralını kaldır**

Anchor (`frontend/src/index.css:147-157`):
```css
@media (min-width: 640px) {
  html, body, #root {
    height: auto;
    min-height: 100vh;
    min-height: 100svh;
  }
  body {
    overflow: auto;
    overflow-x: hidden;
  }
}
```
Sil (tüm bu `@media` bloğunu kaldır). Böylece `html,body,#root` her boyutta `height:100svh` + `body{overflow:hidden}` (satır 112-122 taban kuralı) geçerli kalır → desktop da tek-sayfa, sayfa kaymaz. (INTRO/JOIN/LOBBY kendi `flex-1 min-h-0 overflow-y-auto` bölgeleriyle scroll alır — one-page spec.)

- [ ] **Step 2: App.jsx — wrapper her boyutta tek-sayfa**

Anchor (`frontend/src/App.jsx:306`):
```jsx
    <div className="text-slate-100 font-sans flex flex-col items-center bg-[#050505] h-[100svh] sm:min-h-[100svh] overflow-hidden sm:overflow-visible sm:p-4">
```
Şununla değiştir:
```jsx
    <div className="text-slate-100 font-sans flex flex-col items-center bg-[#050505] h-[100svh] overflow-hidden sm:p-4">
```
> `sm:min-h-[100svh]` ve `sm:overflow-visible` kaldırıldı → desktop'ta da `h-[100svh] overflow-hidden`. `sm:p-4` (desktop dış boşluk) korunur.

Anchor (`frontend/src/App.jsx:425`):
```jsx
        <div className="w-full flex flex-col items-center relative flex-1 min-h-0 overflow-hidden sm:overflow-visible sm:pb-20">
```
Şununla değiştir:
```jsx
        <div className="w-full flex flex-col items-center relative flex-1 min-h-0 overflow-hidden sm:pb-20">
```
> `sm:overflow-visible` kaldırıldı (içerik `flex-1 min-h-0` ile kendi scroll'unu alır). `sm:pb-20` korunur.

- [ ] **Step 3: GameBoard dış kap — max-w-6xl + her boyutta yükseklik dolu**

Anchor (`frontend/src/components/GameBoard.jsx:456`):
```jsx
    <div className={`w-full max-w-4xl flex flex-col gap-0 sm:gap-2 p-0 sm:p-6 rounded-none sm:rounded-2xl transition-all duration-1000 ${gamePhase === 'NIGHT' ? 'bg-black text-slate-400 shadow-[0_0_30px_rgba(0,0,0,0.8)]' : 'bg-dark-bg text-slate-100 shadow-2xl'} border-0 sm:border border-slate-800 h-full sm:h-auto sm:min-h-[75vh] overflow-hidden`}>
```
Şununla değiştir (yalnız `max-w-4xl`→`max-w-6xl` ve `h-full sm:h-auto sm:min-h-[75vh]`→`h-full`):
```jsx
    <div className={`w-full max-w-6xl flex flex-col gap-0 sm:gap-2 p-0 sm:p-6 rounded-none sm:rounded-2xl transition-all duration-1000 ${gamePhase === 'NIGHT' ? 'bg-black text-slate-400 shadow-[0_0_30px_rgba(0,0,0,0.8)]' : 'bg-dark-bg text-slate-100 shadow-2xl'} border-0 sm:border border-slate-800 h-full overflow-hidden`}>
```
> Kart her boyutta `h-full` (viewport'u doldurur, alt tırtık biter). `max-w-6xl` (1152px) — geniş ekranda gutter belirgin azalır. `overflow-hidden` korunur (iç bölgeler scroll alır).

- [ ] **Step 4: Lint + build**

Run: `cd frontend && npx eslint src/App.jsx src/components/GameBoard.jsx`
Expected: yeni hata yok (GameBoard'da bilinen pre-existing set-state-in-effect ~22/68/290, unused getTeamName ~336, exhaustive-deps ~105 — SENİN değil).
Run: `cd frontend && npm run build`
Expected: `✓ built`.

- [ ] **Step 5: Commit + push**

```bash
git add frontend/src/App.jsx frontend/src/index.css frontend/src/components/GameBoard.jsx
git commit -m "feat(ui): desktop da tek-sayfa (kaymaz) + oyun kabi max-w-6xl/h-full"
```
Ayrı çağrı: `git push`

---

## Task 3: GameBoard `sm:` küçültmelerini tersine çevir

**Files:**
- Modify: `frontend/src/components/GameBoard.jsx`

Mobil-koruma kuralı geçerli: yalnız `sm:` dalı; taban (mobil) değer asla değişmez. Aşağıdaki hedefler denetimden (satır no yaklaşık — içerikten eşle). Her biri için: `sm:<küçük>` dalını **sil** (mobil değer desktop'ta da geçerli olur). Hiçbir öğeyi mobil değerinden küçük bırakma.

- [ ] **Step 1: Bağlamı oku** — `GameBoard.jsx`'i Read et; aşağıdaki sınıfları içeren satırları bul.

- [ ] **Step 2: `sm:` küçültmeleri kaldır** — Her hedefte yalnız belirtilen `sm:` token'ı sil:

| Konum (≈) | Bul (mevcut) | Yap |
|---|---|---|
| `:487` faz ikon kapsayıcı | `p-3 sm:p-2.5` | `sm:p-2.5` sil → `p-3` |
| `:171-176` getPhaseIcon svg (her return) | `w-8 h-8 sm:w-6 sm:h-6` | `sm:w-6 sm:h-6` sil → `w-8 h-8` |
| `:496` rol rozeti | `rounded-lg sm:rounded ... px-2.5 sm:px-1.5 py-1 sm:py-0.5` | `sm:rounded sm:px-1.5 sm:py-0.5` sil (taban `rounded-lg px-2.5 py-1` kalır) |
| `:501-503` yetenek sayaç badge'leri (Kalkan/Pusu/Saklanma) | `px-2 sm:px-1.5 py-0.5` | `sm:px-1.5` sil → `px-2 py-0.5` |
| `:504,506` info/feedback ikon (IconButton içi `<Info>`/`<MessageSquare>`) | `w-5 h-5 sm:w-3.5 sm:h-3.5` | `sm:w-3.5 sm:h-3.5` sil → `w-5 h-5` |
| `:517,521,536` header buton ikon (Skull/Notes/LogOut) | `w-7 h-7 sm:w-5 sm:h-5` | `sm:w-5 sm:h-5` sil → `w-7 h-7` |
| `:523` Notlar bildirim noktası | `w-3.5 h-3.5 sm:w-3 sm:h-3` | `sm:w-3 sm:h-3` sil → `w-3.5 h-3.5` |
| `:561` onaylanan-aksiyon ikon | `w-8 h-8 sm:w-6 sm:h-6` | `sm:w-6 sm:h-6` sil → `w-8 h-8` |
| `:563-564` onaylanan-aksiyon metin | `text-xs sm:text-[11px]` / `text-sm sm:text-xs` | `sm:text-[11px]` / `sm:text-xs` sil |
| `:682,695,708` aksiyon-panel durum ikonları (Morning/Night/JUDGMENT-wait) | `w-9 h-9 sm:w-7 sm:h-7` | `sm:w-7 sm:h-7` sil → `w-9 h-9` |

> Not: header buton `min-h-[64px] sm:min-h-0` ve label `sm:hidden` DOKUNULMAZ (desktop'ta kompakt buton + tooltip kasıtlı; spec yalnız "küçülen ikon/gösterge" der, label gizleme değil). Faz adı pili `:491` `px-3 sm:px-4 py-1 sm:py-1.5` zaten desktop'ta BÜYÜYOR — dokunma. Bir hedefin gerçek metni tablodakinden belirgin farklıysa: o satırı değiştirme, DONE_WITH_CONCERNS ile file:line bildir (tahmin etme). Tablo dışı `sm:`-küçülme görürsen aynı kuralla (sm: küçük dalı sil) düzeltip raporla.

- [ ] **Step 3: Lint + build**

Run: `cd frontend && npx eslint src/components/GameBoard.jsx` → yeni hata yok (pre-existing'ler SENİN değil).
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 4: Commit + push**

```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "fix(ui): oyun ekraninda sm: kucultmeleri kaldirildi (desktop >= mobil)"
```
Ayrı çağrı: `git push`

---

## Task 4: Göstergeler → StatBadge + PlayerList wrap + aksiyon-panel max-h

**Files:**
- Modify: `frontend/src/components/GameBoard.jsx`

- [ ] **Step 1: Bağlamı oku** — `GameBoard.jsx` Read; import bloğu; faz adı pili `:491`; rol rozeti `:496`; yetenek sayaçları `:501-503`; hüküm sayaçları `:668` (`Suçlu X — Affet Y` çıplak metin); skip-day sayaç `:734`; PlayerList `:1358` (`flex overflow-x-auto`); aksiyon panel kabı `:555` (`min-h-[140px] max-h-[220px]`).

- [ ] **Step 2: Import ekle**

`GameBoard.jsx` import bloğuna ekle:
```js
import { StatBadge } from './ui/StatBadge';
```

- [ ] **Step 3: Göstergeleri StatBadge'e taşı**

Genel kural: ad-hoc gösterge `<span/div className="...rounded-... border ... text-...">` → `<StatBadge tone="..." size="...">içerik</StatBadge>`. Eski bg/border/rounded/padding/text/uppercase/tracking sınıfları SİL; konumlandırma (`ml-auto`, `flex` vb.) `className`'e taşı. İçerik (sayı/etiket/ikon) aynen.

- Faz adı pili (`:491`): → `<StatBadge tone="phase" size="md" className="<mevcut konum sınıfları>">{fazAdı}</StatBadge>`.
- Rol rozeti (`:496`): → `<StatBadge tone="phase" size="sm">{rol}</StatBadge>` (renk role özelse: uygun tone `red/amber/green/neutral` seç; net değilse `neutral`).
- Yetenek sayaçları (`:501-503`): Kalkan → `<StatBadge tone="neutral" size="sm">...</StatBadge>`, Pusu → `tone="amber"`, Saklanma → `tone="green"` (mevcut renklerine en yakın tone; içerik/sayı aynen).
- **Hüküm sayaçları (`:668`)** — şu an çıplak `text-[10px]` metin "Suçlu X — Affet Y". Bunu iki StatBadge'e ayır:
  ```jsx
  <div className="flex items-center justify-center gap-2">
    <StatBadge tone="red" size="sm">Suçlu {guiltyCount}</StatBadge>
    <StatBadge tone="amber" size="sm">Affet {spareCount}</StatBadge>
  </div>
  ```
  (Mevcut sayı değişkenlerinin gerçek adlarını koddan al — `guiltyCount`/`spareCount` örnektir; mevcut JSX'teki ifadeleri birebir kullan. Mevcut koşullu render/parent yapısını koru.)
- Skip-day sayaç (`:734`): sayaç zaten Button içinde metin — DOKUNMA (buton, gösterge değil; önceki spec'te Button'a geçti).

> Bir gösterge StatBadge'e temiz oturmuyorsa (karmaşık iç markup) değiştirme, DONE_WITH_CONCERNS bildir.

- [ ] **Step 4: PlayerList — desktop'ta wrap (yatay scroll yok)**

Anchor (`:1358` civarı, PlayerList kapsayıcı): `flex overflow-x-auto gap-2 py-2 px-1` (içerikten teyit et).
Şununla değiştir: `flex flex-wrap justify-center gap-2 py-2 px-1 overflow-y-auto`
> `overflow-x-auto`→`flex-wrap` + `justify-center` + `overflow-y-auto`: kartlar (`w-24` korunur) alanı dolduran satırlara sarar, yatay scroll gider. Mobilde de wrap kabul (taşma yerine sarma — iyileşme, regresyon değil).

- [ ] **Step 5: Aksiyon paneli max-h desktop'ta gevşet**

Anchor (`:555` civarı): `min-h-[140px] max-h-[220px]` (içerikten teyit).
Şununla değiştir: `min-h-[140px] max-h-[220px] sm:max-h-[320px]`
> Mobil `max-h-[220px]` korunur (taban değişmez); desktop'ta `sm:max-h-[320px]` — oyuncu kartları rahat. Sadece `sm:` eklenir.

- [ ] **Step 6: Lint + build**

Run: `cd frontend && npx eslint src/components/GameBoard.jsx` → yeni hata yok.
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 7: Commit + push**

```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "feat(ui): gostergeler StatBadge'e + PlayerList wrap + aksiyon panel desktop max-h"
```
Ayrı çağrı: `git push`

---

## Task 5: Final doğrulama + plan durumu

**Files:** (kod yok)

- [ ] **Step 1: Otomatik doğrulama**

```bash
cd frontend && npx eslint src/ 2>&1 | tail -2     # yeni hata yok (pre-existing set-state-in-effect/unused/exhaustive-deps kabul)
cd frontend && npm run build                       # ✓ built
```

- [ ] **Step 2: Manuel görsel checklist (spec §7 — kullanıcı, deploy sonrası)**

- [ ] Desktop GAME: sayfa kaymaz, kart yüksekliği viewport'u doldurur, alt tırtık yok
- [ ] TimerDisplay desktop'ta mobilden büyük, tek şekil, "Sn" okunur, düşük-süre uyarısı çalışır
- [ ] Header göstergeleri (faz/rol/yetenek) + hüküm sayaçları tek dil (StatBadge), desktop'ta küçülmemiş
- [ ] Geniş ekran: ölü siyah gutter belirgin azaldı (max-w-6xl)
- [ ] PlayerList desktop'ta yatay scroll yok, wrap'li alanı dolduruyor
- [ ] Tablet (~768px): yan panel modal, bozulma yok
- [ ] **Mobil (≤640px) regresyon yok:** INTRO/JOIN/LOBBY/GAME hepsi kaymaz, iç scroll çalışır, görünüm one-page spec ile aynı
- [ ] Hiçbir oyun işlevi (emit/handler/faz) kaybolmadı

- [ ] **Step 3: Plan durumu commit + push**

```bash
git add docs/superpowers/plans/2026-05-18-desktop-game-layout.md
git commit -m "docs: desktop oyun ekrani plani - yurutme durumu"
```
Ayrı çağrı: `git push`

---

## Self-Review

**Spec coverage:** §2.1 desktop≥mobil → Task 3 (sm: küçültme kaldırma) + Task 1 (TimerDisplay büyür); §2.2 desktop tek-sayfa kaymaz → Task 2 (App.jsx+index.css+GameBoard kap); §2.3 tek gösterge dili → Task 1 (StatBadge) + Task 4 (göstergeler→StatBadge); §2.4 kanvas dolar → Task 2 (max-w-6xl) + Task 4 (PlayerList wrap, aksiyon max-h); §2.5 mobil korunur → "Mobil-koruma kuralı" + her task taban-değer-dokunma. §3 kararlar: StatBadge tone/size → Task1 Step1 (tam kod); TimerDisplay rounded-2xl/büyür → Task1 Step2 (tam kod); desktop overflow-hidden/h-full/max-w-6xl → Task2 (tam anchor'lar); §4.1 wrapper → Task2 Step1-3; §4.2 boyut yönü → Task3 tablo; §4.3 StatBadge → Task1+Task4; §4.4 layout (max-w-6xl/PlayerList wrap/aksiyon max-h) → Task2 Step3 + Task4 Step4-5; §4.5 header tutarlılık → Task3+Task4. §6 kenar: (1) INTRO/JOIN/LOBBY one-page korunur → Task2 notu + Task5 mobil-regresyon checklist; (2) kısa ekran iç scroll → `overflow-hidden`+iç `flex-1 min-h-0` (mevcut, korunur); (5) mobil birebir → taban-dokunma kuralı; (6) timer uyarı korunur → Task1 Step2 notu. §7 test → her task lint+build + Task5 checklist.

**Placeholder scan:** "TBD/TODO" yok. Task1/Task2 tam kod+anchor. Task3 tablo = denetimden gelen kesin sınıf eşleşmeleri (kör tahmin değil; "metni farklıysa DONE_WITH_CONCERNS" güvenlik talimatı, placeholder değil). Task4'te `guiltyCount/spareCount` açıkça "örnek — koddan gerçek değişken adını al" diye işaretli; bu placeholder değil, mevcut-kodu-kullan talimatı (sweeping refactor'da doğru yöntem).

**Type/isim tutarlılığı:** `StatBadge({tone,size,className,children,...rest})` Task1 tanımı ↔ Task4 `<StatBadge tone=... size=...>` kullanımı birebir; tone değerleri `neutral|red|amber|green|phase` (Task1 `TONES` anahtarları) ↔ Task4 kullanımı aynı küme; size `sm|md` ↔ Task4 aynı. import yolu `./ui/StatBadge` (GameBoard `src/components/` → `./ui/StatBadge` doğru). Task2 anchor'ları (App.jsx:306/425, index.css:147-157, GameBoard:456) gerçek dosya içeriğiyle teyit edildi (plan yazımında okundu). Task3 `sm:` token'ları denetim raporundaki gerçek sınıflarla eşleşiyor. Mobil-koruma kuralı tüm task'larda tutarlı (yalnız `sm:`/`lg:` dalı).
