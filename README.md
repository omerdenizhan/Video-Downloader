<h1 align="center">⭐ D-Tube Video İndirici ⭐</h1>

YouTube, YouTube Shorts, Instagram, Twitter / X ve TikTok bağlantılarından video ve ses indirmeyi sağlayan, kayıt gerektirmeyen bir web uygulamasıdır. Üyelik olmadan kullanılır; yönetim için ayrı bir admin paneli içerir.

Sunucu tarafı **Node.js + Express**, görünümler **EJS**, veritabanı **sql.js (SQLite)**, indirme motoru **yt-dlp** ve **FFmpeg**'dir.

---

## İçindekiler

- [Özellikler](#özellikler)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Yapılandırma (.env)](#yapılandırma-env)
- [Çalıştırma](#çalıştırma)
- [Admin paneli](#admin-paneli)
- [Proje yapısı](#proje-yapısı)
- [HTTP uç noktaları](#http-uç-noktaları)
- [Veritabanı](#veritabanı)
- [Uygulama ayarları](#uygulama-ayarları)
- [Arayüz ve stiller](#arayüz-ve-stiller)
- [Harici araçlar (yt-dlp / FFmpeg)](#harici-araçlar-yt-dlp--ffmpeg)
- [Güvenlik](#güvenlik)
- [Sorun giderme](#sorun-giderme)
- [Lisans](#lisans)

---

## Özellikler

**Kullanıcı tarafı**
- Bağlantı yapıştırarak video / ses indirme (YouTube, Shorts, Instagram, Twitter / X, TikTok)
- YouTube'da arama yapıp sonuçlardan seçme
- Format seçimi: **MP4**, **MP3**, **WAV**
- Kalite seçimi: **360p – 1080p** (varsayılan 720p)
- **Video düzenleme (kırpma):** timeline üzerinden başlangıç ve bitiş aralığı seçip yalnızca o bölümü indirme (en fazla 30 dakikalık klip)
- **Oynatma listeleri:** listenin tamamını veya seçilen videoları toplu indirme
- Aydınlık / karanlık tema (tercih tarayıcıda saklanır)
- Kayıt veya üyelik gerekmez

**Yönetici tarafı**
- Genel istatistikler: toplam indirme, tekil ziyaretçi, en çok kullanılan platform ve format
- Sistem sağlık durumu: Node.js, JavaScript runtime, yt-dlp, FFmpeg, geçici klasör, veritabanı
- Aktif indirmelerin canlı listesi
- Uygulama ayarları (toplu indirme limiti, geçici dosya saklama süresi, varsayılan kalite)
- Kullanım analizi ve dönem istatistikleri (7 / 30 / 90 gün), saatlik yoğunluk grafiği
- Hata merkezi (kategoriye göre filtrelenebilir)
- Admin güvenlik olayları (giriş denemeleri)
- Kullanıcı adı ve şifre değiştirme
- Yeniden boyutlandırılabilir kenar çubuğu (genişlik kaydedilir)

---

## Gereksinimler

| Gereksinim | Not |
|---|---|
| **Node.js** | 18 veya üzeri önerilir. yt-dlp, JavaScript runtime olarak çalışan Node.js'i kullanır. |
| **npm** | Bağımlılıkları kurmak için |
| **İnternet erişimi** | Kurulumda yt-dlp ve FFmpeg GitHub'dan indirilir |
| **Python (isteğe bağlı)** | Hazır yt-dlp ikili dosyası çalışmazsa yedek olarak kullanılır |

Desteklenen sistemler: Windows (x64, arm64, ia32), Linux (x64, arm64, arm), macOS (x64, arm64) ve Android / Termux.

---

## Kurulum

```bash
# 1) Bağımlılıkları kur (yt-dlp ve FFmpeg de otomatik indirilir)
npm install

# 2) Ortam dosyasını oluştur
cp .env.ornek .env        # Windows: copy .env.ornek .env

# 3) .env içindeki OTURUM_SIRRI değerini güçlü bir anahtarla değiştir
```

`npm install` sonrasında `postinstall` betiği (`scripts/araclari-kur.js`) çalışır ve işletim sistemine uygun yt-dlp, FFmpeg ve ffprobe dosyalarını `bin/` klasörüne indirir. İndirme başarısız olursa daha sonra elle çalıştırabilirsiniz:

```bash
npm run araclari-kur
```

---

## Yapılandırma (.env)

`.env.ornek` dosyasını `.env` olarak kopyalayın.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | Sunucunun dinleyeceği port |
| `OTURUM_SIRRI` | rastgele | Oturum çerezini imzalayan gizli anahtar. **Mutlaka güçlü bir değer verin**; verilmezse her başlatmada rastgele üretilir ve oturumlar sıfırlanır |
| `NODE_ENV` | `production` | Çalışma ortamı |
| `SESSION_SECURE` | `false` | HTTPS üzerinden yayın yapıyorsanız `true` yapın (çerez yalnızca HTTPS'te gönderilir) |

İsteğe bağlı değişkenler:

| Değişken | Açıklama |
|---|---|
| `YTDLP_YOLU` | Kendi yt-dlp dosyanızın tam yolu |
| `FFMPEG_YOLU`, `FFPROBE_YOLU` | Kendi FFmpeg / ffprobe dosyalarınızın yolu |
| `YTDLP_REMOTE_COMPONENTS` | yt-dlp uzak bileşen ayarı (varsayılan `ejs:github`, kapatmak için `0`) |
| `ARAC_TUMU` | `0` yapılırsa kurulum betiği yalnızca bu sistem için araçları indirir |
| `ARAC_YENILE` | `1` yapılırsa araçlar zorla yeniden indirilir |

> `.env` dosyası `.gitignore` içindedir; depoya eklemeyin.

---

## Çalıştırma

```bash
npm start
```

Başarılı başlangıçta konsolda şu adresler görünür:

```
Adres : http://localhost:3000
Admin : http://localhost:3000/admin/giris
```

- Ana sayfa: `http://localhost:3000`
- Admin girişi: `http://localhost:3000/admin/giris`

Her 30 dakikada bir `gecici/` klasöründeki süresi dolmuş dosyalar otomatik silinir (saklama süresi admin panelinden ayarlanır).

---

## Admin paneli

İlk çalıştırmada veritabanı boşsa otomatik olarak bir yönetici hesabı oluşturulur:

| Kullanıcı adı | Şifre |
|---|---|
| `admin` | `admin123` |

> ⚠️ **Yayına almadan önce bu şifreyi mutlaka değiştirin.** Panelde **Kullanıcı Hesapları** sekmesinden kullanıcı adı ve şifre güncellenebilir.

Panelde iki sekme bulunur:
- **Ana Panel:** istatistikler, sistem durumu, aktif indirmeler, ayarlar, analiz, hata merkezi, güvenlik olayları
- **Kullanıcı Hesapları:** kullanıcı adı ve şifre değiştirme

### Kenar çubuğu genişliği

Kenar çubuğunun kenarından sürükleyerek genişlik ayarlanabilir; çift tıklayınca minimuma döner. Seçilen değer veritabanında saklanır.

Minimum, maksimum ve varsayılan genişlik **tek bir yerden** ayarlanır: `sunucu/servisler/ayarlar.js`

```js
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 275;
const SIDEBAR_VARSAYILAN = 220;
```

Bu değerler hem CSS'e, hem sürükleme koduna, hem de sunucu tarafındaki sınırlamaya buradan aktarılır.

---

## Proje yapısı

```
.
├── sunucu/
│   ├── uygulama.js            # Giriş noktası: Express, güvenlik, oturum, hız sınırları, cron
│   ├── rotalar/
│   │   ├── ana.js             # Ana sayfa (GET /)
│   │   ├── indirme.js         # İndirme API'si (/indir/...)
│   │   └── admin.js           # Admin paneli ve API'si (/admin/...)
│   └── servisler/
│       ├── indirici.js        # yt-dlp çağrıları: bilgi alma, arama, indirme, kırpma, aktif işler
│       ├── araclar.js         # yt-dlp / FFmpeg konumunu bulur ve doğrular
│       ├── platform.js        # İzinli alan adları ve platform tespiti, URL doğrulama
│       ├── ayarlar.js         # Uygulama ayarları ve kenar çubuğu sabitleri
│       └── temizlik.js        # Süresi dolan geçici dosyaları siler
├── veritabani/
│   ├── veritabani.js          # sql.js bağlantısı, tablolar, yardımcı sorgu fonksiyonları
│   └── database.db            # SQLite dosyası (otomatik oluşur, .gitignore'da)
├── gorunumler/                # EJS şablonları
│   ├── ana.ejs                # Ana sayfa
│   ├── admin-giris.ejs        # Admin giriş sayfası
│   ├── admin-panel.ejs        # Admin paneli
│   ├── 404.ejs                # Sayfa bulunamadı
│   └── hata.ejs               # Sunucu hatası
├── genel/                     # Statik dosyalar (köke yayınlanır)
│   ├── tema.css               # Tüm stiller (ortak + sayfaya özel)
│   └── tema.js                # Aydınlık / karanlık tema geçişi
├── scripts/
│   └── araclari-kur.js        # yt-dlp, FFmpeg ve ffprobe indirme betiği
├── bin/                       # İndirilen araçlar (sistem klasörlerine göre, .gitignore'da)
├── gecici/                    # Geçici indirme dosyaları (içeriği .gitignore'da)
├── .env.ornek                 # Örnek ortam dosyası
└── package.json
```

---

## HTTP uç noktaları

### Genel

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/` | Ana sayfa |

### İndirme API'si (`/indir`)

| Yöntem | Yol | Açıklama |
|---|---|---|
| POST | `/indir/ara` | YouTube'da arama (1–120 karakter) |
| POST | `/indir/analiz` | Bağlantıdaki videonun (veya listenin) bilgilerini ve formatlarını getirir |
| POST | `/indir/onizleme` | Kırpma için önizleme dosyası hazırlar |
| GET | `/indir/onizleme/:id` | Hazırlanan önizleme videosunu verir |
| POST | `/indir/kirp` | Seçilen aralığı (en fazla 30 dk) kırpıp indirir |
| POST | `/indir/baslat` | Tek bir video veya ses indirmesi başlatır |
| POST | `/indir/toplu` | Oynatma listesinden seçilen videoları indirir |
| GET | `/indir/dosya/:id/:format` | Hazırlanan dosyayı indirir (`mp4`, `mp3`, `wav`) |

Yalnızca `platform.js` içinde izin verilen alan adları kabul edilir (YouTube, Instagram, Twitter / X, TikTok). Bağlantı uzunluğu en fazla 500 karakterdir.

### Admin (`/admin`)

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET / POST | `/admin/giris` | Giriş sayfası ve giriş işlemi |
| GET | `/admin/cikis` | Çıkış |
| GET | `/admin/panel` | Yönetim paneli |
| GET | `/admin/sistem-durumu` | Sistem sağlık kontrolleri |
| GET | `/admin/istatistikler?aralik=7\|30\|90` | Dönem istatistikleri |
| GET | `/admin/kullanim-analizi?aralik=...` | Kullanım analizi ve saatlik yoğunluk |
| GET | `/admin/hatalar?kategori=...` | Hata merkezi kayıtları |
| GET | `/admin/aktif-indirmeler` | Devam eden ve yeni biten işler |
| GET / POST | `/admin/ayarlar` | Uygulama ayarlarını okuma ve kaydetme |
| GET | `/admin/guvenlik-olaylari` | Giriş denemeleri kayıtları |
| POST | `/admin/sidebar-genislik` | Kenar çubuğu genişliğini kaydeder |
| POST | `/admin/kullanici-adi-degistir` | Kullanıcı adını değiştirir |
| POST | `/admin/sifre-degistir` | Şifreyi değiştirir |

`/admin/giris` ve `/admin/cikis` dışındaki tüm admin yolları oturum açmayı gerektirir.

---

## Veritabanı

SQLite dosyası `veritabani/database.db` konumunda tutulur. [sql.js](https://github.com/sql-js/sql.js) kullanıldığı için veritabanı bellekte çalışır ve her yazma işleminden sonra dosyaya kaydedilir. Tablolar ilk çalıştırmada otomatik oluşturulur.

| Tablo | İçerik |
|---|---|
| `yoneticiler` | Yönetici hesapları (şifreler bcrypt ile hash'lenir) |
| `islemler` | İndirme kayıtları: platform, format, kalite, durum (`tamamlandi`, `hata`, `isleniyor`...), başlık |
| `ziyaretciler` | Ziyaret kayıtları (IP'nin kısaltılmış SHA-256 hash'i) |
| `hatalar` | Sunucu ve indirme hataları, hata merkezi buradan beslenir |
| `ayarlar` | Anahtar–değer uygulama ayarları |
| `admin_giris_loglari` | Admin giriş denemeleri (başarılı / başarısız) |
| `kullanim_olaylari` | Arama, analiz, indirme gibi kullanım olayları |

IP adresleri düz metin olarak saklanmaz; yalnızca hash'in ilk 16 karakteri tutulur.

---

## Uygulama ayarları

Admin panelindeki **Uygulama Ayarları** bölümünden değiştirilir ve `ayarlar` tablosunda saklanır. Değerler sunucuda aşağıdaki aralıklara sınırlanır:

| Ayar | Varsayılan | Sınır |
|---|---|---|
| Toplu indirmede en fazla video sayısı (`maks_toplu_video`) | 20 | 1 – 50 |
| Geçici dosya saklama süresi (`gecici_dosya_suresi`) | 1 saat | 5 dakika – 24 saat |
| Varsayılan kalite (`varsayilan_kalite`) | 720p | 360p, 480p, 720p, 1080p |
| Kenar çubuğu genişliği (`sidebar_genislik`) | 220 px | `SIDEBAR_MIN` – `SIDEBAR_MAX` |

`bakim_modu` ayarı da veritabanında tutulur ancak şu an istek akışında kullanılmaz.

---

## Arayüz ve stiller

Projedeki **tüm CSS** `genel/tema.css` dosyasındadır. EJS şablonlarında `<style>` bloğu bulunmaz (tek istisna: admin panelindeki kenar çubuğu genişliği değişkenleri, çünkü sunucudan gelen değerlerdir).

`tema.css` iki bölümden oluşur:

1. **Ortak stiller (dosyanın başı):** renk değişkenleri, aydınlık / karanlık tema, ortak bileşenler ve mobil kurallar
2. **Sayfaya özel stiller (dosyanın sonu):** her sayfanın stilleri, çakışmayı önlemek için sayfanın `<body>` sınıfına göre ayrılmıştır:

| Sayfa | Body sınıfı |
|---|---|
| `ana.ejs` | `sayfa-ana` |
| `admin-panel.ejs` | `sayfa-admin-panel` |
| `admin-giris.ejs` | `sayfa-admin-giris` |
| `404.ejs` | `sayfa-404` |
| `hata.ejs` | `sayfa-hata` |

Sayfaya özel kurallar `:where(body.sayfa-...)` ile başlar. Bu yazım stilin yalnızca ilgili sayfada geçerli olmasını sağlar ve CSS özgüllüğünü (specificity) artırmaz.

Tema renkleri `:root` / `[data-tema="aydinlik"]` ve `[data-tema="karanlik"]` altında CSS değişkenleri olarak tanımlıdır (`--bg`, `--yazi`, `--vurgu`, `--sinir` vb.). Seçilen tema `tema.js` ile tarayıcıda saklanır.

Fontlar Google Fonts'tan yüklenir (Sora, JetBrains Mono).

---

## Harici araçlar (yt-dlp / FFmpeg)

Uygulama açılırken `servisler/araclar.js` araçları şu sırayla arar:

1. `.env` içindeki `YTDLP_YOLU`, `FFMPEG_YOLU`, `FFPROBE_YOLU`
2. `bin/<sistem>-<mimari>/` klasörü (ör. `bin/win32-x64`, `bin/linux-x64`)
3. Python üzerinden `bin/yt-dlp-py` (yedek)
4. Sistem PATH'indeki `yt-dlp` ve `ffmpeg`

Gerekli en düşük yt-dlp sürümü **2025.11.12**'dir (`--js-runtimes` desteği). Araçların durumu admin panelindeki **Sistem Sağlık Durumu** kutularında görünür.

**Android / Termux:** hazır ikili dosyalar çalışmazsa şunu çalıştırın:

```bash
pkg install python ffmpeg
npm run araclari-kur
```

---

## Güvenlik

- **Helmet** ile güvenlik başlıkları ve Content Security Policy
- **Oturum:** `httpOnly`, `sameSite=strict` çerez, 8 saat geçerlilik; girişte oturum yeniden oluşturulur
- **Hız sınırları** (`express-rate-limit`):
  - Genel: 15 dakikada 200 istek
  - İndirme: dakikada 5 istek
  - Toplu indirme: 15 dakikada 2 istek
  - Admin: 15 dakikada 30 istek (oturum açmış yönetici hariç)
- **Giriş kilidi:** aynı kullanıcı ve IP için 15 dakikada 5 başarısız denemeden sonra giriş geçici olarak engellenir
- **Girdi doğrulama:** yalnızca izinli platform alan adları, sınırlı JSON gövde boyutu (10 KB), format ve kalite beyaz listesi
- **Şifreler** bcrypt (12 tur) ile saklanır
- **Gizlilik:** IP adresleri hash'lenerek saklanır

Yayına almadan önce kontrol listesi:

- [ ] Varsayılan `admin / admin123` hesabının şifresini değiştirin
- [ ] `.env` içinde güçlü bir `OTURUM_SIRRI` tanımlayın
- [ ] HTTPS kullanıyorsanız `SESSION_SECURE=true` yapın
- [ ] Uygulama bir ters vekil (nginx vb.) arkasında çalışacak şekilde `trust proxy = 1` ile yapılandırılmıştır; doğrudan internete açıyorsanız bu ayarı gözden geçirin

---

## Sorun giderme

| Belirti | Olası neden / çözüm |
|---|---|
| Sistem sağlığında yt-dlp veya FFmpeg "Hata" | `npm run araclari-kur` çalıştırın; ağ kısıtlaması varsa `YTDLP_YOLU` / `FFMPEG_YOLU` ile elle yol verin |
| `EADDRINUSE` / port zaten kullanılıyor | Çalışan diğer sunucuyu kapatın veya `.env` içinde `PORT` değerini değiştirin |
| YouTube'a bağlanılamadı hatası | İnternet erişimini ve güvenlik duvarı ayarlarını kontrol edin |
| Giriş yaptıktan sonra oturum düşüyor | `OTURUM_SIRRI` tanımlı mı ve `SESSION_SECURE` doğru mu kontrol edin (HTTP'de `false` olmalı) |
| Admin şifresi unutuldu | `veritabani/database.db` dosyasını silip uygulamayı yeniden başlatırsanız varsayılan hesap (`admin / admin123`) yeniden oluşur. Bu işlem tüm istatistik ve kayıtları da sıfırlar |
| Değişen CSS görünmüyor | Tarayıcıda `Ctrl + F5` ile sert yenileme yapın |

---

## Lisans

Bu proje lisanssızdır. © 2026 Ömer Denizhan
