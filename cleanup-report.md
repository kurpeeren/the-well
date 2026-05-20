# 🧹 Kuyu Projesi - Temizlik ve Yapısal Analiz Raporu

Proje dizinini ve dosyaları incelediğimde, özellikle geliştirme sürecinden kalma birçok gereksiz dosya, eski asset'ler ve taşınması gereken utility (araç) betikleri tespit ettim. Projenin production (canlı) ortamına daha temiz çıkması için yapılması gerekenleri aşağıda özetledim:

## 1. Kök Dizin (Root) Temizliği 🗑️
Kök dizinde, uygulamanın çalışmasıyla doğrudan ilgisi olmayan birçok script ve eski dosya bulunuyor. Bunlar bir `scripts/` veya `archive/` klasörüne taşınmalıdır.
*   **Python Scriptleri:** `create_icons.py`, `fix.py`, `generate_cards.py`, `rep.py`, `replace_words.py`. Bunlar muhtemelen rolleri ve resimleri oluşturmak/düzenlemek için kullanıldı. Canlı projede yeri kök dizin değildir.
*   **Test Dosyaları:** `test_roles.js`, `test_roles2.js`. Geliştirme aşamasından kalmış testler.
*   **Gereksiz Görseller:** `logo.jpeg` kök dizinde duruyor. Frontend kendi asset'lerini `/public` içinden okuyor, bu dosya gereksiz.

## 2. Tekrarlanan ve Eski Klasörler (Asset Yönetimi) 🖼️
*   **`characters/` ve `role_cards/`:** Kök dizindeki bu klasörlerde `.jpeg` formatında rol resimleri ve HTML dosyaları var.
*   **Gerçek Kullanım:** Ancak frontend, resimleri `frontend/public/roles/` altından modernize edilmiş `.webp` formatıyla okuyor. 
*   **Çözüm:** Kök dizindeki bu iki klasör proje boyutunu şişiriyor. "source-assets" adında bir arşive taşınmalı veya projeden tamamen silinmeli (eğer kaynak dosyaları kaybetmek istemiyorsan saklayabilirsin ama root'ta durmamalı).

## 3. Frontend (Vite Boilerplate) Artıkları 🎨
Frontend klasöründe Vite'in varsayılan kurulumundan kalan ve şu an kullanılmayan dosyalar var:
*   **`frontend/src/App.css`:** İçerisinde tamamen Vite'in varsayılan şablonuna ait CSS'ler (`.counter`, `.hero`, `#docs`) var. Biz projede **Tailwind CSS** kullanıyoruz. Bu dosyanın içi tamamen temizlenebilir veya dosya silinebilir.
*   **Gereksiz Logolar:** `frontend/src/assets/react.svg` ve `vite.svg`. Projede özel ikonlar ve resimler kullanılıyor, bu varsayılan dosyalar silinmelidir.
*   **`optimize.js`:** Frontend kök dizininde duruyor. Bu tür build/optimize scriptleri için frontend içinde bir `scripts/` klasörü açılıp oraya taşınması proje yapısını daha profesyonel gösterir.

## 4. Backend Yapısal ve Güvenlik Uyarıları ⚙️
*   **Admin Paneli Çakışması:** Backend klasöründe `backend/admin/index.html` adında statik bir sayfa var ve `server.js` bunu `/admin` endpoint'inden sunuyor. Ancak frontend tarafında da `src/components/Admin.jsx` var (URL'de `?admin=true` ile çalışıyor). İki farklı admin paneli yaklaşımı var gibi görünüyor. Kullanılmayan eski versiyon (`backend/admin/` içindeki statik HTML) silinmelidir.
*   **`test-bots.js`:** Dev Mode için faydalı ancak `backend/utils/` gibi bir klasörde tutulması mimariyi daha temiz tutar.
*   **Güvenlik:** `server.js` içinde `const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kuyuadmin';` şeklinde bir fallback var. Canlıya çıkarken `.env` dosyasının kesinlikle ayarlandığından emin olunmalı, aksi takdirde varsayılan şifreyle API'ye erişilebilir.

## 📝 Sonuç ve Aksiyon Planı
Proje mekanik ve UI olarak mükemmel çalışıyor. Ancak klasör yapısı "geliştirme aşamasının dağınıklığını" taşıyor. 

Eğer istersen, **1. ve 3. maddelerdeki (Python scriptleri, test js'leri, eski logolar ve boş CSS'ler)** gereksiz dosyaları güvenli bir şekilde silip/taşıyıp klasör yapısını senin için hemen temizleyebilirim. Yapalım mı?