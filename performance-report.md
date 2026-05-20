# 🚀 Kuyu Projesi - Performans ve Mimari Analiz Raporu

Projenin mimarisini ve React/Node.js döngülerini incelediğimde, oyunun küçük çaplı testlerde sorunsuz çalışmasına rağmen **kullanıcı sayısı arttığında (Scale) veya uzun süreli kullanımlarda** ciddi performans sorunlarına (lag, donma, çökme) yol açabilecek yapısal hatalar tespit ettim. 

İşte detaylı performans analizi ve acil eylem planı:

## 🔴 1. Kritik React Performans Sorunu (Sürekli Yeniden Render)
**Sorun:** `App.jsx` içerisinde `timerUpdate` socket eventi dinleniyor ve `timeRemaining` state'i saniyede bir güncelleniyor. Bu state, devasa olan `GameBoard.jsx` bileşenine prop olarak geçiliyor.
**Etkisi:** Bu durum, oyun oynanırken **saniyede en az 1 kez TÜM UYGULAMANIN (App, GameBoard, Chat, Modallar, Oyuncu Listeleri) baştan aşağı yeniden render edilmesine (çizilmesine)** neden olur. Mobil cihazların pillerini çok hızlı tüketir ve oyun uzadıkça arayüzde (özellikle chat'te) ciddi kasmalar (lag) yaratır.
**Çözüm:** Kronometre (Timer) ayrı, küçük bir React bileşeni (örn: `TimerDisplay.jsx`) haline getirilmeli ve socket dinlemesini kendi içinde yapıp sadece kendini güncellemelidir. Ana bileşenleri (App, GameBoard) saniyede bir tetiklemek React'in anti-pattern'idir (kötü kullanım).

## 🔴 2. Backend Bellek Sızıntısı (Memory Leak) Riski
**Sorun:** `server.js` dosyasında tüm oyun odaları `const rooms = {};` objesi içinde RAM üzerinde tutuluyor. Ancak bir oda LOBBY'de veya END durumunda terk edildiğinde, odanın hafızadan silindiğine (delete rooms[roomCode]) dair garanti bir mekanizma yok. (Sadece kurucu çıkarsa veya oyuncu kalmazsa siliniyor).
**Etkisi:** Sunucu birkaç gün açık kalırsa, yarım bırakılan yüzlerce "hayalet oda" RAM'i dolduracak ve sunucuyu yavaşlatıp sonunda çökertecektir (Out of Memory).
**Çözüm:** Sunucuya belirli periyotlarla (örneğin saatte bir) çalışan bir "Çöp Toplayıcı" (Garbage Collector) eklenmelidir. Son 3 saattir hiçbir etkileşim almayan veya LOBBY'de takılı kalmış odalar `delete rooms[roomCode]` ile temizlenmelidir.

## 🟠 3. Dev Bileşen (GameBoard.jsx) Karmaşası
**Sorun:** `GameBoard.jsx` şu an yaklaşık 900 satır. Chat sistemi, Aksiyon Paneli, Roller, Oylama, Animasyonlar ve Modallar tek bir dosyanın içinde.
**Etkisi:** 1. maddedeki render sorunuyla birleştiğinde performansı dibe çeker. Herhangi bir state değiştiğinde React 900 satırlık DOM ağacını karşılaştırmak (diffing) zorunda kalır. Ayrıca kodu yönetmek ve hata bulmak giderek zorlaşır.
**Çözüm:** `GameBoard.jsx` parçalanmalıdır:
- `ChatPanel.jsx`
- `ActionArea.jsx` (Gece ve oylama seçimleri)
- `RoleInfoModal.jsx`
- `PlayerList.jsx` (Zaten kısmen ayrılmış ama kendi dosyasına taşınmalı)

## 🟡 4. State Referans Hataları (Gereksiz Bağımlılıklar)
**Sorun:** `GameBoard.jsx` içinde `me` ve `activeRole` değişkenleri her render'da `players.find` ile sıfırdan hesaplanıyor. Bu objeler `useEffect` (örneğin animasyon tetikleyicisi) bağımlılıklarına veriliyor (`[eventNews, me?.name]`).
**Etkisi:** Referanslar her saniye (timer yüzünden) değiştiği için `useEffect` gereğinden fazla çalışabilir ve potansiyel sonsuz döngülere (infinite loop) veya animasyon buglarına zemin hazırlar.
**Çözüm:** Türetilen state'ler (derived state) `useMemo` ile sarmalanmalı (memoize edilmeli) veya sadece `players` array'i değiştiğinde yeniden hesaplanmalıdır.

## 🟡 5. Chat Listesi Büyümesi
**Sorun:** `chatMessages` dizisi, faz değişene kadar sürekli büyür. Çok konuşulan bir gündüz fazında DOM'da yüzlerce `div` birikir.
**Etkisi:** Eski ve zayıf cihazlarda listeyi kaydırmak (scroll) kasmaya başlar.
**Çözüm:** Gündüz fazı zaten en fazla 90 saniye olduğu için şu an kritik değil, ancak oyun yapısı değişir de 10 dakikalık sohbetler olursa "Virtualization" (React-Window gibi kütüphaneler) kullanılması gerekebilir. Şimdilik göz ardı edilebilir.

---

### 🛡️ Özet ve Eylem Planı
Oyun "çalışıyor" ancak "ölçeklenebilir" (scalable) değil. Eğer sunucuyu veya uygulamayı bir an önce optimize etmemi istersen **ilk sıradan (Timer ve Re-render sorunu)** başlayarak parçalamaya ve düzeltmeye girişebilirim. Hangisinden başlamamı istersin?
