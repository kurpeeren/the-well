# Desktop Yan Paneller (Köy Defteri/Vasiyetim) + Çıkış Boyutu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop'ta (`lg:`+) Köy Defteri (Olaylar) ve Vasiyetim'i modal yerine kalıcı sol/sağ panellere taşı, Çıkış butonunu TimerDisplay ile eşit boyuta getir — mobil/tablet (`<lg`) birebir korunarak, içerik DRY (modal+panel aynı bileşen).

**Architecture:** GameBoard.jsx içine (mevcut `PlayerList` deseni gibi) yerel sunum bileşenleri `EventsList`/`WillEditor` çıkarılır; modal bunları kullanır (kopya yok). `lg:`+ 3-kolon: sol Köy Defteri (`EventsList`), orta oyun (değişmez), sağ kolon Vasiyetim (`WillEditor`) + mevcut Kuyunun Dibi. Çıkış butonuna `sm:` TimerDisplay ölçüsü; Notlar butonu `lg:hidden`. `<lg` modal yolu aynen.

**Tech Stack:** React 19 + Vite + Tailwind v4. Saf birim test yok → repo geleneği: `npx eslint <dosya>` (yeni hata yok) + `npm run build` (`✓ built`) + manuel görsel.

**Spec:** `docs/superpowers/specs/2026-05-18-desktop-side-panels-design.md`

## Commit kuralları (TÜM task'lar — STRICT)
- `main` dalında çalış. Yalnız `git add frontend/src/components/GameBoard.jsx` (tek dosya). **Asla `-A`/`.`**.
- Git hook'larını atlama yok (`--no-verify`/`-c core.hooksPath`/override). Hook hata→STOP+bildir.
- Commit mesajına Claude co-author trailer **ekleme**.
- Her commit'ten **hemen sonra ayrı çağrıda** `git push`.
- Mutasyon: yalnız `git add <dosya>`/`commit`/`push` + read-only `status/diff/log`. checkout/restore/reset/stash/clean/revert/rm/amend YASAK.

## Mobil/tablet koruma kuralı (kritik)
`<lg` (≤1023px) görünüm/akış **birebir** korunur. Yeni paneller yalnız `hidden lg:flex`. Modal kodu (`showNotes`/`showGraveyard`) **silinmez** (`<lg` için gerekli). Notlar butonu yalnız `lg:hidden` eklenir (mobil/tablet'te kalır). Hiçbir taban/mobil sınıf değişmez; oyun mantığı/socket olayları değişmez.

---

## File Structure

| Dosya | Sorumluluk | Durum |
|---|---|---|
| `frontend/src/components/GameBoard.jsx` | `EventsList`/`WillEditor` yerel bileşenleri + `handleWillChange`; modal bunları kullanır; Çıkış `sm:` boyut; Notlar `lg:hidden`; `lg:` 3-kolon (sol Köy Defteri, sağ Vasiyetim+Kuyunun Dibi) | **Modify** |

> Yeni dosya yok — mevcut `PlayerList` (aynı dosyada yerel `function` bileşeni, ~:1355) deseni izlenir; `EventsList`/`WillEditor` aynı dosyada yerel bileşen. DRY: modal ve panel aynı bileşeni çağırır.

---

## Task 1: `EventsList` + `WillEditor` + `handleWillChange` çıkar, modal bunları kullansın (DRY temel)

**Files:** Modify `frontend/src/components/GameBoard.jsx`

Davranış DEĞİŞMEZ — yalnız modal içi inline JSX, ortak bileşene taşınır (panel Task 3'te aynı bileşeni kullanacak). `systemNotes`/`personalNotesMap`/`activeSocketId`/`socket`/`roomCode`/`isDevMode`/`impersonateId` GameBoard kapsamında mevcut.

- [ ] **Step 1: Bağlamı oku** — `GameBoard.jsx`: modal events `<ul>` (`:974-1005`), will `<div>` (`:1009-1021`), `PlayerList` yerel bileşen deseni (`function PlayerList(...)` ~:1355), GameBoard fonksiyon dış kapsamı (export'tan önce yerel bileşen koymak için yer).

- [ ] **Step 2: `EventsList` + `WillEditor` yerel bileşenlerini ekle**

`GameBoard.jsx` içinde, `function PlayerList(` satırının HEMEN ÖNCESİNE (aynı dosya yerel-bileşen deseni) şunu ekle:
```jsx
function EventsList({ systemNotes }) {
  return (
    <ul className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
      {systemNotes?.length > 0 ? (() => {
        const items = [];
        let lastDay = null;
        systemNotes.forEach((note, i) => {
          const noteDay = note.day ?? 1;
          if (noteDay !== lastDay) {
            items.push(
              <li key={`sep-${noteDay}-${i}`} className="flex items-center gap-2 my-1 select-none">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-800">{noteDay}. Gün</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </li>
            );
            lastDay = noteDay;
          }
          let borderClass = 'border-slate-600';
          if (note.align === 'Kırmızı') borderClass = 'border-blood-red';
          if (note.align === 'Yeşil') borderClass = 'border-emerald-500';
          if (note.align === 'Gri') borderClass = 'border-gray-400';
          if (note.align === 'Yarı') borderClass = 'border-amber-500';
          items.push(
            <li key={i} className={`bg-slate-800 p-3 rounded-lg border-l-4 ${borderClass} shadow-inner text-[13px] flex items-center gap-4`}>
              <span className="text-slate-300">{note.text}</span>
            </li>
          );
        });
        return items;
      })() : (
        <li className="text-slate-500 italic text-sm text-center mt-6">Henüz bir olay gerçekleşmedi...</li>
      )}
    </ul>
  );
}

function WillEditor({ value, onChange }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 gap-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Öldüğünde köyün bilmesini istediğin şüphelerini buraya yaz..."
        className="flex-1 w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none font-serif leading-relaxed"
      />
      <p className="shrink-0 text-[10px] text-yellow-500/70 italic text-center uppercase tracking-widest">Öldüğünde tüm köye okunacaktır</p>
    </div>
  );
}
```
> Bu, modaldaki `:974-1005` ve `:1009-1021` JSX'inin birebir kopyası (davranış aynı). Bileşenler dosyada `export default` öncesinde, `PlayerList`'in hemen üstünde.

- [ ] **Step 3: `handleWillChange` ortak handler'ı GameBoard kapsamına ekle**

`GameBoard` fonksiyonu içinde, mevcut bir handler/`const` grubunun yanına (ör. diğer `const handle...` tanımlarının olduğu yere; yoksa `return (`'dan önce uygun bir yere) ekle:
```jsx
  const handleWillChange = (val) => {
    setPersonalNotesMap(prev => ({ ...prev, [activeSocketId]: val }));
    socket.emit('savePersonalNote', { roomCode, note: val, impersonateId: isDevMode ? impersonateId : null });
  };
```
> Modaldaki textarea `onChange` mantığının (`:1012-1016`) birebir aynısı; tek kaynak.

- [ ] **Step 4: Modalı bileşenlere bağla (kopyayı kaldır)**

Anchor — modal events sekmesi (`:973-1006`), tam blok:
```jsx
               {notesTab === 'events' && (
                  <ul className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                     {systemNotes?.length > 0 ? (() => {
                       const items = [];
                       let lastDay = null;
                       systemNotes.forEach((note, i) => {
                          const noteDay = note.day ?? 1;
                          if (noteDay !== lastDay) {
                             items.push(
                                <li key={`sep-${noteDay}-${i}`} className="flex items-center gap-2 my-1 select-none">
                                   <div className="flex-1 h-px bg-slate-800"></div>
                                   <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-800">{noteDay}. Gün</span>
                                   <div className="flex-1 h-px bg-slate-800"></div>
                                </li>
                             );
                             lastDay = noteDay;
                          }
                          let borderClass = 'border-slate-600';
                          if(note.align === 'Kırmızı') borderClass = 'border-blood-red';
                          if(note.align === 'Yeşil') borderClass = 'border-emerald-500';
                          if(note.align === 'Gri') borderClass = 'border-gray-400';
                          if(note.align === 'Yarı') borderClass = 'border-amber-500';
                          items.push(
                             <li key={i} className={`bg-slate-800 p-3 rounded-lg border-l-4 ${borderClass} shadow-inner text-[13px] flex items-center gap-4`}>
                                <span className="text-slate-300">{note.text}</span>
                             </li>
                          );
                       });
                       return items;
                     })() : (
                       <li className="text-slate-500 italic text-sm text-center mt-6">Henüz bir olay gerçekleşmedi...</li>
                     )}
                  </ul>
               )}

               {notesTab === 'will' && (
                  <div className="flex-1 min-h-0 flex flex-col p-4 gap-2">
                     <textarea
                        value={personalNotesMap[activeSocketId] || ''}
                        onChange={e => {
                           const val = e.target.value;
                           setPersonalNotesMap(prev => ({ ...prev, [activeSocketId]: val }));
                           socket.emit('savePersonalNote', { roomCode, note: val, impersonateId: isDevMode ? impersonateId : null });
                        }}
                        placeholder="Öldüğünde köyün bilmesini istediğin şüphelerini buraya yaz..."
                        className="flex-1 w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none font-serif leading-relaxed"
                     />
                     <p className="shrink-0 text-[10px] text-yellow-500/70 italic text-center uppercase tracking-widest">Öldüğünde tüm köye okunacaktır</p>
                  </div>
               )}
```
Şununla değiştir:
```jsx
               {notesTab === 'events' && <EventsList systemNotes={systemNotes} />}

               {notesTab === 'will' && (
                  <WillEditor value={personalNotesMap[activeSocketId] || ''} onChange={handleWillChange} />
               )}
```
> Modalın çevresindeki sekme-bar, `flex-1 min-h-0 overflow-hidden flex flex-col` kapsayıcı vb. AYNEN kalır; yalnız iki sekme içeriği bileşen çağrısına indirilir. Davranış birebir aynı (aynı JSX, aynı handler).

- [ ] **Step 5: Lint + build**

Run: `cd frontend && npx eslint src/components/GameBoard.jsx`
Expected: bilinen pre-existing hatalar (set-state-in-effect ~22/68/290, unused getTeamName ~336, exhaustive-deps ~105) — SENİN değil; YENİ hata yok.
Run: `cd frontend && npm run build`
Expected: `✓ built`.

- [ ] **Step 6: Commit + push**
```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "refactor(ui): Koy Defteri Olaylar/Vasiyetim icerigi EventsList/WillEditor'e (DRY)"
```
Ayrı çağrı: `git push`

---

## Task 2: Çıkış = TimerDisplay boyutu + Notlar butonu `lg:hidden`

**Files:** Modify `frontend/src/components/GameBoard.jsx`

- [ ] **Step 1: Çıkış butonuna desktop TimerDisplay ölçüsü**

Anchor — Çıkış `<Button>` (`:535-543` civarı). Tam mevcut:
```jsx
           <Button
              variant="danger"
              size="sm"
              pill
              onClick={() => setShowLeaveConfirm(true)}
              title="Kasabayı Terket"
              className="flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 min-h-[64px] sm:min-h-0"
           >
```
`className`'i şununla değiştir (yalnız sona `sm:w-20 sm:h-20 sm:p-0` eklendi — mobil dal değişmedi):
```jsx
              className="flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 min-h-[64px] sm:min-h-0 sm:w-20 sm:h-20 sm:p-0"
```
> TimerDisplay desktop `sm:w-20 sm:h-20` (80px). Çıkış artık aynı ayak izi (kare, ikon `w-7 h-7` ortalı, `pill`). Mobil (`flex-col min-h-[64px]` + `sm:hidden` "Çıkış" etiketi) aynen.

- [ ] **Step 2: Notlar butonu desktop'ta gizli**

Anchor — Notlar `<Button>` (`:523`):
```jsx
           <Button variant="neutral" size="sm" pill onClick={() => setShowNotes(true)} className="flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 relative min-h-[64px] sm:min-h-0">
```
Şununla değiştir (yalnız başa `lg:hidden` eklendi):
```jsx
           <Button variant="neutral" size="sm" pill onClick={() => setShowNotes(true)} className="lg:hidden flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0 relative min-h-[64px] sm:min-h-0">
```
> Mezarlık butonu zaten `lg:hidden` (`:519`). Desktop'ta panel açık olduğu için Notlar modalına gerek yok; `<lg`'de buton+modal aynen kalır. Modal kodu silinmedi.

- [ ] **Step 3: Lint + build**
Run: `cd frontend && npx eslint src/components/GameBoard.jsx` → yeni hata yok.
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 4: Commit + push**
```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "feat(ui): Cikis butonu desktop'ta TimerDisplay ile esit + Notlar lg:hidden"
```
Ayrı çağrı: `git push`

---

## Task 3: Desktop `lg:` 3-kolon — sol Köy Defteri + sağ Vasiyetim/Kuyunun Dibi

**Files:** Modify `frontend/src/components/GameBoard.jsx`

- [ ] **Step 1: Bağlamı oku** — ana içerik satırı `:553` (`flex flex-col lg:flex-row`), ana sütun açılışı `:555` (`flex-1 flex flex-col`), mevcut sağ panel `:891` (`hidden lg:flex w-full lg:w-56 flex-col gap-4 lg:h-full shrink-0`) → içinde Kuyunun Dibi (`:892-913`) + Meydan Şahitleri (`:915-934`), satır kapanışı `:937`.

- [ ] **Step 2: SOL Köy Defteri panelini ekle**

Anchor (`:553-555`):
```jsx
      <div className="flex flex-col lg:flex-row gap-0 sm:gap-4 flex-1 mt-0 sm:mt-2 overflow-hidden min-h-0">

      <div className="flex-1 flex flex-col relative sm:rounded-xl border-0 sm:border border-slate-800/50 bg-black/10 overflow-hidden min-h-0">
```
Şununla değiştir (553 satırı aynen; aralığa SOL panel eklenir; 555 ana sütun aynen):
```jsx
      <div className="flex flex-col lg:flex-row gap-0 sm:gap-4 flex-1 mt-0 sm:mt-2 overflow-hidden min-h-0">

      <div className="hidden lg:flex lg:w-64 flex-col bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-md lg:h-full shrink-0">
         <h3 className="shrink-0 text-slate-400 font-bold border-b border-slate-700 p-3 text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2"><BookOpen size={14} className="text-accent" /> Köy Defteri</h3>
         <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <EventsList systemNotes={systemNotes} />
         </div>
      </div>

      <div className="flex-1 flex flex-col relative sm:rounded-xl border-0 sm:border border-slate-800/50 bg-black/10 overflow-hidden min-h-0">
```
> `BookOpen` zaten import'lu (Notlar butonu kullanıyor). Sol panel yalnız `lg:flex`; `<lg` render edilmez (mobil/tablet etkilenmez). `EventsList` Task 1'de tanımlandı.

- [ ] **Step 3: SAĞ kolona Vasiyetim panelini ekle + genişlik**

Anchor — mevcut sağ panel açılışı (`:891`):
```jsx
      <div className="hidden lg:flex w-full lg:w-56 flex-col gap-4 lg:h-full shrink-0">
          <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex-1 overflow-hidden shadow-md">
             <h3 className="text-slate-400 font-bold border-b border-slate-700 pb-2 mb-2 text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                Kuyunun Dibi
             </h3>
```
Şununla değiştir (genişlik `lg:w-56`→`lg:w-64`; Kuyunun Dibi panelinden HEMEN ÖNCE Vasiyetim paneli eklenir; Kuyunun Dibi `flex-1` → `max-h-[45%]` ki Vasiyetim'e yer kalsın):
```jsx
      <div className="hidden lg:flex w-full lg:w-64 flex-col gap-4 lg:h-full shrink-0">
          <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-md flex-1 min-h-0">
             <h3 className="shrink-0 text-yellow-500/90 font-bold border-b border-slate-700 p-3 text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2">Vasiyetim</h3>
             <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <WillEditor value={personalNotesMap[activeSocketId] || ''} onChange={handleWillChange} />
             </div>
          </div>
          <div className="flex flex-col bg-slate-900/60 border border-slate-800 rounded-xl p-3 max-h-[45%] overflow-hidden shadow-md">
             <h3 className="text-slate-400 font-bold border-b border-slate-700 pb-2 mb-2 text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                Kuyunun Dibi
             </h3>
```
> Yalnız: panel genişliği `lg:w-64`; Vasiyetim paneli Kuyunun Dibi'nin ÜSTÜNE eklendi (kullanıcı kararı: Vasiyetim sağ üst, mezarlık alt); Kuyunun Dibi sarmalayıcısının `flex-1`→`max-h-[45%]` (Vasiyetim `flex-1` ile alanı paylaşır, ikisi de scroll'lu). `<ul className="flex-1 overflow-y-auto...">` (Kuyunun Dibi liste, `:896`) ve `Meydan Şahitleri` (`:915-934`) ve `:935` kapanış AYNEN kalır — yalnız yukarıdaki açılış bloğu değişti. `WillEditor`/`handleWillChange` Task 1'de tanımlı. Bu sağ kolon `hidden lg:flex` → `<lg` etkilenmez.

> Anchor'lar net bulunamazsa veya yapı tabloyla uyuşmuyorsa: değiştirme, BLOCKED bildir (tahmin etme). Yalnız belirtilen açılış bloklarını değiştir; Kuyunun Dibi liste içeriği / Meydan Şahitleri / kapanış div'lerine dokunma.

- [ ] **Step 4: Lint + build**
Run: `cd frontend && npx eslint src/components/GameBoard.jsx` → yeni hata yok (pre-existing'ler hariç).
Run: `cd frontend && npm run build` → `✓ built`.

- [ ] **Step 5: Commit + push**
```bash
git add frontend/src/components/GameBoard.jsx
git commit -m "feat(ui): desktop 3-kolon - sol Koy Defteri + sag Vasiyetim/Kuyunun Dibi"
```
Ayrı çağrı: `git push`

---

## Task 4: Final doğrulama + plan durumu

**Files:** (kod yok)

- [ ] **Step 1: Otomatik doğrulama**
```bash
cd frontend && npx eslint src/ 2>&1 | grep -E "problem" | tail -1   # sayı bu iş öncesiyle aynı (yeni yok)
cd frontend && npm run build                                          # ✓ built
```

- [ ] **Step 2: Manuel görsel checklist (spec §7 — kullanıcı, deploy sonrası)**
- [ ] Desktop (≥1024): sol Köy Defteri (Olaylar) + sağ Vasiyetim + altında Kuyunun Dibi kalıcı açık; Notlar/Mezarlık butonu görünmez (`lg:hidden`); modal açılmıyor.
- [ ] Desktop: Çıkış butonu TimerDisplay ile aynı boyut, yan yana hizalı.
- [ ] Desktop Vasiyetim panelinden yaz → kalıcı (`savePersonalNote`); paneller kendi içinde scroll, sayfa/kart kaymaz.
- [ ] Olaylar paneli ↔ (`<lg`) modal "Olaylar" sekmesi birebir aynı içerik (kopya yok).
- [ ] Tablet (~768): paneller YOK; Notlar/Mezarlık butonları + modallar mevcut davranış; Çıkış mobil tile.
- [ ] Mobil (≤640): one-page spec birebir; Notlar modal sekmeli (Olaylar/Vasiyetim) aynen; regresyon yok.
- [ ] Vasiyetim `<lg` modal ve `lg` panel aynı `WillEditor` → kaydetme ikisinde de çalışır, çift emit yok.
- [ ] Hiçbir oyun işlevi (emit/handler/faz) kaybolmadı.

- [ ] **Step 3: Plan durumu commit + push**
```bash
git add docs/superpowers/plans/2026-05-18-desktop-side-panels.md
git commit -m "docs: desktop yan panel plani - yurutme durumu"
```
Ayrı çağrı: `git push`

---

## Self-Review

**Spec coverage:** §2.1 desktop 3-kolon (sol Köy Defteri/orta oyun/sağ Vasiyetim+Kuyunun Dibi) → Task 3 (Step 2 sol, Step 3 sağ); §2.2 Çıkış=Timer boyut → Task 2 Step 1; §2.3 `<lg` birebir korunur → "Mobil/tablet koruma kuralı" + tüm panel ekleri `hidden lg:flex` + Notlar `lg:hidden` (modal silinmedi) Task 2 Step 2 / Task 3; §2.4 DRY tek kaynak → Task 1 (`EventsList`/`WillEditor`/`handleWillChange`, modal bunları kullanır; Task 3 panel AYNI bileşenleri kullanır). §3 kararlar: paneller `lg:`+ → Task 3 `hidden lg:flex`; sol=Olaylar, sağ=Vasiyetim üst+Kuyunun Dibi alt → Task 3 Step 2/3; Çıkış `sm:w-20 sm:h-20` → Task 2 Step 1; Notlar `lg:hidden` (Mezarlık zaten) → Task 2 Step 2; DRY bileşen → Task 1. §4.1 Çıkış sm: → Task 2 Step 1 (tam className); §4.2 3-kolon `lg:w-64` + Kuyunun Dibi `max-h-[45%]` → Task 3 (tam JSX); §4.3 EventsList/WillEditor + modal bağlama + Notlar lg:hidden → Task 1 + Task 2; §4.4 durum/akış (`handleWillChange` tek mantık, notesTab modalda kalır) → Task 1 Step 3-4. §6 kenar: (1) `<lg` modal aynen → koruma kuralı + Task1 modal davranış birebir; (2) kısa desktop her panel `flex-1 min-h-0 overflow-y-auto`/`max-h`+scroll → Task 3 sınıfları; (3) dar lg `lg:w-64`×2 + orta `flex-1`+`min-w-0` (ana sütun `:555` zaten `flex-1`/içerik `min-h-0`) → Task 3; (4) tek `handleWillChange` çift emit yok → Task 1 Step 3; (5) spectator/dev `activeSocketId`/`isDevMode` prop ile aynen → Task 1 Step 3-4; (6) bildirim rozeti `<lg` Notlar'da kalır (lg:hidden ile desktop'ta gizli) → Task 2 Step 2. §7 test → her task lint+build + Task 4 checklist.

**Placeholder scan:** "TBD/TODO" yok. Task 1-3 tam JSX/className veriyor. Task 3'teki "anchor net değilse BLOCKED" tahmin engeli, placeholder değil. `EventsList`/`WillEditor` JSX = modaldan birebir kopya (verbatim verildi). Kuyunun Dibi liste/Meydan Şahitleri "aynen kalır" — değiştirilmeyecek mevcut kod, plan onları tekrar yazmaz (yalnız sarmalayıcı açılış bloğu değişir, o da tam verildi).

**Type/isim tutarlılığı:** `EventsList({systemNotes})` (Task1) ↔ modal `<EventsList systemNotes={systemNotes}/>` (Task1 Step4) ↔ sol panel `<EventsList systemNotes={systemNotes}/>` (Task3 Step2) birebir. `WillEditor({value,onChange})` (Task1) ↔ modal `<WillEditor value={personalNotesMap[activeSocketId]||''} onChange={handleWillChange}/>` (Task1 Step4) ↔ sağ panel aynı çağrı (Task3 Step3) birebir. `handleWillChange` Task1 Step3 tanımı ↔ Task1 Step4 + Task3 Step3 kullanımı tutarlı; içi modal eski `onChange` mantığının (`setPersonalNotesMap`+`socket.emit('savePersonalNote',...)`) birebir aynısı. Çıkış className değişikliği yalnız `sm:` ekleme (mobil token aynen). Notlar yalnız `lg:hidden` ön-ek. `BookOpen` import mevcut (Notlar butonu). Tüm değişiklikler tek dosya `GameBoard.jsx`.
