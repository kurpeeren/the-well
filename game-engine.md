# ⚙️ Kuyu - Oyun Mantığı ve Sonlu Durum Makinesi (FSM) Analizi

Bu doküman, Kuyu oyununun işleyişini bir Sonlu Durum Makinesi (Finite State Machine) modeli üzerinden adım adım açıklar.

---

## 🏗️ 1. Ana Durum Diyagramı (Main State Machine)

Oyunun yaşam döngüsü aşağıdaki durumlar ve geçişler üzerinden yürütülür:

### [Durum: LOBBY]
- **Tanım:** Oyuncuların toplandığı, rollerin ve ayarların belirlendiği başlangıç noktası.
- **Tetikleyici:** `createRoom` veya `joinRoom`.
- **Geçiş:** Host `startGame` komutunu gönderdiğinde `GAME_STARTING` durumuna geçilir.
- **İşlem:** Rol atamaları (`assignRoles`) yapılır.

### [Durum: GAME_STARTING]
- **Tanım:** Roller atandıktan sonraki 5 saniyelik hazırlık süreci.
- **Geçiş:** Süre dolduğunda otomatik olarak `DAY` durumuna geçilir.

### [Durum: NIGHT]
- **Tanım:** Oyuncuların gizli aksiyonlarını seçtiği (Night Action) aktif faz.
- **Geçiş:** Süre dolduğunda veya `forceNextPhase` kullanıldığında `MORNING` durumuna geçilir.
- **Kritik İşlem:** Tüm gece aksiyonları bu geçiş sırasında **Gece Çözümleme Mantığı** ile işlenir.

### [Durum: MORNING]
- **Tanım:** Gecenin sonuçlarının (Ölümler, olay haberleri) ilan edildiği aşama.
- **Geçiş:** Kısa bir süre sonra (morningTimer) otomatik olarak `DAY` durumuna geçilir.

### [Durum: DAY]
- **Tanım:** Oyuncuların tartıştığı ve bilgi paylaştığı ana faz. Bu süreçte oyuncular canlı suçlama oyları kullanabilir; bir hedefin ağırlıklı oy toplamı yaşayan oyuncu sayısının yarısını (`floor(alive/2)`) kesin olarak geçerse (açık Muhtar oyu 3 ağırlık taşır) o oyuncu `DEFENSE` fazına gönderilir ve gündüz sayacı `dayRemaining` olarak duraklatılır.
- **Tetikleyici:** Muhtar kimliğini açıklayabilir (Mayor Reveal).
- **Geçiş:** Süre dolduğunda `dayCount` artırılır ve `NIGHT` durumuna geçilir. Başarılı bir suçlama eşiği aşıldığında `DEFENSE` durumuna geçilir.

### [Durum: DEFENSE]
- **Tanım:** Suçlanan oyuncunun kuyu başında kendini savunduğu süre. Süre lobi ayarı `defenseTimer` ile belirlenir (varsayılan 60sn).
- **Kısıt:** Bu fazda yalnızca sanık konuşabilir; diğer yaşayan oyuncular susturulur.
- **Geçiş:** Süre dolduğunda otomatik olarak `JUDGMENT` durumuna geçilir.

### [Durum: JUDGMENT]
- **Tanım:** Sanık üzerinde "Suçlu / Affet" hükmünün oylandığı faz. Süre `votingTimer` kadardır. Sanık oy veremez; açık Muhtar oyu 3 ağırlık taşır.
- **Kritik İşlem:** Ağırlıklı `Suçlu` oyu ağırlıklı `Affet` oyunu **kesin olarak** geçerse sanık asılır (eşitlik veya az ise affedilir).
- **Geçiş:**
  - Sonuç çıktıktan sonra `dayRemaining > 0` ise `DAY` durumuna (gündüz kaldığı yerden) dönülür; değilse `NIGHT` durumuna geçilir.
  - Affedilen oyuncu o gün tekrar yargılanamaz (`acquittedToday`). Bir günde birden fazla oyuncu yargılanıp asılabilir.
  - Gündüz süresi eşik aşılmadan dolarsa `dayCount` artırılır ve `NIGHT` durumuna geçilir; eski "en çok oyu alan otomatik asılır" mantığı kaldırılmıştır.

### [Durum: END]
- **Tanım:** Oyunun bittiği ve sonuçların gösterildiği ekran.
- **Geçiş:** Host `returnToLobby` komutunu verirse tekrar `LOBBY` durumuna dönülür ve tüm oyun verileri sıfırlanır.

---

## 🌑 2. Gece Aksiyonu Çözümleme (Night Resolution Pipeline)

`NIGHT` -> `MORNING` geçişi sırasında gerçekleşen işlemler, bir öncelik hattı (Pipeline) şeklinde sırayla yürütülür:

### Adım 1: Bağışıklık ve Korunma (Immunity)
1. **Avcı (Pusu):** En üst öncelik. Pusuya yatan Avcı o gece ölemez.
2. **Kaçak (Saklanma):** Sınırlı hakla kişisel bağışıklık kazanır.

### Adım 2: Engellemeler ve Kontrol (Control)
3. **Meyhaneci / Eskort:** Hedefini engeller (Roleblock). 
   - *Özel Durum:* Eğer hedef **Seri Katil** ise, SK engelleyeni anında öldürür.
4. **Kundakçı (Gaz dökme/Yakma):** 
   - Gaz dökme: Hedef işaretlenir.
   - Yakma: İşaretli tüm oyuncular ölüm listesine eklenir.

### Adım 3: İkincil Etkiler (Utility)
5. **Avcı Pususu Çözümü:** Avcı'nın kapısına giden herkes ölüm listesine eklenir.
6. **Tefeci (Susturma):** Hedef bir sonraki gün konuşamaz.
7. **Münafık (İftira):** Hedef o geceki araştırmalarda "Eşkıya" görünür.

### Adım 4: Hayatta Tutma (Protection)
8. **Şifacı (İyileştirme):** 
   - Hedef ölüm listesindeyse çıkarılır (Kurtarılır).
   - *Kısıtlama:* Kendi kendini iyileştirme hakkı 2 ile sınırlıdır (Backend doğrulamalı).
   - *Kısıtlama:* Kimliğini açıklamış Muhtar'ı iyileştiremez.

### Adım 5: Bilgi Edinme (Information)
9. **Araştırma Sonuçlarının Gönderilmesi:**
   - **Bekçi (Sheriff):** Hedefin "Temiz" mi yoksa "Eşkıya" mı olduğunu öğrenir.
     - *Yanıltma:* Hedef **Münafık** tarafından işaretlenmişse "Eşkıya" görünür.
     - *Yanıltma:* **Eşkıya Başı** bizzat birini öldürene kadar "Temiz" görünür.
   - **Gözcü (Lookout):** Hedefin evini o gece ziyaret edenlerin listesini (isim isim) alır.
     - *Kısıtlama:* Ziyaretçilerin ne yaptığını göremez, sadece orada olduklarını bilir.
   - **Falcı (Investigator):** Hedefin olası 3 rolünü içeren bir kehanet alır (Örn: "Bekçi, Kan Davalı veya Seri Katil").
     - *Yanıltma:* Hedef işaretlenmişse (Framed), "Münafık" içeren bir grup kehanet alır.
   - **Gassal (Medium):** Gece boyunca "Ölüler Boyutu" sohbetini canlı izler. (Aksiyon gerektirmez, pasif yetenektir).

### Adım 6: Katliam (Execution)
10. **Eşkıya Başı ve Eşkıya:** Hedef öldürülür. 
    - Lider (GF) emri önceliklidir. 
    - Tetikçi engellendiyse Lider bizzat saldırmalıdır.
11. **Seri Katil:** Hedefini katleder.
12. **Jester İntikamı:** Eğer bir önceki gün linç edildiyse, ona "Suçlu" oyu verenlerden birini rastgele öldürür.

---

## 🏆 3. Kazanma Şartları (Win Conditions)

Her faz geçişinde ve ölüm olayından sonra aşağıdaki kontroller yapılır:

1. **Masumlar:** Tüm Eşkıyalar ve Tarafsız Katiller (SK, Kundakçı) elendiğinde kazanır.
2. **Eşkıyalar:** Köylü sayısı Eşkıya sayısına eşit veya altına düştüğünde (ve rakip katil kalmadığında) kazanır.
3. **Seri Katil:** Sona kalan tek kişi veya son 2 kişiden biri olduğunda kazanır.
4. **Kundakçı:** Herkesi yaktığında kazanır.
5. **Garip (Jester):** Gündüz oylamasıyla asıldığında bireysel olarak kazanır.
6. **Kan Davalı (Executioner):** Hedefi gündüz asıldığında bireysel olarak kazanır.
7. **Kaçak (Survivor):** Oyun bittiğinde hayatta kalmışsa kazanır.
8. **Beraberlik:** 15 gün boyunca kimse ölmezse oyun beraberlikle biter.
