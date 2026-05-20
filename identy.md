# 🌌 Kuyu - Proje Tanımı ve Detayları (Identity)

## 📝 Proje Özeti
**Kuyu**, popüler "Town of Salem" ve "Mafia/Kurt Adam" türündeki sosyal çıkarım oyunlarından ilham alan, web tabanlı, çok oyunculu bir rol yapma oyunudur. Karanlık bir köy atmosferinde geçen oyun, oyuncuların birbirlerinin rollerini çözmeye, kendi takımlarının hedeflerine ulaşmaya ve hayatta kalmaya çalıştığı bir kaos simülasyonudur.

---

## 🏗️ Teknik Mimari
### 💻 Frontend (Önyüz)
- **Teknoloji:** React (Vite)
- **Styling:** Tailwind CSS (Modern, karanlık ve "blood-red" odaklı tema)
- **İletişim:** Socket.io-client (Gerçek zamanlı veri akışı)
- **İkonlar:** Lucide-React
- **Durum Yönetimi:** React Hooks (useState, useEffect, useRef)

### ⚙️ Backend (Sunucu)
- **Teknoloji:** Node.js, Express
- **Socket:** Socket.io (Oda bazlı iletişim yönetimi)
- **Veritabanı:** Supabase (Oyun geçmişi ve istatistiklerin kalıcı olarak saklanması)
- **Oyun Motoru:** Özel geliştirilmiş `GameEngine.js` (Rol atama, faz yönetimi, aksiyon çözümleme)

---

## 🎭 Oyun Mekanikleri ve Rol Grupları
Oyun, "Altın Oran" (9 Masum, 4 Eşkıya, 2 Tarafsız) üzerine kurulu bir denge sunar.

### 🟩 Masumlar (Köylüler)
Bilgisiz çoğunluk. Amaçları tüm kötüleri (Eşkıyalar ve Katiller) kuyuya atarak köyü temizlemektir.
- **Kritik Roller:** Şifacı (Koruma), Bekçi (Araştırma), Avcı (Pusu), Muhtar (Oy Gücü).

### 🟥 Eşkıyalar (Kötüler)
Organize azınlık. Amaçları köylü sayısını kendi sayılarına düşürerek köyü ele geçirmektir.
- **Kritik Roller:** Eşkıya Başı (Lider), Münafık (İftira), Tefeci (Susturma).

### ⬜ Tarafsızlar (Bireyseller)
Kendi özel kazanma şartları olan, oyunun dengesini bozan karakterler.
- **Kritik Roller:** Kundakçı (Herkesi yakma), Seri Katil (Herkesi öldürme), Köy Delisi (Kendini astırma).

---

## 🔄 Oyun Döngüsü (Phases)
1. **LOBBY:** Oyuncuların toplandığı ve ayarların yapıldığı aşama.
2. **NIGHT:** Oyuncuların gizli yeteneklerini kullandığı, stratejilerin belirlendiği sessiz aşama.
3. **MORNING:** Gecenin sonuçlarının (ölümler, olaylar) açıklandığı aşama.
4. **DAY:** Oyuncuların tartıştığı, ipuçlarını paylaştığı ve şüphelileri belirlediği aşama.
5. **VOTING:** Şüphelinin oylama ile kuyuya atılıp atılmayacağına karar verildiği aşama.
6. **END:** Kazanma şartları sağlandığında oyunun bittiği ve sonuçların gösterildiği aşama.

---

## 🌟 Öne Çıkan Özellikler
- **Dev Mode:** Geliştiriciler için botlarla hızlı test imkanı.
- **Dinamik Rol Havuzu:** Host tarafından özelleştirilebilen rol dağılımı.
- **Vasiyet Sistemi:** Ölen oyuncuların bıraktığı son notların tüm köye okunması.
- **Görsel Efektler:** Kuyuya atılma ve ölüm anları için özel animasyonlar.
- **Reconnection:** Bağlantısı kopan oyuncuların oyuna kaldıkları yerden devam edebilmesi.
