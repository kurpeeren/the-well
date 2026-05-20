# 🔍 Kuyu - Teknik Analiz ve Geliştirme Notları (Analysis)

## 📋 Mevcut Durum Analizi
Proje, temel mekanikleri ve görsel dünyasıyla oldukça sağlam bir temele sahip. Town of Salem mekanikleri başarıyla web ortamına aktarılmış. Ancak üretim (production) ortamına geçiş ve sürdürülebilirlik için bazı kritik noktalar bulunmaktadır.

---

## 🛠️ Eksikler ve Hatalar (Bugs)
1.  **Bellek Yönetimi (Scalability):** Backend'de `rooms` objesi RAM üzerinde tutuluyor. Sunucu restart attığında tüm aktif oyunlar silinir.
2.  **Reconnect Eksikleri:**
    *   Ölü chat geçmişi yeniden bağlanan oyuncuya (veya Gassal rolüne) gönderilmiyor.
    *   Bazı faz geçişlerinde (örneğin tam oylama anında kopma) state senkronizasyonu bozulabilir.
3.  **Güvenlik:**
    *   `ADMIN_PASSWORD` çevre değişkeni üzerinden okunuyor ancak `/api/admin/*` endpoint'leri daha sıkı bir auth mekanizmasına ihtiyaç duyabilir.
    *   Client taraflı "impersonateId" (Dev Mode) üretim ortamında tamamen kapatılmalıdır, aksi takdirde suistimale açıktır.
4.  **Hata Yönetimi:** Socket eventlerinde bazı durumlarda (oda bulunamadığında) client'a yeterli feedback verilmiyor veya sadece console.log ile geçiliyor.

---

## 🚀 Optimizasyon Önerileri
1.  **Kod Yapısı (Refactoring):**
    *   `GameBoard.jsx` (1000+ satır) çok büyük. `Chat`, `PlayerList`, `Modals (Notes, RoleInfo, etc.)` ve `PhasePanels` olarak alt bileşenlere ayrılmalıdır.
    *   `server.js` dosyasındaki socket logic'i ayrı bir `SocketHandler.js` veya benzeri bir yapıya taşınmalıdır.
2.  **Performans:**
    *   Intro videosu (`intro.mp4`) boyutu kontrol edilmeli ve gerekirse CDN üzerinden veya optimize edilmiş formatta sunulmalıdır.
    *   React tarafında `useEffect` bağımlılıkları gözden geçirilerek gereksiz render'lar önlenmelidir.
3.  **Veritabanı (Supabase):**
    *   Sadece oyun sonu değil, önemli oyun içi olaylar (fazla yük oluşturmayacak şekilde) asenkron olarak loglanabilir.

---

## 💡 Geliştirme Önerileri (Yol Haritası)
1.  **Kullanıcı Sistemi:** Kalıcı kullanıcı profilleri, kazanma/kaybetme istatistikleri ve "Level" sistemi eklenebilir.
2.  **Sesli Sohbet:** Sadece "Gündüz" fazında aktif olan, oda bazlı bir sesli sohbet (WebRTC) entegrasyonu oyuna büyük derinlik katar.
3.  **Mobil Uygulama:** Mevcut yapı React Native'e veya PWA (Progressive Web App) standartlarına kolayca dönüştürülebilir.
4.  **Yeni Roller:**
    *   *Gardiyan:* Gece birini hapse atıp onunla özel konuşabilen ve gerekirse infaz edebilen rol.
    *   *Cadı:* Birinin hedefini başka birine yönlendirebilen kontrol rolü.
5.  **Gelişmiş Bot Zekası:** Dev Mode'daki botlar sadece placeholder olmaktan çıkarılıp, basit bir mantıkla (rastgele oylama veya sahte claim yapma) testleri daha gerçekçi kılabilir.

---

## 📌 Kritik Teknik Notlar
- `GameEngine.js` içindeki `processPhaseEnd` fonksiyonu oyunun kalbidir; buradaki priority (öncelik) sırası rollerin birbirini nasıl etkileyeceğini belirler. Mevcut sıra (Avcı -> Kaçak -> Roleblock -> Kundakçı -> Kill) standartlara uygundur.
- `peacefulDays` sayacı 15 gün olarak belirlenmiş; bu süre oyunun kilitlenmesini önlemek için önemlidir ancak oyunun temposuna göre ayarlanabilir olmalıdır.
